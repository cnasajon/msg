/**
 * Precedencia do destino dos alertas (secao 7.4):
 *   settings -> variavel de ambiente -> apenas log e painel.
 *
 * O caso que mais importa e o ultimo teste: **com o banco inacessivel o alerta
 * ainda sai**, pela variavel de ambiente. E para isso que a precedencia existe.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { prepararBanco, limpar, cliente, temBanco } from './helpers/banco';

const enviados: { chatId: string; texto: string }[] = [];
let recusarEnvio = false;

vi.mock('@/lib/telegram', async () => {
  const real = await vi.importActual<typeof import('@/lib/telegram')>('@/lib/telegram');
  return {
    ...real,
    enviarTexto: async (_token: string, chatId: string, texto: string) => {
      if (recusarEnvio) return { ok: false as const, erro: 'chat not found', descricao: 'chat not found' };
      enviados.push({ chatId, texto });
      return { ok: true as const, messageId: '1' };
    },
  };
});

const { alertar, destinoDosAlertas } = await import('@/lib/alertas');

/** Um cliente cujo acesso ao banco sempre falha, para simular o pior momento. */
function bancoForaDoAr() {
  const erro = () => Promise.reject(new Error('Can\'t reach database server'));
  return {
    settings: { findUnique: erro },
    auditLog: { create: erro, findFirst: erro },
  } as unknown as Parameters<typeof alertar>[0];
}

describe('precedencia do destino dos alertas', () => {
  const ambienteOriginal = { ...process.env };

  beforeEach(() => {
    enviados.length = 0;
    recusarEnvio = false;
    delete process.env.ALERTS_CHAT_ID;
    delete process.env.GOOGLE_CHAT_WEBHOOK;
  });

  afterAll(() => {
    process.env = { ...ambienteOriginal };
  });

  it('3. sem nada configurado, o alerta fica no log e no painel', async () => {
    const destino = await destinoDosAlertas(null);
    expect(destino.chatId).toBeNull();
    expect(destino.origemDoChat).toBe('nenhum');

    const resultado = await alertar(null, { tipo: 'fila_curta', mensagem: 'teste' });
    expect(resultado.enviadoAoTelegram).toBe(false);
    expect(enviados).toHaveLength(0);
  });

  it('2. com a variavel de ambiente preenchida, o alerta vai para ela', async () => {
    process.env.ALERTS_CHAT_ID = '-100999';

    const destino = await destinoDosAlertas(null);
    expect(destino.chatId).toBe('-100999');
    expect(destino.origemDoChat).toBe('ambiente');

    const resultado = await alertar(null, { tipo: 'fila_curta', mensagem: 'teste' });
    expect(resultado.enviadoAoTelegram).toBe(true);
    expect(enviados[0]!.chatId).toBe('-100999');
  });

  it('o deploy nao quebra com as duas configuracoes vazias', async () => {
    process.env.ALERTS_CHAT_ID = '';
    process.env.GOOGLE_CHAT_WEBHOOK = '';

    const destino = await destinoDosAlertas(null);
    expect(destino.chatId).toBeNull();
    expect(destino.webhook).toBeNull();
    await expect(alertar(null, { tipo: 'fila_curta', mensagem: 'teste' })).resolves.toBeTruthy();
  });

  it('O BANCO FORA DO AR NAO CALA O ALERTA: a variavel de ambiente assume', async () => {
    process.env.ALERTS_CHAT_ID = '-100777';

    const destino = await destinoDosAlertas(bancoForaDoAr());
    expect(destino.chatId).toBe('-100777');
    expect(destino.origemDoChat).toBe('ambiente');
    expect(destino.bancoInacessivel).toBe(true);

    const resultado = await alertar(bancoForaDoAr(), {
      tipo: 'falha_publicacao',
      mensagem: 'banco fora do ar',
    });
    expect(resultado.enviadoAoTelegram).toBe(true);
    expect(resultado.registradoNoPainel).toBe(false); // nao ha banco para registrar
    expect(enviados[0]!.chatId).toBe('-100777');
  });

  it('falha de canal nao derruba o alerta nem gera excecao', async () => {
    process.env.ALERTS_CHAT_ID = '-100555';
    recusarEnvio = true;

    const resultado = await alertar(null, { tipo: 'slot_perdido', mensagem: 'teste' });
    expect(resultado.enviadoAoTelegram).toBe(false);
  });
});

describe.skipIf(!temBanco)('precedencia com banco', () => {
  beforeAll(async () => {
    await prepararBanco();
  });

  beforeEach(async () => {
    await limpar();
    enviados.length = 0;
    recusarEnvio = false;
    delete process.env.ALERTS_CHAT_ID;
  });

  afterAll(async () => {
    await cliente().$disconnect();
  });

  it('1. settings tem precedencia sobre a variavel de ambiente', async () => {
    process.env.ALERTS_CHAT_ID = '-100111';
    await cliente().settings.create({ data: { id: 'singleton', alertsChatId: '-100222' } });

    const destino = await destinoDosAlertas(cliente());
    expect(destino.chatId).toBe('-100222');
    expect(destino.origemDoChat).toBe('settings');

    await alertar(cliente(), { tipo: 'fila_curta', mensagem: 'teste' });
    expect(enviados[0]!.chatId).toBe('-100222');
  });

  it('settings vazio cai para a variavel de ambiente', async () => {
    process.env.ALERTS_CHAT_ID = '-100111';
    await cliente().settings.create({ data: { id: 'singleton', alertsChatId: '   ' } });

    const destino = await destinoDosAlertas(cliente());
    expect(destino.chatId).toBe('-100111');
    expect(destino.origemDoChat).toBe('ambiente');
  });

  it('o alerta fica registrado para o painel', async () => {
    await alertar(cliente(), { tipo: 'fila_curta', pasta: 'Pasta X', mensagem: '4 textos pendentes' });

    const registro = await cliente().auditLog.findFirstOrThrow({ where: { acao: 'alerta' } });
    expect(registro.entidadeId).toBe('fila_curta');
    expect(JSON.stringify(registro.detalhes)).toContain('Pasta X');
  });

  it('alerta repetido dentro da janela nao vira spam', async () => {
    const pedido = { tipo: 'fila_curta' as const, pasta: 'Pasta Y', mensagem: 'de novo', repetirAposHoras: 24 };

    const primeiro = await alertar(cliente(), pedido);
    const segundo = await alertar(cliente(), pedido);

    expect(primeiro.repetido).toBe(false);
    expect(segundo.repetido).toBe(true);
  });

  it('outra pasta com o mesmo tipo continua alertando', async () => {
    const base = { tipo: 'fila_curta' as const, mensagem: 'fila curta', repetirAposHoras: 24 };

    await alertar(cliente(), { ...base, pasta: 'Pasta A' });
    const outra = await alertar(cliente(), { ...base, pasta: 'Pasta B' });

    expect(outra.repetido).toBe(false);
  });
});
