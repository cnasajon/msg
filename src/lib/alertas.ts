import type { PrismaClient } from '@prisma/client';
import { env } from './env';
import { enviarTexto } from './telegram';

/**
 * Alertas operacionais, com a precedencia da secao 7.4:
 *
 *   1. `settings.alerts_chat_id`, preenchido na interface;
 *   2. senao a variavel de ambiente `ALERTS_CHAT_ID`;
 *   3. senao apenas o log da aplicacao e o painel.
 *
 * A razao do arranjo: a variavel de ambiente e o destino garantido, que
 * continua funcionando **quando o proprio banco esta inacessivel** — que e
 * justamente quando o alerta e mais necessario. Por isso a leitura de
 * `settings` aqui e envolvida em try/catch e nunca impede o envio.
 *
 * Duas regras que valem para o arquivo inteiro:
 *  - **a falha de um canal nunca interrompe a publicacao nem gera novo alerta**,
 *    so registro no log;
 *  - os dois destinos podem estar vazios sem quebrar nada.
 */

export type TipoDeAlerta =
  | 'falha_publicacao'
  | 'slot_perdido'
  | 'fila_esgotada'
  | 'fila_curta'
  | 'autenticacao_bot';

export const TITULO_DO_ALERTA: Record<TipoDeAlerta, string> = {
  falha_publicacao: 'Falha definitiva de publicacao',
  slot_perdido: 'Slot perdido',
  fila_esgotada: 'Fila esgotada',
  fila_curta: 'Fila curta',
  autenticacao_bot: 'Falha de autenticacao do bot',
};

export type OrigemDoDestino = 'settings' | 'ambiente' | 'nenhum';

export type DestinoDosAlertas = {
  chatId: string | null;
  webhook: string | null;
  origemDoChat: OrigemDoDestino;
  origemDoWebhook: OrigemDoDestino;
  /** Verdadeiro quando o banco nao respondeu e valeu so o ambiente. */
  bancoInacessivel: boolean;
};

/**
 * Resolve o destino seguindo a precedencia. Nunca lanca: um alerta que morre
 * porque a consulta do destino falhou e pior do que um alerta sem destino.
 */
export async function destinoDosAlertas(prisma?: PrismaClient | null): Promise<DestinoDosAlertas> {
  const doAmbienteChat = env.alertsChatId;
  const doAmbienteWebhook = env.googleChatWebhook;

  let daBaseChat: string | null = null;
  let daBaseWebhook: string | null = null;
  let bancoInacessivel = false;

  if (prisma) {
    try {
      const configuracao = await prisma.settings.findUnique({ where: { id: 'singleton' } });
      daBaseChat = configuracao?.alertsChatId?.trim() || null;
      daBaseWebhook = configuracao?.googleChatWebhook?.trim() || null;
    } catch {
      // banco fora do ar: seguimos com o que veio do ambiente
      bancoInacessivel = true;
    }
  }

  const chatId = daBaseChat ?? doAmbienteChat;
  const webhook = daBaseWebhook ?? doAmbienteWebhook;

  return {
    chatId,
    webhook,
    origemDoChat: daBaseChat ? 'settings' : doAmbienteChat ? 'ambiente' : 'nenhum',
    origemDoWebhook: daBaseWebhook ? 'settings' : doAmbienteWebhook ? 'ambiente' : 'nenhum',
    bancoInacessivel,
  };
}

export type PedidoDeAlerta = {
  tipo: TipoDeAlerta;
  mensagem: string;
  organizationId?: string | null;
  pasta?: string | null;
  /** Nao repetir o mesmo alerta desta pasta antes deste intervalo. */
  repetirAposHoras?: number;
};

export type ResultadoDoAlerta = {
  enviadoAoTelegram: boolean;
  enviadoAoGoogleChat: boolean;
  registradoNoPainel: boolean;
  destino: DestinoDosAlertas;
  repetido: boolean;
};

export async function alertar(
  prisma: PrismaClient | null,
  pedido: PedidoDeAlerta,
): Promise<ResultadoDoAlerta> {
  const destino = await destinoDosAlertas(prisma);

  if (prisma && pedido.repetirAposHoras && (await alertadoRecentemente(prisma, pedido))) {
    return {
      enviadoAoTelegram: false,
      enviadoAoGoogleChat: false,
      registradoNoPainel: false,
      destino,
      repetido: true,
    };
  }

  const titulo = TITULO_DO_ALERTA[pedido.tipo];
  const corpo = [`<b>msg — ${titulo}</b>`, pedido.pasta ? `Pasta: ${pedido.pasta}` : null, pedido.mensagem]
    .filter(Boolean)
    .join('\n');

  // O log sempre acontece, com destino ou sem ele: e o terceiro nivel da
  // precedencia e a unica coisa que nao depende de rede nem de banco.
  console.log(
    JSON.stringify({
      servico: 'alerta',
      em: new Date().toISOString(),
      tipo: pedido.tipo,
      pasta: pedido.pasta ?? null,
      mensagem: pedido.mensagem,
      destino: destino.origemDoChat,
      bancoInacessivel: destino.bancoInacessivel,
    }),
  );

  let enviadoAoTelegram = false;
  if (destino.chatId) {
    try {
      const resposta = await enviarTexto(env.telegramBotToken, destino.chatId, corpo);
      enviadoAoTelegram = resposta.ok;
      if (!resposta.ok) {
        console.log(
          JSON.stringify({ servico: 'alerta', em: new Date().toISOString(), canal: 'telegram', falhou: resposta.problema.chave }),
        );
      }
    } catch (erro) {
      console.log(
        JSON.stringify({
          servico: 'alerta',
          em: new Date().toISOString(),
          canal: 'telegram',
          falhou: erro instanceof Error ? erro.message : String(erro),
        }),
      );
    }
  }

  let enviadoAoGoogleChat = false;
  if (destino.webhook) {
    try {
      const resposta = await fetch(destino.webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: `msg — ${titulo}\n${pedido.pasta ? `Pasta: ${pedido.pasta}\n` : ''}${pedido.mensagem}` }),
        signal: AbortSignal.timeout(15_000),
      });
      enviadoAoGoogleChat = resposta.ok;
    } catch (erro) {
      console.log(
        JSON.stringify({
          servico: 'alerta',
          em: new Date().toISOString(),
          canal: 'google-chat',
          falhou: erro instanceof Error ? erro.message : String(erro),
        }),
      );
    }
  }

  // Registro para o painel. E o ultimo passo de proposito: se o banco estiver
  // fora, o alerta ja saiu pelos outros canais.
  let registradoNoPainel = false;
  if (prisma) {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: pedido.organizationId ?? null,
          acao: 'alerta',
          entidade: 'alerta',
          entidadeId: pedido.tipo,
          detalhes: {
            tipo: pedido.tipo,
            titulo,
            pasta: pedido.pasta ?? null,
            mensagem: pedido.mensagem,
            destino: destino.origemDoChat,
            enviadoAoTelegram,
            enviadoAoGoogleChat,
          },
        },
      });
      registradoNoPainel = true;
    } catch {
      // banco inacessivel: o alerta ja foi pelos canais que nao dependem dele
    }
  }

  return { enviadoAoTelegram, enviadoAoGoogleChat, registradoNoPainel, destino, repetido: false };
}

async function alertadoRecentemente(prisma: PrismaClient, pedido: PedidoDeAlerta): Promise<boolean> {
  try {
    const desde = new Date(Date.now() - (pedido.repetirAposHoras ?? 24) * 3_600_000);
    const anterior = await prisma.auditLog.findFirst({
      where: {
        acao: 'alerta',
        entidadeId: pedido.tipo,
        criadoEm: { gte: desde },
        ...(pedido.pasta ? { detalhes: { path: ['pasta'], equals: pedido.pasta } } : {}),
      },
      select: { id: true },
    });
    return anterior !== null;
  } catch {
    return false;
  }
}
