import { getLocale, getTranslations } from 'next-intl/server';
import { textoDoProblema, type Problema } from './avisos';

/**
 * Tradutor das faixas de aviso, para uso nas ações de servidor.
 *
 * As mensagens são traduzidas na ação, não na tela de destino: a ação sabe o
 * idioma de quem pediu, e o que viaja na URL de volta já é a frase final. Sem
 * isso o parâmetro `?erro=` teria de carregar chave e valores, e a montagem da
 * frase ficaria espalhada por todas as telas.
 */
export type Tradutor = (chave: string, valores?: Record<string, string | number>) => string;

export async function tradutorDeAvisos(): Promise<{
  t: Tradutor;
  frase: (problema: Problema) => string;
}> {
  const t = (await getTranslations('avisos')) as Tradutor;
  const idioma = await getLocale();
  return { t, frase: (problema) => textoDoProblema(problema, t, idioma) };
}
