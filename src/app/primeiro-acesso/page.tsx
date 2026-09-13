import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Marca } from '@/components/marca';
import { BotaoTema } from '@/components/tema';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { trocarSenha } from './acoes';
import { SeletorDeIdioma } from '@/components/seletor-idioma';

export const dynamic = 'force-dynamic';

export default async function PrimeiroAcesso({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  const { erro } = await searchParams;
  const t = await getTranslations('primeiroAcesso');

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
              <div className="env">{t('titulo')}</div>
            </div>
          </div>
          <div className="card">
            <div className="body">
              <Avisos erro={erro} />
              {sessao.senhaProvisoria ? (
                <div className="banner warn" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="ttl">{t('senhaProvisoria')}</div>
                    {t('explicacao')}
                  </div>
                </div>
              ) : null}

              <form action={trocarSenha}>
                <CampoCsrf token={tokenCsrfPara(sessao.sessaoId)} />
                <label className="field">
                  <span className="lbl">{t('senhaAtual')}</span>
                  <input type="password" name="atual" autoComplete="current-password" required />
                </label>
                <label className="field">
                  <span className="lbl">{t('novaSenha')}</span>
                  <input type="password" name="nova" autoComplete="new-password" required minLength={8} />
                  <span className="hint">{t('regra')}</span>
                </label>
                <label className="field">
                  <span className="lbl">{t('repita')}</span>
                  <input type="password" name="repetida" autoComplete="new-password" required minLength={8} />
                </label>
                <button className="btn primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
                  {t('salvarEEntrar')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
