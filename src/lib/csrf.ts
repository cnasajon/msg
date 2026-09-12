import { createHmac } from 'node:crypto';
import { env } from './env';
import { NaoAutorizado } from './erros';
import { comparaSegredos, sessaoAtual } from './sessao';

/**
 * CSRF por token ligado à sessão.
 *
 * O cookie de sessão é `SameSite=Lax`, o que já barra a maior parte dos
 * ataques, mas não os que usam navegação de nível superior. O token aqui é
 * derivado do identificador da sessão com HMAC: não precisa de armazenamento,
 * não serve em outra sessão e não pode ser adivinhado sem o `SESSION_SECRET`.
 */
export function tokenCsrfPara(sessaoId: string): string {
  return createHmac('sha256', env.sessionSecret).update(`csrf:${sessaoId}`).digest('base64url');
}

export const CAMPO_CSRF = '_csrf';

/** Chamada no começo de toda server action que altera dados. */
export async function exigirCsrf(dados: FormData) {
  const sessao = await sessaoAtual();
  if (!sessao) throw new NaoAutorizado('Sessão expirada. Entre de novo.');

  const recebido = dados.get(CAMPO_CSRF);
  if (typeof recebido !== 'string' || !comparaSegredos(recebido, tokenCsrfPara(sessao.sessaoId))) {
    throw new NaoAutorizado('Requisição rejeitada por falha de verificação (CSRF).');
  }
  return sessao;
}
