import Link from 'next/link';
import { redirect } from 'next/navigation';
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

  const { pasta: pastaId, erro } = await searchParams;
  if (!pastaId) redirect('/textos');
  const pasta = await comEscopo(sessao).pasta(pastaId);
  const csrf = tokenCsrfPara(sessao.sessaoId);

  return (
    <Casca sessao={sessao} titulo="Novo texto" caminho={`Textos · ${pasta.nome}`} atual="/textos">
      <Avisos erro={erro} />
      <div className="card">
        <header>
          <h2>Conteúdo</h2>
          <span className="spacer" />
          <span className="sub">entra no fim da fila de {pasta.nome}</span>
        </header>
        <div className="body">
          <form action={criarTexto}>
            <CampoCsrf token={csrf} />
            <input type="hidden" name="folderId" value={pasta.id} />
            <EditorDeTexto />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn primary" type="submit">
                Criar texto
              </button>
              <Link className="btn" href={`/textos?pasta=${pasta.id}`}>
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Casca>
  );
}
