/**
 * Idempotencia do dispatcher — ponto nao negociavel numero 2.
 *
 * O que estes testes provam: dois processos disputando o mesmo slot produzem
 * **uma** publicacao, porque a reivindicacao e gravada antes da chamada ao
 * Telegram e a restricao unica decide o vencedor. Nada aqui depende de trava em
 * memoria, que nao atravessaria processos.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { prepararBanco, limpar, cliente, temBanco } from './helpers/banco';
import { randomUUID } from 'node:crypto';

// O Telegram e trocado por um dublê: aqui se testa a disputa pelo slot, nao a
// Bot API. Cada envio registra a chamada, e e a contagem delas que denuncia
// publicacao dupla.
const enviosDeTexto: { chatId: string; texto: string }[] = [];
const enviosDeFoto: { chatId: string; legenda: string }[] = [];

vi.mock('@/lib/telegram', async () => {
  const real = await vi.importActual<typeof import('@/lib/telegram')>('@/lib/telegram');
  return {
    ...real,
    enviarTexto: async (_token: string, chatId: string, texto: string) => {
      enviosDeTexto.push({ chatId, texto });
      // atraso de rede: sem ele, a corrida entre os dois ciclos nao acontece
      await new Promise((r) => setTimeout(r, 40));
      return { ok: true as const, messageId: String(4000 + enviosDeTexto.length) };
    },
    enviarFoto: async (_token: string, chatId: string, _imagem: Uint8Array, _mime: string, legenda: string) => {
      enviosDeFoto.push({ chatId, legenda });
      await new Promise((r) => setTimeout(r, 40));
      return { ok: true as const, messageId: String(5000 + enviosDeFoto.length) };
    },
  };
});

const { rodarCiclo } = await import('@/lib/dispatcher');

const CHAT = '-1001492357816';
const FUSO = 'America/Sao_Paulo';
/** 10:05 UTC = 07:05 em Sao Paulo: cinco minutos depois do slot das 07:00. */
const AGORA = new Date('2026-09-14T10:05:00Z');

async function montarPasta(opcoes: {
  textos: number;
  aoEsgotar?: 'parar_notificar' | 'reiniciar';
  alertarAbaixoDe?: number;
}) {
  const db = cliente();
  const organizacao = await db.organization.create({
    data: { nome: `Org ${randomUUID().slice(0, 8)}`, idiomaPadrao: 'pt', timezonePadrao: FUSO },
  });
  const pasta = await db.folder.create({
    data: {
      organizationId: organizacao.id,
      nome: 'Pasta de teste',
      timezone: FUSO,
      telegramChatId: CHAT,
      aoEsgotar: opcoes.aoEsgotar ?? 'parar_notificar',
      ...(opcoes.alertarAbaixoDe === undefined
        ? {}
        : { alertarAbaixoDe: opcoes.alertarAbaixoDe }),
    },
  });
  await db.schedule.create({
    data: { folderId: pasta.id, horaLocal: '07:00', diasSemana: [1, 2, 3, 4, 5, 6, 7], ativo: true },
  });
  for (let i = 1; i <= opcoes.textos; i++) {
    await db.text.create({
      data: {
        folderId: pasta.id,
        conteudo: `Texto ${i} da fila`,
        ordem: i,
        hashConteudo: randomUUID(),
      },
    });
  }
  return { organizacao, pasta };
}

describe.skipIf(!temBanco)('idempotencia do dispatcher', () => {
  beforeAll(async () => {
    await prepararBanco();
  });

  beforeEach(async () => {
    await limpar();
    enviosDeTexto.length = 0;
    enviosDeFoto.length = 0;
  });

  afterAll(async () => {
    await cliente().$disconnect();
  });

  it('DOIS CICLOS EM PARALELO publicam uma vez so', async () => {
    const { pasta } = await montarPasta({ textos: 3 });

    // dois processos acordando no mesmo minuto: dois deploys se sobrepondo,
    // um restart, uma replica criada por engano
    const [um, dois] = await Promise.all([
      rodarCiclo(cliente(), AGORA),
      rodarCiclo(cliente(), AGORA),
    ]);

    expect(enviosDeTexto).toHaveLength(1);
    expect(um.enviados + dois.enviados).toBe(1);
    expect(um.slotsReivindicados + dois.slotsReivindicados).toBe(1);

    const publicacoes = await cliente().publication.findMany({ where: { folderId: pasta.id, status: 'enviada' } });
    expect(publicacoes).toHaveLength(1);
    expect(publicacoes[0]!.telegramMessageId).toBeTruthy();
    // o snapshot do que foi ao ar, que sustenta o historico
    expect(publicacoes[0]!.conteudoPublicado).toBe('Texto 1 da fila');
  });

  it('QUATRO CICLOS EM PARALELO tambem publicam uma vez so', async () => {
    await montarPasta({ textos: 5 });

    const resultados = await Promise.all(
      Array.from({ length: 4 }, () => rodarCiclo(cliente(), AGORA)),
    );

    expect(enviosDeTexto).toHaveLength(1);
    expect(resultados.reduce((soma, r) => soma + r.enviados, 0)).toBe(1);
  });

  it('rodar de novo no mesmo slot nao republica', async () => {
    await montarPasta({ textos: 3 });

    await rodarCiclo(cliente(), AGORA);
    await rodarCiclo(cliente(), AGORA);
    await rodarCiclo(cliente(), new Date(AGORA.getTime() + 60_000));

    expect(enviosDeTexto).toHaveLength(1);
  });

  it('a fila avanca: cada slot publica o texto seguinte, na ordem', async () => {
    const { pasta } = await montarPasta({ textos: 3 });

    await rodarCiclo(cliente(), AGORA);
    // dia seguinte, mesmo horario
    await rodarCiclo(cliente(), new Date('2026-09-15T10:05:00Z'));

    expect(enviosDeTexto.map((e) => e.texto)).toEqual(['Texto 1 da fila', 'Texto 2 da fila']);

    const pendentes = await cliente().text.count({ where: { folderId: pasta.id, status: 'pendente' } });
    expect(pendentes).toBe(1);
  });

  it('a reivindicacao acontece ANTES do envio', async () => {
    const { pasta } = await montarPasta({ textos: 2 });
    const db = cliente();

    // enquanto o envio esta em curso, a linha ja tem de existir no banco
    let publicacoesDuranteOEnvio = -1;
    const espiao = new Promise<void>((resolver) => {
      setTimeout(async () => {
        publicacoesDuranteOEnvio = await db.publication.count({
          where: { folderId: pasta.id, status: 'reivindicada' },
        });
        resolver();
      }, 20); // o dublê do Telegram demora 40ms
    });

    await Promise.all([rodarCiclo(db, AGORA), espiao]);

    expect(publicacoesDuranteOEnvio).toBe(1);
  });

  it('slot fora da janela de tolerancia vira perdido e nao e publicado com atraso', async () => {
    const { pasta } = await montarPasta({ textos: 3 });

    // 45 minutos depois do slot, com tolerancia de 30
    const resultado = await rodarCiclo(cliente(), new Date('2026-09-14T10:45:00Z'));

    expect(enviosDeTexto).toHaveLength(0);
    expect(resultado.perdidos).toBeGreaterThanOrEqual(1);

    const perdidas = await cliente().publication.findMany({ where: { folderId: pasta.id, status: 'perdida' } });
    expect(perdidas.length).toBeGreaterThanOrEqual(1);
    expect(perdidas.every((p) => p.textId === null)).toBe(true);
  });

  it('slot perdido nao e registrado duas vezes', async () => {
    const { pasta } = await montarPasta({ textos: 3 });
    const tarde = new Date('2026-09-14T10:45:00Z');

    await rodarCiclo(cliente(), tarde);
    const depoisDoPrimeiro = await cliente().publication.count({ where: { folderId: pasta.id } });
    await rodarCiclo(cliente(), tarde);
    const depoisDoSegundo = await cliente().publication.count({ where: { folderId: pasta.id } });

    expect(depoisDoSegundo).toBe(depoisDoPrimeiro);
  });

  it('fila esgotada com "parar e notificar": registra sem texto e nao publica', async () => {
    const { pasta } = await montarPasta({ textos: 0 });

    const resultado = await rodarCiclo(cliente(), AGORA);

    expect(enviosDeTexto).toHaveLength(0);
    expect(resultado.filasEsgotadas).toBe(1);

    const publicacao = await cliente().publication.findFirstOrThrow({
      where: { folderId: pasta.id, status: 'erro' },
    });
    expect(publicacao.textId).toBeNull();
    expect(publicacao.erroMensagem).toMatch(/fila esgotada/i);
  });

  it('fila esgotada com "reiniciar": devolve os textos e publica o primeiro', async () => {
    const { pasta } = await montarPasta({ textos: 2, aoEsgotar: 'reiniciar' });
    const db = cliente();

    // primeiro dia publica o 1, segundo publica o 2, terceiro esgota
    await rodarCiclo(db, AGORA);
    await rodarCiclo(db, new Date('2026-09-15T10:05:00Z'));
    expect(await db.text.count({ where: { folderId: pasta.id, status: 'pendente' } })).toBe(0);

    await rodarCiclo(db, new Date('2026-09-16T10:05:00Z'));

    // a fila reiniciou preservando a ordem: o terceiro envio e o texto 1
    expect(enviosDeTexto.map((e) => e.texto)).toEqual([
      'Texto 1 da fila',
      'Texto 2 da fila',
      'Texto 1 da fila',
    ]);
    const auditoria = await db.auditLog.findFirst({ where: { acao: 'reiniciar_fila' } });
    expect(auditoria).not.toBeNull();
  });

  it('pasta sem chat_id nao e avaliada', async () => {
    const { pasta } = await montarPasta({ textos: 3 });
    await cliente().folder.update({ where: { id: pasta.id }, data: { telegramChatId: null } });

    const resultado = await rodarCiclo(cliente(), AGORA);

    expect(resultado.pastasAvaliadas).toBe(0);
    expect(enviosDeTexto).toHaveLength(0);
  });

  it('pasta inativa e organizacao inativa nao publicam', async () => {
    const primeira = await montarPasta({ textos: 2 });
    await cliente().folder.update({ where: { id: primeira.pasta.id }, data: { ativa: false } });

    const segunda = await montarPasta({ textos: 2 });
    await cliente().organization.update({ where: { id: segunda.organizacao.id }, data: { ativa: false } });

    const resultado = await rodarCiclo(cliente(), AGORA);

    expect(resultado.pastasAvaliadas).toBe(0);
    expect(enviosDeTexto).toHaveLength(0);
  });

  it('texto com imagem vai por sendPhoto, com o texto como legenda', async () => {
    const { pasta } = await montarPasta({ textos: 0 });
    const db = cliente();
    await db.text.create({
      data: {
        folderId: pasta.id,
        conteudo: 'Legenda curta',
        ordem: 1,
        hashConteudo: randomUUID(),
        imagem: new Uint8Array([1, 2, 3, 4]),
        imagemMime: 'image/png',
        imagemBytes: 4,
      },
    });

    await rodarCiclo(db, AGORA);

    expect(enviosDeTexto).toHaveLength(0);
    expect(enviosDeFoto).toHaveLength(1);
    expect(enviosDeFoto[0]!.legenda).toBe('Legenda curta');

    const publicacao = await db.publication.findFirstOrThrow({
      where: { folderId: pasta.id, status: 'enviada' },
    });
    expect(publicacao.tinhaImagem).toBe(true);
  });
});

describe.skipIf(!temBanco)('lista por data no dispatcher', () => {
  beforeAll(async () => {
    await prepararBanco();
  });

  beforeEach(async () => {
    await limpar();
    enviosDeTexto.length = 0;
    enviosDeFoto.length = 0;
  });

  afterAll(async () => {
    await cliente().$disconnect();
  });

  /** Pasta por data, publicando todos os dias às 07:00 no fuso de São Paulo. */
  async function pastaPorData() {
    const db = cliente();
    const organizacao = await db.organization.create({
      data: { nome: `Org ${randomUUID().slice(0, 8)}`, idiomaPadrao: 'pt', timezonePadrao: FUSO },
    });
    const pasta = await db.folder.create({
      data: {
        organizationId: organizacao.id,
        nome: 'Pasta por data',
        timezone: FUSO,
        telegramChatId: CHAT,
        tipoDeLista: 'data',
      },
    });
    await db.schedule.create({
      data: { folderId: pasta.id, horaLocal: '07:00', diasSemana: [1, 2, 3, 4, 5, 6, 7], ativo: true },
    });
    return pasta;
  }

  async function texto(folderId: string, conteudo: string, dia: number | null, mes: number | null) {
    return cliente().text.create({
      data: {
        folderId,
        conteudo,
        ordem: 1,
        hashConteudo: randomUUID(),
        diaDaPublicacao: dia,
        mesDaPublicacao: mes,
      },
    });
  }

  it('publica o texto da data e ignora o que é de outro dia', async () => {
    // AGORA é 14/09/2026
    const pasta = await pastaPorData();
    await texto(pasta.id, 'É dia 14 de setembro', 14, 9);
    await texto(pasta.id, 'Isto é do Natal', 25, 12);

    const resultado = await rodarCiclo(cliente(), AGORA);

    expect(resultado.enviados).toBe(1);
    expect(enviosDeTexto).toHaveLength(1);
    expect(enviosDeTexto[0]?.texto).toBe('É dia 14 de setembro');
  });

  it('sem texto para a data NÃO é erro nem fila esgotada', async () => {
    const pasta = await pastaPorData();
    await texto(pasta.id, 'Isto é do Natal', 25, 12);

    const resultado = await rodarCiclo(cliente(), AGORA);

    expect(enviosDeTexto).toHaveLength(0);
    expect(resultado.semTextoParaAData).toBe(1);
    expect(resultado.erros).toBe(0);
    expect(resultado.filasEsgotadas).toBe(0);

    // o slot fica registrado, para não ser tentado de novo nem virar "perdido".
    // A pasta nasce com slots anteriores já vencidos, então o filtro é pela data
    // do slot desta rodada, não pela primeira publicação que aparecer.
    const publicacao = await cliente().publication.findFirstOrThrow({
      where: { folderId: pasta.id, dataPrevista: new Date('2026-09-14T00:00:00.000Z') },
    });
    expect(publicacao.status).toBe('sem_texto');
    expect(publicacao.textId).toBeNull();
    expect(publicacao.erroMensagem).toBeNull();
  });

  it('o mesmo texto volta a sair no dia seguinte, o que a fila não faria', async () => {
    const pasta = await pastaPorData();
    await texto(pasta.id, 'Todo dia de setembro', null, 9);

    await rodarCiclo(cliente(), AGORA);
    // dia seguinte, mesmo horário
    await rodarCiclo(cliente(), new Date('2026-09-15T10:05:00Z'));

    expect(enviosDeTexto.map((e) => e.texto)).toEqual([
      'Todo dia de setembro',
      'Todo dia de setembro',
    ]);
  });

  it('continua idempotente: dois ciclos no mesmo slot publicam uma vez só', async () => {
    const pasta = await pastaPorData();
    await texto(pasta.id, 'É dia 14 de setembro', 14, 9);

    const [um, dois] = await Promise.all([
      rodarCiclo(cliente(), AGORA),
      rodarCiclo(cliente(), AGORA),
    ]);

    expect(enviosDeTexto).toHaveLength(1);
    expect(um.enviados + dois.enviados).toBe(1);
  });
});

describe.skipIf(!temBanco)('limite do alerta de fila curta, por pasta', () => {
  beforeAll(async () => {
    await prepararBanco();
  });

  beforeEach(async () => {
    await limpar();
    enviosDeTexto.length = 0;
    enviosDeFoto.length = 0;
  });

  afterAll(async () => {
    await cliente().$disconnect();
  });

  /** Quantos alertas de fila curta este ciclo registrou. */
  async function alertasDeFilaCurta(folderId: string) {
    const pasta = await cliente().folder.findUniqueOrThrow({ where: { id: folderId } });
    return cliente().auditLog.count({
      where: {
        acao: 'alerta',
        entidadeId: 'fila_curta',
        detalhes: { path: ['pasta'], equals: pasta.nome },
      },
    });
  }

  it('usa o número da pasta, não o cinco que era fixo', async () => {
    // três pendentes: com o antigo limite fixo de 5 isto alertaria
    const { pasta } = await montarPasta({ textos: 3, alertarAbaixoDe: 2 });

    const resultado = await rodarCiclo(cliente(), AGORA);

    expect(resultado.filasCurtas).toBe(0);
    expect(await alertasDeFilaCurta(pasta.id)).toBe(0);
  });

  it('alerta quando a fila fica abaixo do número da pasta', async () => {
    const { pasta } = await montarPasta({ textos: 3, alertarAbaixoDe: 10 });

    const resultado = await rodarCiclo(cliente(), AGORA);

    expect(resultado.filasCurtas).toBe(1);
    expect(await alertasDeFilaCurta(pasta.id)).toBe(1);
  });

  it('ZERO desliga o aviso, mesmo com um texto só na fila', async () => {
    const { pasta } = await montarPasta({ textos: 1, alertarAbaixoDe: 0 });

    const resultado = await rodarCiclo(cliente(), AGORA);

    expect(resultado.filasCurtas).toBe(0);
    expect(await alertasDeFilaCurta(pasta.id)).toBe(0);
  });
});
