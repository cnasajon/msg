/**
 * Monta o endereço de volta de uma ação, com a faixa de aviso.
 *
 * Existe porque concatenar `?erro=…` num destino que já tinha `?pasta=…`
 * produz uma URL com dois pontos de interrogação: o navegador engole, mas o
 * segundo vira parte do valor do primeiro parâmetro, e a mensagem simplesmente
 * não aparece na tela.
 */
export function comAviso(destino: string, tipo: 'erro' | 'ok', mensagem: string): string {
  const [caminho = '/', consulta] = destino.split('?');
  const parametros = new URLSearchParams(consulta ?? '');
  // uma faixa por vez: sucesso e erro juntos não fazem sentido
  parametros.delete('erro');
  parametros.delete('ok');
  parametros.set(tipo, mensagem);
  return `${caminho}?${parametros.toString()}`;
}
