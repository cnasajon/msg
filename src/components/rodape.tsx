import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { VERSAO, dataCompacta } from '@/lib/versao';

/**
 * Rodapé do site: quem fez, a versão publicada e os documentos legais.
 *
 * Um só componente para as três situações de tela — entrada, tela inicial e
 * telas internas —, porque a versão exibida precisa ser a mesma em todas: duas
 * fontes acabariam divergindo no dia em que alguém atualizasse só uma.
 */
export async function Rodape() {
  const t = await getTranslations('rodape');
  const idioma = await getLocale();

  return (
    <div className="rodape-conteudo">
      <span>{t('direitos')}</span>
      <span className="rodape-sep">•</span>
      <span>{t('versao', { versao: VERSAO, data: dataCompacta(idioma) })}</span>
      <span className="rodape-sep">|</span>
      <Link href="/privacidade">{t('privacidade')}</Link>
      <span className="rodape-sep">|</span>
      <Link href="/termos">{t('termos')}</Link>
    </div>
  );
}
