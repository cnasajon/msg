/**
 * Versão publicada e a data em que ela foi para o ar.
 *
 * Mantida à mão, e não derivada do `package.json` ou do git: o que interessa a
 * quem olha o rodapé é "que versão estou usando e de quando ela é", e isso é
 * uma decisão editorial a cada entrega — não o número que o npm carrega nem o
 * hash do último commit, que mudam por motivos que não dizem nada ao usuário.
 *
 * A regra combinada: alteração menor sobe o dígito depois do ponto; alteração
 * maior sobe o de antes, e essa é decisão do dono do produto. A data é a do
 * commit que publica.
 */
export const VERSAO = '1.0';

/** Data da publicação desta versão, em ISO — a exibição segue o idioma de quem olha. */
export const PUBLICADA_EM = '2026-09-13';

/** `13/09/2026` em pt, `13/09/2026` em es, `09/13/2026` em en. */
export function dataDaPublicacao(idioma: string): string {
  const [ano, mes, dia] = PUBLICADA_EM.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia)).toLocaleDateString(idioma, { timeZone: 'UTC' });
}
