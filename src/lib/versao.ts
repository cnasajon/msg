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
export const VERSAO = '1.2';

/** Data da publicação desta versão, em ISO — a exibição segue o idioma de quem olha. */
export const PUBLICADA_EM = '2026-09-16';

/** `13/09/2026` em pt, `13/09/2026` em es, `09/13/2026` em en. */
export function dataDaPublicacao(idioma: string): string {
  const [ano, mes, dia] = PUBLICADA_EM.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia)).toLocaleDateString(idioma, { timeZone: 'UTC' });
}

/**
 * A mesma data sem separadores, para o rodapé: `13092026`.
 *
 * A ordem segue o idioma de quem olha — `09132026` em inglês —, porque oito
 * dígitos seguidos sem separador só são legíveis para quem já espera aquela
 * ordem, e ninguém deveria ter de adivinhar se `09` é mês ou dia.
 */
export function dataCompacta(idioma: string): string {
  const [ano, mes, dia] = PUBLICADA_EM.split('-') as [string, string, string];
  // Montado a partir das partes, e não removendo os separadores da data
  // formatada: `toLocaleDateString` em inglês devolve `9/13/2026`, sem o zero do
  // mês, e limpar as barras daria sete dígitos em vez de oito.
  const mesPrimeiro = new Intl.DateTimeFormat(idioma)
    .formatToParts(new Date(Date.UTC(2026, 0, 2)))
    .find((parte) => parte.type === 'month' || parte.type === 'day')?.type === 'month';
  return mesPrimeiro ? `${mes}${dia}${ano}` : `${dia}${mes}${ano}`;
}
