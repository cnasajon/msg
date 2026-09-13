import { problema } from './avisos';
import { fraseNoIdioma } from './mensagens';
import { PrismaClient, Prisma } from '@prisma/client';
import { env } from './env';
import { slotsVencidos } from './agenda';
import { enviarFoto, enviarTexto, tokenDaPasta } from './telegram';
import { alertar } from './alertas';

/**
 * Dispatcher: descobre os slots vencidos de cada pasta, reivindica cada um e
 * so entao fala com o Telegram.
 *
 * A ordem importa e e o ponto nao negociavel numero 2. A linha de
 * `publications` e gravada **antes** do envio, e a restricao unica
 * (folder_id, data_prevista, hora_prevista) e quem decide quem envia: se dois
 * processos acordarem no mesmo minuto — dois deploys se sobrepondo, um restart,
 * uma replica a mais criada por engano —, um insere e o outro leva violacao de
 * unicidade e desiste em silencio. Trava em memoria nao serviria: ela nao
 * atravessa processos.
 */

export type ResultadoDoCiclo = {
  pastasAvaliadas: number;
  slotsReivindicados: number;
  enviados: number;
  erros: number;
  perdidos: number;
  filasEsgotadas: number;
  filasCurtas: number;
};

const MAXIMO_DE_TENTATIVAS = 3;

/** Violacao de unicidade: outro processo pegou o slot primeiro. */
function slotJaReivindicado(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}

export async function rodarCiclo(
  prisma: PrismaClient,
  agora = new Date(),
  registrar: (mensagem: string, extra?: Record<string, unknown>) => void = () => {},
): Promise<ResultadoDoCiclo> {
  const resultado: ResultadoDoCiclo = {
    pastasAvaliadas: 0,
    slotsReivindicados: 0,
    enviados: 0,
    erros: 0,
    perdidos: 0,
    filasEsgotadas: 0,
    filasCurtas: 0,
  };

  const pastas = await prisma.folder.findMany({
    where: { ativa: true, organization: { ativa: true }, telegramChatId: { not: null } },
    include: { schedules: true, organization: { select: { nome: true, idiomaPadrao: true } } },
  });

  for (const pasta of pastas) {
    resultado.pastasAvaliadas += 1;

    const { dentroDaJanela, perdidos } = slotsVencidos(
      pasta.schedules.map((s) => ({ horaLocal: s.horaLocal, diasSemana: s.diasSemana, ativo: s.ativo })),
      pasta.timezone,
      agora,
      env.dispatchGraceMinutes,
    );

    // Slots perdidos: registrados para nao alertarem de novo, e nunca enviados.
    // Os anteriores a criacao da pasta sao ignorados — alertar que uma pasta
    // nova "perdeu" a publicacao de ontem, quando ela ainda nem existia, e
    // barulho que ensina o administrador a ignorar alerta.
    for (const slot of perdidos.filter((s) => s.instante >= pasta.criadaEm)) {
      const registrado = await reivindicar(prisma, pasta.id, slot.data, slot.hora, 'perdida');
      if (!registrado) continue;
      resultado.perdidos += 1;
      registrar('slot perdido', { pasta: pasta.nome, data: slot.data, hora: slot.hora });
      await alertar(prisma, {
        tipo: 'slot_perdido',
        organizationId: pasta.organizationId,
        pasta: pasta.nome,
        mensagem: fraseNoIdioma(
          problema('alertaSlotPerdido', {
            data: slot.data,
            hora: slot.hora,
            fuso: pasta.timezone,
            tolerancia: env.dispatchGraceMinutes,
          }),
          pasta.organization.idiomaPadrao,
        ),
      });
    }

    for (const slot of dentroDaJanela) {
      const publicacao = await reivindicar(prisma, pasta.id, slot.data, slot.hora, 'reivindicada');
      if (!publicacao) continue; // outro processo pegou, ou ja foi publicado
      resultado.slotsReivindicados += 1;

      const desfecho = await publicarSlot(prisma, pasta, publicacao.id, registrar);
      if (desfecho === 'enviado') resultado.enviados += 1;
      if (desfecho === 'erro') resultado.erros += 1;
      if (desfecho === 'fila_esgotada') resultado.filasEsgotadas += 1;
    }

    // Aviso de fila curta, uma vez por ciclo e so quando ha agendamento ativo.
    if (pasta.schedules.some((s) => s.ativo)) {
      const pendentes = await prisma.text.count({ where: { folderId: pasta.id, status: 'pendente' } });
      if (pendentes > 0 && pendentes < 5) {
        resultado.filasCurtas += 1;
        await alertar(prisma, {
          tipo: 'fila_curta',
          organizationId: pasta.organizationId,
          pasta: pasta.nome,
          mensagem: fraseNoIdioma(
            problema('alertaFilaCurta', { quantidade: pendentes }),
            pasta.organization.idiomaPadrao,
          ),
          // uma vez por dia basta: o worker acorda a cada cinco minutos
          repetirAposHoras: 24,
        });
      }
    }
  }

  return resultado;
}

/**
 * Grava a reivindicacao do slot. Devolve `null` quando o slot ja era de outro
 * processo — que e o caminho normal, nao uma falha.
 */
async function reivindicar(
  prisma: PrismaClient,
  folderId: string,
  data: string,
  hora: string,
  status: 'reivindicada' | 'perdida',
): Promise<{ id: string } | null> {
  try {
    return await prisma.publication.create({
      data: {
        folderId,
        origem: 'dispatcher',
        dataPrevista: new Date(`${data}T00:00:00.000Z`),
        horaPrevista: new Date(`1970-01-01T${hora}:00.000Z`),
        status,
      },
      select: { id: true },
    });
  } catch (erro) {
    if (slotJaReivindicado(erro)) return null;
    throw erro;
  }
}

type PastaComOrganizacao = Prisma.FolderGetPayload<{
  include: { organization: { select: { nome: true; idiomaPadrao: true } } };
}>;

async function publicarSlot(
  prisma: PrismaClient,
  pasta: PastaComOrganizacao,
  publicacaoId: string,
  registrar: (mensagem: string, extra?: Record<string, unknown>) => void,
): Promise<'enviado' | 'erro' | 'fila_esgotada'> {
  let texto = await proximoDaFila(prisma, pasta.id);

  if (!texto && pasta.aoEsgotar === 'reiniciar') {
    const devolvidos = await reiniciarFila(prisma, pasta.id);
    if (devolvidos > 0) {
      registrar('fila reiniciada', { pasta: pasta.nome, textos: devolvidos });
      texto = await proximoDaFila(prisma, pasta.id);
    }
  }

  if (!texto) {
    // Fila esgotada: a publicacao fica registrada sem texto, para o slot nao
    // ser tentado de novo, e os administradores sao avisados.
    await prisma.publication.update({
      where: { id: publicacaoId },
      data: {
        status: 'erro',
        erroMensagem: fraseNoIdioma(
          problema('filaEsgotadaPublicacao'),
          pasta.organization.idiomaPadrao,
        ),
      },
    });
    registrar('fila esgotada', { pasta: pasta.nome });
    await alertar(prisma, {
      tipo: 'fila_esgotada',
      organizationId: pasta.organizationId,
      pasta: pasta.nome,
      mensagem: fraseNoIdioma(problema('alertaFilaEsgotada'), pasta.organization.idiomaPadrao),
    });
    return 'fila_esgotada';
  }

  const token = tokenDaPasta(pasta);
  const chatId = pasta.telegramChatId!;
  let ultimoErro = '';

  for (let tentativa = 1; tentativa <= MAXIMO_DE_TENTATIVAS; tentativa++) {
    const resposta = texto.imagem
      ? await enviarFoto(token, chatId, texto.imagem, texto.imagemMime ?? 'image/jpeg', texto.conteudo)
      : await enviarTexto(token, chatId, texto.conteudo);

    if (resposta.ok) {
      const enviadaEm = new Date();
      await prisma.$transaction([
        prisma.publication.update({
          where: { id: publicacaoId },
          data: {
            status: 'enviada',
            textId: texto.id,
            telegramMessageId: resposta.messageId,
            conteudoPublicado: texto.conteudo,
            tinhaImagem: texto.imagem !== null,
            tentativas: tentativa,
            enviadaEm,
          },
        }),
        prisma.text.update({
          where: { id: texto.id },
          data: { status: 'publicado', publicadoEm: enviadaEm, erroMensagem: null },
        }),
      ]);
      registrar('publicado', { pasta: pasta.nome, messageId: resposta.messageId, tentativa });
      return 'enviado';
    }

    ultimoErro = fraseNoIdioma(resposta.problema, pasta.organization.idiomaPadrao);
    await prisma.publication.update({
      where: { id: publicacaoId },
      data: { tentativas: tentativa, erroMensagem: ultimoErro },
    });
    if (tentativa < MAXIMO_DE_TENTATIVAS) {
      // espera crescente: 2s, 4s
      await new Promise((resolver) => setTimeout(resolver, 2000 * tentativa));
    }
  }

  // Esgotadas as tentativas: marca os dois lados e **nao avanca a fila** — o
  // texto continua sendo o proximo, para nao pular ninguem por causa de uma
  // falha de rede.
  await prisma.$transaction([
    prisma.publication.update({
      where: { id: publicacaoId },
      data: { status: 'erro', textId: texto.id, erroMensagem: ultimoErro, tentativas: MAXIMO_DE_TENTATIVAS },
    }),
    prisma.text.update({ where: { id: texto.id }, data: { status: 'erro', erroMensagem: ultimoErro } }),
  ]);
  registrar('falha definitiva', { pasta: pasta.nome, erro: ultimoErro });
  await alertar(prisma, {
    tipo: 'falha_publicacao',
    organizationId: pasta.organizationId,
    pasta: pasta.nome,
    mensagem: fraseNoIdioma(
      problema('alertaFalhaDefinitiva', { tentativas: MAXIMO_DE_TENTATIVAS, erro: ultimoErro ?? '' }),
      pasta.organization.idiomaPadrao,
    ),
  });
  return 'erro';
}

function proximoDaFila(prisma: PrismaClient, folderId: string) {
  return prisma.text.findFirst({
    where: { folderId, status: 'pendente' },
    orderBy: { ordem: 'asc' },
    select: { id: true, conteudo: true, imagem: true, imagemMime: true },
  });
}

/**
 * Devolve todos os textos ja publicados da pasta ao estado pendente,
 * preservando a ordem original.
 */
async function reiniciarFila(prisma: PrismaClient, folderId: string): Promise<number> {
  const { count } = await prisma.text.updateMany({
    where: { folderId, status: 'publicado' },
    data: { status: 'pendente', publicadoEm: null, erroMensagem: null },
  });
  if (count > 0) {
    await prisma.auditLog.create({
      data: {
        organizationId: (await prisma.folder.findUnique({ where: { id: folderId } }))?.organizationId ?? null,
        acao: 'reiniciar_fila',
        entidade: 'folder',
        entidadeId: folderId,
        detalhes: { textos: count },
      },
    });
  }
  return count;
}
