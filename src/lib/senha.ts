import { problema, type Problema } from './avisos';
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

/**
 * Regras mínimas de senha: pelo menos 8 caracteres, com uma letra maiúscula, um
 * número e um caractere especial. Devolve a mensagem do problema, ou `null`.
 *
 * A mensagem diz tudo que falta de uma vez, em vez de uma exigência por
 * tentativa — corrigir senha aos pedaços é o caminho mais curto para a pessoa
 * desistir e escolher algo pior.
 */
export const TAMANHO_MINIMO_DA_SENHA = 8;

export function problemaNaSenha(senha: string): Problema | null {
  if (senha.length > 200) return problema('senhaLongaDemais');
  if (/^\s|\s$/.test(senha)) return problema('senhaComEspaco');

  const faltando: string[] = [];
  if (senha.length < TAMANHO_MINIMO_DA_SENHA) faltando.push('senhaItemMinimo');
  if (!/[A-ZÀ-ÖØ-Þ]/.test(senha)) faltando.push('senhaItemMaiuscula');
  if (!/[0-9]/.test(senha)) faltando.push('senhaItemNumero');
  // especial é tudo que não for letra (com ou sem acento), número ou espaço
  if (!/[^\p{L}\p{N}\s]/u.test(senha)) faltando.push('senhaItemEspecial');

  if (faltando.length === 0) return null;
  return problema('senhaPrecisa', { minimo: TAMANHO_MINIMO_DA_SENHA }, faltando);
}

/**
 * Senha provisória legível, para o admin repassar à pessoa — em geral ditada por
 * telefone ou mensagem, daí a ausência de caracteres ambíguos e os grupos de
 * quatro. Sai sempre dentro da política acima: os hífens cobrem o caractere
 * especial, e o sorteio é repetido até cair uma maiúscula e um número.
 */
export function gerarSenhaProvisoria(): string {
  // sem caracteres ambíguos (l, 1, I, O, 0)
  const alfabeto = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let sorteado = '';
    for (const b of bytes) sorteado += alfabeto[b % alfabeto.length];

    const senha = `${sorteado.slice(0, 4)}-${sorteado.slice(4, 8)}-${sorteado.slice(8, 12)}-${sorteado.slice(12, 16)}`;
    if (problemaNaSenha(senha) === null) return senha;
  }
  // com 16 sorteios sobre este alfabeto, chegar aqui é praticamente impossível
  throw new Error('Não foi possível gerar uma senha provisória dentro da política.');
}
