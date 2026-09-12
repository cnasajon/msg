import { hash, verify } from '@node-rs/argon2';

/**
 * Senhas com argon2id. Os parâmetros seguem a recomendação do OWASP para
 * argon2id (19 MiB, 2 iterações, paralelismo 1) — o custo de memória é o que
 * dificulta o ataque por GPU.
 */
// `Algorithm` é um const enum do pacote nativo e não sobrevive ao
// `isolatedModules` do Next; 2 é o valor de Argon2id.
const ARGON2ID = 2;

const OPCOES = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function gerarHashDeSenha(senha: string): Promise<string> {
  return hash(senha, OPCOES);
}

export async function senhaConfere(senha: string, hashArmazenado: string): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha, OPCOES);
  } catch {
    // hash corrompido ou em formato desconhecido: não autentica, não explode
    return false;
  }
}

/** Regras mínimas de senha. Devolve a mensagem do problema, ou `null`. */
export function problemaNaSenha(senha: string): string | null {
  if (senha.length < 12) return 'A senha precisa ter pelo menos 12 caracteres.';
  if (senha.length > 200) return 'A senha é longa demais.';
  if (/^\s|\s$/.test(senha)) return 'A senha não pode começar nem terminar com espaço.';
  return null;
}

/** Senha provisória legível, para o admin repassar à pessoa. */
export function gerarSenhaProvisoria(): string {
  // sem caracteres ambíguos (l, 1, I, O, 0) — a senha costuma ser ditada
  const alfabeto = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let saida = '';
  for (const b of bytes) saida += alfabeto[b % alfabeto.length];
  return `${saida.slice(0, 4)}-${saida.slice(4, 8)}-${saida.slice(8, 12)}-${saida.slice(12, 16)}`;
}
