import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { EditorDeTexto } from '@/components/editor-texto';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { comEscopo } from '@/lib/escopo';
import { prisma } from '@/lib/db';
import { formatarNoFuso } from '@/lib/fuso';
import { tamanhoDoTexto } from '@/lib/textos';
import { arquivarTexto, desarquivarTexto, editarTexto, excluirTexto } from '../acoes';

export const dynamic = 'force-dynamic';

export default async function EditarTexto({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const { id } = await params;
  const { erro, ok } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  const texto = await comEscopo(sessao).texto(id);
  const pasta = await prisma.folder.findUniqueOrThrow({
    where: { id: texto.folderId },
    select: { id: true, nome: true, timezone: true, telegramChatId: true },
  });
  const temImagem = texto.imagem !== null;

  return (
    <Casca sessao={sessao} titulo="Editar texto" caminho={`Textos · ${pasta.nome}`} atual="/textos">
      <Avisos erro={erro} ok={ok} />

      {texto.status === 'arquivado' ? (
        <div className="banner warn">
          <div>
            Este texto está arquivado desde{' '}
            {texto.arquivadoEm ? formatarNoFuso(texto.arquivadoEm, pasta.timezone) : '—'}. Ele não
            entra na fila.
          </div>
        </div>
      ) : null}
      {texto.erroMensagem ? (
        <div className="banner err">
          <div>
            <div className="ttl">Última publicação falhou</div>
            {texto.erroMensagem}
          </div>
        </div>
      ) : null}

      <div className="grid c2">
        <div className="card">
          <header>
            <h2>Conteúdo</h2>
          </header>
          <div className="body">
            <form action={editarTexto}>
              <CampoCsrf token={csrf} />
              <input type="hidden" name="id" value={texto.id} />
              <EditorDeTexto
                valorInicial={texto.conteudo}
                temImagemInicial={temImagem}
                urlDaImagem={temImagem ? `/api/textos/${texto.id}/imagem` : null}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button className="btn primary" type="submit">
                  Salvar
                </button>
                <Link className="btn" href={`/textos?pasta=${pasta.id}`}>
                  Voltar
                </Link>
              </div>
            </form>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <header>
              <h2>Pré-visualização</h2>
            </header>
            <div className="body">
              <div className="preview">
                <div className="tg-bubble">
                  {temImagem ? <img src={`/api/textos/${texto.id}/imagem`} alt="" /> : null}
                  <div dangerouslySetInnerHTML={{ __html: texto.conteudo.replace(/\n/g, '<br>') }} />
                </div>
              </div>
              <p className="faint" style={{ margin: '12px 0 0' }}>
                Com imagem, o envio usa <code>sendPhoto</code> com o texto como legenda. Sem imagem,{' '}
                <code>sendMessage</code>.
              </p>
            </div>
          </div>

          <div className="card">
            <header>
              <h2>Situação</h2>
            </header>
            <div className="body">
              <dl className="kv">
                <dt>Pasta</dt>
                <dd>{pasta.nome}</dd>
                <dt>Grupo de destino</dt>
                <dd>
                  {pasta.telegramChatId ? (
                    <code>{pasta.telegramChatId}</code>
                  ) : (
                    <span className="faint">não configurado</span>
                  )}
                </dd>
                <dt>Situação</dt>
                <dd>
                  <span
                    className={
                      texto.status === 'publicado' ? 'pill ok' : texto.status === 'erro' ? 'pill err' : 'pill'
                    }
                  >
                    {texto.status}
                  </span>
                </dd>
                <dt>Posição na fila</dt>
                <dd>{texto.status === 'pendente' ? texto.ordem : <span className="faint">fora da fila</span>}</dd>
                <dt>Tamanho</dt>
                <dd>
                  {tamanhoDoTexto(texto.conteudo)} caracteres · limite {temImagem ? 1024 : 4096}
                </dd>
                {texto.imagemBytes ? (
                  <>
                    <dt>Imagem</dt>
                    <dd>
                      {texto.imagemBytes < 1024
                        ? `${texto.imagemBytes} B`
                        : `${Math.round(texto.imagemBytes / 1024)} KB`}{' '}
                      · <code>{texto.imagemMime}</code>
                      <div className="faint">{texto.imagemNomeOriginal}</div>
                    </dd>
                  </>
                ) : null}
                <dt>Publicado em</dt>
                <dd>
                  {texto.publicadoEm ? (
                    formatarNoFuso(texto.publicadoEm, pasta.timezone)
                  ) : (
                    <span className="faint">ainda não</span>
                  )}
                </dd>
              </dl>
            </div>
          </div>

          <div className="card">
            <header>
              <h2>Tirar da lista</h2>
            </header>
            <div className="body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {texto.status === 'arquivado' ? (
                <form action={desarquivarTexto}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={texto.id} />
                  <input type="hidden" name="destino" value={`/textos/${texto.id}`} />
                  <button className="btn" type="submit">
                    Desarquivar
                  </button>
                </form>
              ) : (
                <form action={arquivarTexto}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={texto.id} />
                  <input type="hidden" name="destino" value={`/textos/${texto.id}`} />
                  <button className="btn" type="submit">
                    Arquivar
                  </button>
                </form>
              )}
              <form action={excluirTexto}>
                <CampoCsrf token={csrf} />
                <input type="hidden" name="id" value={texto.id} />
                <button className="btn danger" type="submit">
                  Excluir
                </button>
              </form>
              <span className="faint" style={{ flexBasis: '100%' }}>
                Arquivar preserva o registro e é o caminho normal. Excluir apaga o texto — o
                histórico das publicações sobrevive, porque a publicação guarda o que foi ao ar.
              </span>
            </div>
          </div>
        </div>
      </div>
    </Casca>
  );
}
