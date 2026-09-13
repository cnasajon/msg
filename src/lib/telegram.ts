import { problema, type Problema } from './avisos';
import { env } from './env';
import { decifrar } from './cifra';

/**
 * Integração com a Bot API. Sem biblioteca intermediária: são três chamadas.
 *
 * Duas regras que valem para o arquivo inteiro:
 *  - **nenhum token entra em log ou em mensagem de erro** — as URLs são
 *    montadas na hora e as mensagens devolvidas são as da API, sem o endereço;
 *  - os envios são **serializados**, porque com bot único todas as pastas
 *    dividem a mesma cota de taxa da API.
 */



export type ResultadoDoEnvio =
  | { ok: true; messageId: string }
  | { ok: false; erro: string; descricao: string };

/** Token efetivo de uma pasta: a sobreposição, se houver, senão o bot global. */
export function tokenDaPasta(pasta: { telegramBotTokenCifrado: string | null }): string {
  if (pasta.telegramBotTokenCifrado) return decifrar(pasta.telegramBotTokenCifrado);
  return env.telegramBotToken;
}

/**
 * Traduz o erro da API para algo que o administrador consiga agir. A descrição
 * original vai junto, porque é ela que ajuda quando o caso é incomum.
 */
export function explicarErro(descricao: string): string {
  const d = descricao.toLowerCase();
  if (d.includes('chat not found')) {
    return 'Grupo não encontrado. Confira o chat_id — ele muda quando um grupo comum vira supergroup.';
  }
  if (d.includes('bot was kicked')) {
    return 'O bot foi removido do grupo. Adicione-o de novo e tente outra vez.';
  }
  if (d.includes('not enough rights')) {
    return 'O bot está no grupo, mas sem permissão para enviar mensagens. Em canais ele precisa ser administrador.';
  }
  if (d.includes('unauthorized')) {
    return 'Token do bot inválido ou revogado.';
  }
  if (d.includes('bot is not a member')) {
    return 'O bot não é membro deste grupo.';
  }
  if (d.includes('message caption is too long')) {
    return 'A legenda passou de 1024 caracteres, o limite do Telegram para texto com imagem.';
  }
  if (d.includes('message is too long')) {
    return 'O texto passou de 4096 caracteres, o limite do Telegram.';
  }
  if (d.includes('too many requests')) {
    return 'Limite de envios da API atingido. O sistema tenta de novo em instantes.';
  }
  return descricao;
}

/**
 * Fila de um só: as chamadas entram em sequência. Não substitui a espera do
 * `retry_after` da API, que o dispatcher trata na fase 3 — evita apenas o
 * disparo simultâneo quando várias pastas caem no mesmo minuto.
 */
let filaDeEnvio: Promise<unknown> = Promise.resolve();

function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
  const proxima = filaDeEnvio.then(tarefa, tarefa);
  // a fila não pode morrer por causa de uma falha isolada
  filaDeEnvio = proxima.then(
    () => undefined,
    () => undefined,
  );
  return proxima;
}

async function chamar(
  token: string,
  metodo: string,
  corpo: FormData | Record<string, unknown>,
): Promise<{ ok: boolean; result?: { message_id?: number; username?: string }; description?: string }> {
  const requisicao: RequestInit =
    corpo instanceof FormData
      ? { method: 'POST', body: corpo }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(corpo),
        };

  try {
    const resposta = await fetch(`${env.telegramApiBase}/bot${token}/${metodo}`, {
      ...requisicao,
      signal: AbortSignal.timeout(30_000),
    });
    return (await resposta.json()) as { ok: boolean; description?: string };
  } catch (erro) {
    // Falha de rede não é resposta da API; devolve no mesmo formato. A causa vai
    // para o log — sem a URL, que carrega o token —, porque "não foi possível
    // falar com a API" sozinho não diz nada a quem precisa consertar.
    const causa = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
    console.log(
      JSON.stringify({
        servico: 'telegram',
        em: new Date().toISOString(),
        metodo,
        falhouEm: 'rede',
        causa,
      }),
    );
    return {
      ok: false,
      description:
        erro instanceof Error && erro.name === 'TimeoutError'
          ? 'A API do Telegram não respondeu a tempo.'
          : `Não foi possível falar com a API do Telegram (${causa}).`,
    };
  }
}

export function enviarTexto(token: string, chatId: string, texto: string): Promise<ResultadoDoEnvio> {
  return enfileirar(async () => {
    const resposta = await chamar(token, 'sendMessage', {
      chat_id: chatId,
      text: texto,
      parse_mode: 'HTML',
    });
    return resposta.ok
      ? ({ ok: true, messageId: String(resposta.result?.message_id ?? '') } as const)
      : ({
          ok: false,
          erro: explicarErro(resposta.description ?? ''),
          descricao: resposta.description ?? '',
        } as const);
  });
}

export function enviarFoto(
  token: string,
  chatId: string,
  imagem: Uint8Array,
  mime: string,
  legenda: string,
): Promise<ResultadoDoEnvio> {
  return enfileirar(async () => {
    const dados = new FormData();
    dados.set('chat_id', chatId);
    dados.set('caption', legenda);
    dados.set('parse_mode', 'HTML');
    dados.set('photo', new Blob([imagem as unknown as BlobPart], { type: mime }), 'imagem');

    const resposta = await chamar(token, 'sendPhoto', dados);
    return resposta.ok
      ? ({ ok: true, messageId: String(resposta.result?.message_id ?? '') } as const)
      : ({
          ok: false,
          erro: explicarErro(resposta.description ?? ''),
          descricao: resposta.description ?? '',
        } as const);
  });
}

/** Confere o token, sem tocar em nenhum grupo. */
export async function conferirBot(token: string): Promise<{ ok: boolean; username?: string; erro?: string }> {
  const resposta = await chamar(token, 'getMe', {});
  if (!resposta.ok) return { ok: false, erro: explicarErro(resposta.description ?? '') };
  return { ok: true, username: resposta.result?.username };
}

/**
 * Formato aceito de chat_id: número, com o `-100` dos supergrupos.
 *
 * O engano mais comum — e caro, porque só aparece como `chat not found` na hora
 * de publicar — é copiar o número sem o sinal de menos. Grupo e supergrupo
 * sempre têm id negativo; positivo é conversa privada. Então um `1001492357816`
 * é recusado aqui, com a correção escrita na mensagem, em vez de virar uma
 * falha de publicação três dias depois.
 */
export function problemaNoChatId(valor: string): Problema | null {
  if (!/^-?\d{5,20}$/.test(valor)) return problema('chatIdNaoNumerico');
  if (/^100\d{9,}$/.test(valor)) return problema('chatIdSemMenos', { sugestao: `-${valor}` });
  if (!valor.startsWith('-')) return problema('chatIdPositivo');
  return null;
}
