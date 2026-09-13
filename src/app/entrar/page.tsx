import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Marca } from '@/components/marca';
import { BotaoTema } from '@/components/tema';
import { sessaoAtual } from '@/lib/sessao';
import { VERSAO, dataDaPublicacao } from '@/lib/versao';
import { FormularioDeLogin } from './formulario';
import { SeletorDeIdioma } from '@/components/seletor-idioma';

export const dynamic = 'force-dynamic';

export default async function Entrar() {
  if (await sessaoAtual()) redirect('/inicio');
  const t = await getTranslations('entrada');
  const comum = await getTranslations('comum');
  const idioma = await getLocale();

  return (
    <>
      <div className="mockctl floating" style={{ position: 'fixed', top: 14, right: 16 }}>
        <SeletorDeIdioma />
        <BotaoTema />
      </div>
      <div className="auth">
        <div className="box">
          <div className="brand">
            <Marca />
            <div>
              <div className="name">msg</div>
              <div className="env">msg.oa12.org</div>
            </div>
          </div>
          <div className="card">
            <div className="body">
              <FormularioDeLogin />
              <p style={{ margin: '14px 0 0', textAlign: 'center' }}>
                <Link href="/esqueci">{t('esqueceu')}</Link>
              </p>
              <p className="faint" style={{ margin: '6px 0 0', textAlign: 'center' }}>
                {t('semCadastro')}
              </p>
              <p className="faint" style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 11.5 }}>
                {comum('versaoEData', { versao: VERSAO, data: dataDaPublicacao(idioma) })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
