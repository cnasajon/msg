import { createHash } from 'node:crypto';

/**
 * Regras dos textos: os dois limites de tamanho, o hash que detecta duplicata
 * na importação e a validação das tags que o Telegram aceita.
 */

/** Texto sozinho vai como mensagem. */
export const LIMITE_SEM_IMAGEM = 4096;
/** Com imagem, o texto vira legenda do `sendPhoto`, e a legenda é bem menor. */
export const LIMITE_COM_IMAGEM = 1024;

export function limiteDeCaracteres(comImagem: boolean): number {
  return comImagem ? LIMITE_COM_IMAGEM : LIMITE_SEM_IMAGEM;
}

/**
 * O tamanho é medido em pontos de código, não em unidades UTF-16: o Telegram
 * conta assim, e um emoji que ocupa duas unidades vale um caractere para ele.
 */
export function tamanhoDoTexto(texto: string): number {
  return [...texto].length;
}

export function problemaNoTamanho(texto: string, comImagem: boolean): string | null {
  const limite = limiteDeCaracteres(comImagem);
  const tamanho = tamanhoDoTexto(texto);
  if (tamanho === 0) return 'O texto não pode ficar vazio.';
  if (tamanho <= limite) return null;

  return comImagem
    ? `Com imagem o limite é ${LIMITE_COM_IMAGEM} caracteres, e o texto tem ${tamanho}. ` +
        'Reduza o texto ou remova a imagem para voltar ao limite de 4096.'
    : `O limite é ${LIMITE_SEM_IMAGEM} caracteres, e o texto tem ${tamanho}.`;
}

/** Tags aceitas pelo `parse_mode: HTML` da Bot API. */
export const TAGS_ACEITAS = [
  'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del',
  'a', 'code', 'pre', 'span', 'tg-spoiler', 'blockquote',
] as const;

/**
 * Confere as tags usadas. Não é sanitização — o conteúdo não é renderizado como
 * HTML na nossa interface —, é para o envio não falhar no Telegram por causa de
 * uma tag que ele não conhece.
 */
export function problemaNoHtml(texto: string): string | null {
  const usadas = [...texto.matchAll(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/g)].map((m) => m[1]!.toLowerCase());
  const desconhecidas = [...new Set(usadas.filter((t) => !TAGS_ACEITAS.includes(t as never)))];
  if (desconhecidas.length > 0) {
    return `O Telegram não aceita ${desconhecidas.map((t) => `<${t}>`).join(', ')}. Aceitas: ${TAGS_ACEITAS.map((t) => `<${t}>`).join(' ')}.`;
  }

  const abertas: string[] = [];
  for (const marca of texto.matchAll(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g)) {
    const fechando = marca[1] === '/';
    const tag = marca[2]!.toLowerCase();
    if (fechando) {
      if (abertas.pop() !== tag) return `A tag <${tag}> está fechada fora de ordem ou sem abertura.`;
    } else {
      abertas.push(tag);
    }
  }
  if (abertas.length > 0) return `A tag <${abertas[abertas.length - 1]}> foi aberta e não foi fechada.`;
  return null;
}

/**
 * Hash usado para detectar duplicata dentro da pasta. Considera **apenas o
 * texto** — dois textos iguais com imagens diferentes continuam sendo o mesmo
 * texto para a importação. A normalização evita que espaço no fim ou quebra de
 * linha do Windows criem duplicatas que ninguém enxerga.
 */
export function hashDoConteudo(conteudo: string): string {
  const normalizado = conteudo.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
  return createHash('sha256').update(normalizado, 'utf8').digest('hex');
}

/** Resumo de uma linha da lista, sem HTML e sem quebra. */
export function resumir(conteudo: string, tamanho = 160): string {
  const limpo = conteudo.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return [...limpo].length <= tamanho ? limpo : `${[...limpo].slice(0, tamanho).join('')}…`;
}
