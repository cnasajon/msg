/**
 * Constantes de idioma, sem nenhuma dependência de servidor.
 *
 * Vive separado de `request.ts` porque o seletor de idioma é componente de
 * cliente: importar dali arrastaria `next/headers` para o navegador, e o build
 * quebra.
 */

export const IDIOMAS = ['pt', 'es', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];
export const IDIOMA_PADRAO: Idioma = 'pt';
export const COOKIE_DE_IDIOMA = 'msg_idioma';

export const NOME_DO_IDIOMA: Record<Idioma, string> = {
  pt: 'Português',
  es: 'Español',
  en: 'English',
};

export function idiomaValido(valor: string | null | undefined): Idioma | null {
  return valor && IDIOMAS.includes(valor as Idioma) ? (valor as Idioma) : null;
}
