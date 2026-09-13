/**
 * Leitura das variáveis de ambiente.
 *
 * Regras que valem para o arquivo inteiro:
 *  - nenhum valor padrão de segredo, nunca;
 *  - o que é obrigatório falha cedo e com mensagem clara, no boot;
 *  - `ALERTS_CHAT_ID` e `GOOGLE_CHAT_WEBHOOK` podem estar vazios sem
 *    quebrar o deploy (seção 7.4 da especificação).
 */

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim() === '') {
    throw new Error(
      `Variável de ambiente ${nome} não está definida. ` +
        'Cadastre-a no painel do Railway (ou no .env local) antes de subir o serviço.',
    );
  }
  return valor;
}

function opcional(nome: string): string | null {
  const valor = process.env[nome];
  return valor && valor.trim() !== '' ? valor.trim() : null;
}

function numero(nome: string, padrao: number): number {
  const valor = process.env[nome];
  if (!valor) return padrao;
  const n = Number(valor);
  if (!Number.isFinite(n)) throw new Error(`Variável ${nome} deve ser um número, e veio "${valor}".`);
  return n;
}

/** Chave de 32 bytes para AES-256-GCM, aceita em base64 ou hex. */
export function chaveDeCifra(valor: string): Buffer {
  const bruto = /^[0-9a-fA-F]{64}$/.test(valor)
    ? Buffer.from(valor, 'hex')
    : Buffer.from(valor, 'base64');
  if (bruto.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY deve ter 32 bytes. Gere com: openssl rand -base64 32',
    );
  }
  return bruto;
}

export const env = {
  get databaseUrl() {
    return obrigatoria('DATABASE_URL');
  },
  get appUrl() {
    return process.env.APP_URL ?? 'http://localhost:3000';
  },
  get sessionSecret() {
    return obrigatoria('SESSION_SECRET');
  },
  get encryptionKey() {
    return chaveDeCifra(obrigatoria('ENCRYPTION_KEY'));
  },
  get telegramBotToken() {
    return obrigatoria('TELEGRAM_BOT_TOKEN');
  },
  /**
   * Endereço da Bot API. Em produção é sempre o do Telegram; existe como
   * variável para que a verificação de ponta a ponta aponte para um servidor
   * local e exercite o dispatcher sem tocar em grupo nenhum.
   */
  get telegramApiBase() {
    return opcional('TELEGRAM_API_BASE') ?? 'https://api.telegram.org';
  },
  get maxImageMb() {
    return numero('MAX_IMAGE_MB', 2);
  },
  get producao() {
    return process.env.NODE_ENV === 'production';
  },
  /**
   * Cookie com a marca `Secure` só faz sentido sobre HTTPS — é o esquema da
   * APP_URL que decide, não o NODE_ENV. Em produção a aplicação é
   * `https://msg.oa12.org` e o cookie vai marcado; em `http://localhost` a
   * marca só atrapalha: o navegador trata o envio como caso de exceção e nem
   * sempre manda o cookie de volta.
   */
  get cookieSeguro() {
    return (process.env.APP_URL ?? '').startsWith('https://');
  },
  /** Destino de alerta vindo do ambiente — pode ser nulo (seção 7.4). */
  get alertsChatId() {
    return opcional('ALERTS_CHAT_ID');
  },
  get googleChatWebhook() {
    return opcional('GOOGLE_CHAT_WEBHOOK');
  },
  get dispatchIntervalMinutes() {
    return numero('DISPATCH_INTERVAL_MINUTES', 5);
  },
  get dispatchGraceMinutes() {
    return numero('DISPATCH_GRACE_MINUTES', 30);
  },
};
