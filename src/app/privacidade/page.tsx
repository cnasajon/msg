import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PaginaLegal } from '@/components/pagina-legal';
import { dataDaPublicacao } from '@/lib/versao';
import { getLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('privacidade');
  return { title: `${t('titulo')} · msg`, description: t('resumo') };
}

/** As seções, na ordem em que são lidas. */
const SECOES = ['queDados', 'paraQue', 'comQuem', 'cookies', 'porQuantoTempo', 'seusDireitos', 'contato'] as const;

export default async function Privacidade() {
  const t = await getTranslations('privacidade');
  const idioma = await getLocale();

  return (
    <PaginaLegal
      titulo={t('titulo')}
      atualizadoEm={t('atualizadoEm', { data: dataDaPublicacao(idioma) })}
      secoes={SECOES.map((chave) => ({ titulo: t(`${chave}Titulo`), corpo: t(`${chave}Corpo`) }))}
    />
  );
}
