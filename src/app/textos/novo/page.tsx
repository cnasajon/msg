import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { EditorDeTexto } from '@/components/editor-texto';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { comEscopo } from '@/lib/escopo';
import { criarTexto } from '../acoes';

export const dynamic = 'force-dynamic';

export default async function NovoTexto({
  searchParams,
}: {
  searchParams: Promise<{ pasta?: string; erro?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const t = await getTranslations('editor');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');

  const { pasta: pastaId, erro } = await searchParams;
  if (!pastaId) redirect('/textos');
  const pasta = await comEscopo(sessao).pasta(pastaId);
  const csrf = tokenCsrfPara(sessao.sessaoId);

  return (
    <Casca
      sessao={sessao}
      titulo={t('novoTextoTitulo')}
      caminho={`${menu('textos')} · ${pasta.nome}`}
      atual="/textos"
    >
      <Avisos erro={erro} />
      <div className="card">
        <header>
          <h2>{t('conteudo')}</h2>
          <span className="spacer" />
          <span className="sub">{t('entraNoFim', { pasta: pasta.nome })}</span>
        </header>
        <div className="body">
          <form action={criarTexto}>
            <CampoCsrf token={csrf} />
            <input type="hidden" name="folderId" value={pasta.id} />
            <EditorDeTexto />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn primary" type="submit">
                {t('criarTexto')}
              </button>
              <Link className="btn" href={`/textos?pasta=${pasta.id}`}>
                {comum('cancelar')}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Casca>
  );
}
