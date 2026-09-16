import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { EditorDeTexto } from '@/components/editor-texto';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { comEscopo, escopoDeTexto } from '@/lib/escopo';
import { resumir } from '@/lib/textos';
import { criarTexto } from '../acoes';

export const dynamic = 'force-dynamic';

export default async function NovoTexto({
  searchParams,
}: {
  searchParams: Promise<{ pasta?: string; erro?: string; depoisDe?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const t = await getTranslations('editor');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');

  const { pasta: pastaId, erro, depoisDe } = await searchParams;
  if (!pastaId) redirect('/textos');
  const pasta = await comEscopo(sessao).pasta(pastaId);
  const csrf = tokenCsrfPara(sessao.sessaoId);

  // Quem veio da barra de seleção da lista escolheu onde o texto entra. Lemos a
  // linha de referência aqui só para mostrar qual é: se o identificador não
  // estiver no escopo, some o aviso e o texto entra no fim — o mesmo que a ação
  // faz do outro lado, que é quem de fato decide.
  const referencia = depoisDe
    ? await prisma.text.findFirst({
        where: { AND: [{ id: depoisDe }, { folderId: pasta.id }, escopoDeTexto(sessao)] },
        select: { id: true, conteudo: true },
      })
    : null;

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
          <span className="sub">
            {referencia
              ? t('entraDepoisDe', { texto: resumir(referencia.conteudo, 60) })
              : t('entraNoFim', { pasta: pasta.nome })}
          </span>
        </header>
        <div className="body">
          <form action={criarTexto}>
            <CampoCsrf token={csrf} />
            <input type="hidden" name="folderId" value={pasta.id} />
            {referencia ? <input type="hidden" name="depoisDe" value={referencia.id} /> : null}
            <EditorDeTexto dataInicial={pasta.tipoDeLista === 'data' ? '*/*/*' : undefined} />
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
