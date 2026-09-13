'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirCsrf } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { NaoAutorizado } from '@/lib/erros';
import { comEscopo } from '@/lib/escopo';
import { registrarAuditoria } from '@/lib/auditoria';
import { comAviso } from '@/lib/navegacao';
import { tradutorDeAvisos } from '@/lib/avisos-servidor';
import { problemaNaHora } from '@/lib/agenda';
import { enviarFoto, enviarTexto, tokenDaPasta } from '@/lib/telegram';
import { Prisma } from '@prisma/client';

function voltar(destino: string, mensagem: string, tipo: 'erro' | 'ok' = 'erro'): never {
  redirect(comAviso(destino, tipo, mensagem));
}

/* ------------------------------- agendamentos ------------------------------ */

export async function criarAgendamento(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'agendamentos.gerenciar')) throw new NaoAutorizado();

  const { t, frase } = await tradutorDeAvisos();
  const pasta = await comEscopo(sessao).pasta(String(dados.get('folderId') ?? ''));
  const destino = `/pastas/${pasta.id}`;

  const horaLocal = String(dados.get('horaLocal') ?? '').trim();
  const problema = problemaNaHora(horaLocal);
  if (problema) voltar(destino, frase(problema));

  const diasSemana = dados
    .getAll('diasSemana')
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (diasSemana.length === 0) voltar(destino, t('escolhaUmDia'));

  try {
    const criado = await prisma.schedule.create({
      data: { folderId: pasta.id, horaLocal, diasSemana, ativo: true },
    });
    await registrarAuditoria(sessao, {
      acao: 'criar',
      entidade: 'schedule',
      entidadeId: criado.id,
      detalhes: { pasta: pasta.nome, horaLocal, diasSemana },
    });
  } catch (erro) {
    // A restricao unica (folder_id, hora_local) existe porque dois
    // agendamentos no mesmo horario da mesma pasta gerariam um slot so.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      voltar(destino, t('agendamentoRepetido', { hora: horaLocal }));
    }
    throw erro;
  }
  voltar(destino, t('agendamentoCriado', { hora: horaLocal }), 'ok');
}

export async function editarAgendamento(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'agendamentos.gerenciar')) throw new NaoAutorizado();

  const { t, frase } = await tradutorDeAvisos();
  const agendamento = await exigirAgendamento(sessao, String(dados.get('id') ?? ''));
  const destino = `/pastas/${agendamento.folderId}`;

  const horaLocal = String(dados.get('horaLocal') ?? '').trim();
  const problema = problemaNaHora(horaLocal);
  if (problema) voltar(destino, frase(problema));

  const diasSemana = dados
    .getAll('diasSemana')
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (diasSemana.length === 0) voltar(destino, t('escolhaUmDia'));

  try {
    await prisma.schedule.update({
      where: { id: agendamento.id },
      data: { horaLocal, diasSemana },
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      voltar(destino, t('agendamentoRepetidoOutro', { hora: horaLocal }));
    }
    throw erro;
  }
  await registrarAuditoria(sessao, {
    acao: 'editar',
    entidade: 'schedule',
    entidadeId: agendamento.id,
    detalhes: { horaLocal, diasSemana },
  });
  voltar(destino, t('agendamentoSalvo', { hora: horaLocal }), 'ok');
}

export async function alternarAgendamento(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'agendamentos.gerenciar')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();
  const agendamento = await exigirAgendamento(sessao, String(dados.get('id') ?? ''));
  const destino = `/pastas/${agendamento.folderId}`;

  const atualizado = await prisma.schedule.update({
    where: { id: agendamento.id },
    data: { ativo: !agendamento.ativo },
  });
  await registrarAuditoria(sessao, {
    acao: 'editar',
    entidade: 'schedule',
    entidadeId: agendamento.id,
    detalhes: { ativo: atualizado.ativo },
  });
  voltar(destino, atualizado.ativo ? t('agendamentoAtivado') : t('agendamentoPausado'), 'ok');
}

export async function excluirAgendamento(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'agendamentos.gerenciar')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();
  const agendamento = await exigirAgendamento(sessao, String(dados.get('id') ?? ''));
  const destino = `/pastas/${agendamento.folderId}`;

  await prisma.schedule.delete({ where: { id: agendamento.id } });
  await registrarAuditoria(sessao, {
    acao: 'excluir',
    entidade: 'schedule',
    entidadeId: agendamento.id,
    detalhes: { horaLocal: agendamento.horaLocal },
  });
  voltar(destino, t('agendamentoExcluido', { hora: agendamento.horaLocal }), 'ok');
}

/** O agendamento e alcancado pela pasta, que e quem passa pelo escopo. */
async function exigirAgendamento(sessao: Awaited<ReturnType<typeof exigirCsrf>>, id: string) {
  const agendamento = await prisma.schedule.findUnique({ where: { id } });
  if (!agendamento) throw new NaoAutorizado('Agendamento não encontrado.');
  await comEscopo(sessao).pasta(agendamento.folderId);
  return agendamento;
}

/* ----------------------------- acoes manuais ------------------------------ */

/**
 * Publicar agora. Registra a publicacao com origem `manual` antes do envio,
 * como o dispatcher faz — o caminho do envio e um so.
 */
export async function publicarAgora(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'textos.publicarAgora')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();
  const texto = await comEscopo(sessao).texto(String(dados.get('id') ?? ''));
  const destino = String(dados.get('destino') ?? `/textos/${texto.id}`);
  const pasta = await prisma.folder.findUniqueOrThrow({ where: { id: texto.folderId } });

  if (!pasta.telegramChatId) voltar(destino, t('cadastreChatIdAntesDePublicar'));
  if (texto.status === 'publicado') voltar(destino, t('textoJaPublicado'));

  const agora = new Date();
  let publicacaoId: string;
  try {
    const publicacao = await prisma.publication.create({
      data: {
        folderId: pasta.id,
        textId: texto.id,
        origem: 'manual',
        dataPrevista: new Date(`${agora.toISOString().slice(0, 10)}T00:00:00.000Z`),
        horaPrevista: new Date(`1970-01-01T${agora.toISOString().slice(11, 16)}:00.000Z`),
        status: 'reivindicada',
      },
    });
    publicacaoId = publicacao.id;
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      voltar(destino, t('publicacaoNoMesmoMinuto'));
    }
    throw erro;
  }

  const resposta = texto.imagem
    ? await enviarFoto(tokenDaPasta(pasta), pasta.telegramChatId, texto.imagem, texto.imagemMime ?? 'image/jpeg', texto.conteudo)
    : await enviarTexto(tokenDaPasta(pasta), pasta.telegramChatId, texto.conteudo);

  if (!resposta.ok) {
    await prisma.publication.update({
      where: { id: publicacaoId },
      data: { status: 'erro', erroMensagem: resposta.erro, tentativas: 1 },
    });
    await registrarAuditoria(sessao, {
      acao: 'publicar_agora',
      entidade: 'text',
      entidadeId: texto.id,
      detalhes: { sucesso: false, erro: resposta.erro },
    });
    voltar(destino, t('publicacaoFalhou', { erro: resposta.erro ?? t('erroDesconhecido') }));
  }

  const enviadaEm = new Date();
  await prisma.$transaction([
    prisma.publication.update({
      where: { id: publicacaoId },
      data: {
        status: 'enviada',
        telegramMessageId: resposta.messageId,
        conteudoPublicado: texto.conteudo,
        tinhaImagem: texto.imagem !== null,
        tentativas: 1,
        enviadaEm,
      },
    }),
    prisma.text.update({
      where: { id: texto.id },
      data: { status: 'publicado', publicadoEm: enviadaEm, erroMensagem: null },
    }),
  ]);
  await registrarAuditoria(sessao, {
    acao: 'publicar_agora',
    entidade: 'text',
    entidadeId: texto.id,
    detalhes: { sucesso: true, messageId: resposta.messageId },
  });
  voltar(destino, t('publicadoNoGrupo'), 'ok');
}

/** Pular: manda o texto para o fim da fila, sem publicar e sem apagar. */
export async function pularTexto(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'textos.publicarAgora')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();
  const texto = await comEscopo(sessao).texto(String(dados.get('id') ?? ''));
  const destino = String(dados.get('destino') ?? `/textos?pasta=${texto.folderId}`);

  const ultimo = await prisma.text.findFirst({
    where: { folderId: texto.folderId },
    orderBy: { ordem: 'desc' },
    select: { ordem: true },
  });
  await prisma.text.update({
    where: { id: texto.id },
    data: { ordem: (ultimo?.ordem ?? 0) + 1, status: 'pendente', erroMensagem: null },
  });
  await registrarAuditoria(sessao, { acao: 'pular', entidade: 'text', entidadeId: texto.id });
  voltar(destino, t('textoMandadoAoFim'), 'ok');
}

/** Reenviar um texto que ficou com erro: devolve a fila e publica na hora. */
export async function reenviarTexto(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'textos.publicarAgora')) throw new NaoAutorizado();

  const texto = await comEscopo(sessao).texto(String(dados.get('id') ?? ''));
  await prisma.text.update({
    where: { id: texto.id },
    data: { status: 'pendente', erroMensagem: null },
  });
  await publicarAgora(dados);
}
