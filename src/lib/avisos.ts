/**
 * Mensagens de erro e de confirmação que a interface mostra.
 *
 * As funções de validação não traduzem: devolvem a chave e os valores, e quem
 * está perto da tela — a ação de servidor — traduz no idioma de quem pediu. Sem
 * isso, `lib/` precisaria receber um tradutor em toda função, e os testes de
 * unidade passariam a comparar frases em vez de regras.
 *
 * `itens` existe para as mensagens que enumeram o que falta ("a senha precisa
 * ter oito caracteres, uma maiúscula e um número"): cada item é uma chave, e a
 * junção usa a conjunção do idioma — "e" em português, "and" em inglês.
 */
export type Problema = {
  chave: string;
  valores?: Record<string, string | number>;
  itens?: string[];
};

export function problema(
  chave: string,
  valores?: Record<string, string | number>,
  itens?: string[],
): Problema {
  return { chave, ...(valores ? { valores } : {}), ...(itens ? { itens } : {}) };
}

/** Frase final, no idioma em vigor. */
export function textoDoProblema(
  p: Problema,
  t: (chave: string, valores?: Record<string, string | number>) => string,
  idioma: string,
): string {
  const itens = p.itens?.map((chave) => t(chave, p.valores));
  const lista = itens
    ? new Intl.ListFormat(idioma, { style: 'long', type: 'conjunction' }).format(itens)
    : undefined;

  return t(p.chave, { ...(p.valores ?? {}), ...(lista !== undefined ? { itens: lista } : {}) });
}
