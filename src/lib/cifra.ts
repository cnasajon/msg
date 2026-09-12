import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env';

/**
 * Cifra do token de sobreposição da pasta, em AES-256-GCM.
 *
 * O formato guardado é `v1.<iv>.<tag>.<texto cifrado>`, tudo em base64url. O
 * prefixo de versão existe para permitir trocar o algoritmo um dia sem ter de
 * adivinhar o formato do que já está no banco.
 *
 * Trocar a `ENCRYPTION_KEY` invalida o que já foi cifrado — é o preço de não
 * guardar a chave junto com o dado, e está avisado na especificação.
 */

const PREFIXO = 'v1';

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', env.encryptionKey, iv);
  const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  const tag = cifrador.getAuthTag();
  return [PREFIXO, iv.toString('base64url'), tag.toString('base64url'), cifrado.toString('base64url')].join('.');
}

export function decifrar(guardado: string): string {
  const partes = guardado.split('.');
  if (partes.length !== 4 || partes[0] !== PREFIXO) {
    throw new Error('Valor cifrado em formato desconhecido.');
  }
  const [, iv, tag, cifrado] = partes as [string, string, string, string];
  const decifrador = createDecipheriv('aes-256-gcm', env.encryptionKey, Buffer.from(iv, 'base64url'));
  decifrador.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decifrador.update(Buffer.from(cifrado, 'base64url')),
    decifrador.final(),
  ]).toString('utf8');
}

/**
 * O que a interface mostra no lugar do token: nunca o valor, só os últimos
 * caracteres, o bastante para a pessoa reconhecer qual token está ali.
 */
export function mascarar(token: string): string {
  const fim = token.slice(-4);
  return `${'•'.repeat(16)}${fim}`;
}
