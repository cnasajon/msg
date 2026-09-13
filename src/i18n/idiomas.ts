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

/**
 * Grupos de mensagens que vão para o navegador.
 *
 * O provedor do next-intl serializa na página tudo que recebe. Mandar o arquivo
 * inteiro faria a tela inicial de um usuário comum carregar os rótulos das
 * telas de sistema — peso desnecessário e informação que aquele perfil não
 * precisa ver. Aqui ficam só os grupos que algum componente de cliente usa.
 */
export const GRUPOS_DO_CLIENTE = [
  'agendamentos',
  'alertas',
  'auditoria',
  'comum',
  'dias',
  'editor',
  'entrada',
  'esqueci',
  'importacao',
  'pastas',
  'situacoesDaLinha',
  'textos',
] as const;
