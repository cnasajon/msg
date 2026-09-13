import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Marca } from '@/components/marca';
import { BotaoTema } from '@/components/tema';
import { sessaoAtual } from '@/lib/sessao';
import { Rodape } from '@/components/rodape';
import { FormularioDeLogin } from './formulario';
import { SeletorDeIdioma } from '@/components/seletor-idioma';

export const dynamic = 'force-dynamic';

export default async function Entrar() {
  if (await sessaoAtual()) redirect('/inicio');
  const t = await getTranslations('entrada');

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

            </div>
          </div>
        </div>
        <footer className="rodape rodape-entrada">
          <Rodape />
        </footer>
      </div>
    </>
  );
}
