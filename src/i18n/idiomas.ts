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

/**
 * Bandeira de cada idioma, para achar a opção certa sem ler.
 *
 * São pares de indicadores regionais, não imagens: o navegador é quem desenha.
 * O Windows não traz a fonte de bandeiras, e ali aparecem as duas letras do país
 * — "🇧🇷" vira "BR". Fica legível de qualquer forma, que é o que importa; trocar
 * por ícones em arquivo custaria três imagens e uma requisição por tela para
 * resolver só a estética em um sistema.
 */
export const BANDEIRA_DO_IDIOMA: Record<Idioma, string> = {
  pt: '🇧🇷',
  es: '🇪🇸',
  en: '🇬🇧',
};

/** Rótulo do idioma como ele aparece em qualquer seletor da aplicação. */
export function nomeComBandeira(codigo: Idioma): string {
  return `${BANDEIRA_DO_IDIOMA[codigo]} ${NOME_DO_IDIOMA[codigo]}`;
}

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
  'usuarios',
] as const;
