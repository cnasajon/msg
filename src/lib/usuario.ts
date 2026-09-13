import { problema, type Problema } from './avisos';

/**
 * Nome de usuário — a credencial de entrada.
 *
 * O e-mail deixou de ser o login porque o sistema não envia e-mail nenhum: virou
 * um dado cadastral como o telefone. Quem entra digita um nome curto, e a regra
 * aqui é a do que se digita sem pensar: minúsculas, sem espaço e sem acento —
 * `josé` e `jose` seriam duas contas diferentes para o banco e a mesma pessoa
 * para quem olha.
 */
export const TAMANHO_MINIMO_DO_USERNAME = 3;
export const TAMANHO_MAXIMO_DO_USERNAME = 32;

/** Tira espaço das pontas e baixa a caixa: `Ana.Silva ` e `ana.silva` são o mesmo login. */
export function normalizarUsername(bruto: string): string {
  return bruto.trim().toLowerCase();
}

export function problemaNoUsername(username: string): Problema | null {
  if (username.length < TAMANHO_MINIMO_DO_USERNAME || username.length > TAMANHO_MAXIMO_DO_USERNAME) {
    return problema('usernameTamanho', {
      minimo: TAMANHO_MINIMO_DO_USERNAME,
      maximo: TAMANHO_MAXIMO_DO_USERNAME,
    });
  }
  // começa e termina em letra ou número; no meio aceita ponto, hífen e sublinhado
  if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(username)) return problema('usernameFormato');
  return null;
}
