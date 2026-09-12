import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { FilaOrdenavel } from '@/components/fila-ordenavel';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { escopoDePasta, escopoDeTexto } from '@/lib/escopo';
import { resumir, tamanhoDoTexto } from '@/lib/textos';
import { formatarNoFuso } from '@/lib/fuso';
import { arquivarTexto, desarquivarTexto, reordenarFila } from './acoes';

export const dynamic = 'force-dynamic';

/** KB só a partir de 1 KB — "0 KB" não informa nada. */
function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const SITUACOES = [
  { valor: '', rotulo: 'Todas as situações' },
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'publicado', rotulo: 'Publicado' },
  { valor: 'erro', rotulo: 'Erro' },
  { valor: 'arquivado', rotulo: 'Arquivado' },
];

export default async function Textos({
  searchParams,
}: {
  searchParams: Promise<{ pasta?: string; busca?: string; status?: string; imagem?: string; erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const filtros = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, timezone: true, aoEsgotar: true },
  });
  // A pasta escolhida na URL só vale se estiver no escopo — caso contrário, a
  // primeira que a pessoa realmente enxerga.
  const pasta = pastas.find((p) => p.id === filtros.pasta) ?? pastas[0] ?? null;

  if (!pasta) {
    return (
      <Casca sessao={sessao} titulo="Textos" caminho="Textos" atual="/textos">
        <Avisos erro={filtros.erro} ok={filtros.ok} />
        <div className="banner warn">
          <div>
            Nenhuma pasta visível para você ainda. Um administrador precisa criar a pasta e, se o seu
            perfil for “usuário”, atribuí-la a você.
          </div>
        </div>
      </Casca>
    );
  }

  const busca = (filtros.busca ?? '').trim();
  const status = SITUACOES.some((s) => s.valor === filtros.status) ? filtros.status : '';

  const textos = await prisma.text.findMany({
    where: {
      AND: [
        escopoDeTexto(sessao),
        { folderId: pasta.id },
        status ? { status: status as 'pendente' } : {},
        busca ? { conteudo: { contains: busca, mode: 'insensitive' } } : {},
        filtros.imagem === 'com' ? { imagem: { not: null } } : {},
        filtros.imagem === 'sem' ? { imagem: null } : {},
      ],
    },
    orderBy: [{ status: 'asc' }, { ordem: 'asc' }],
    select: {
      id: true,
      conteudo: true,
      ordem: true,
      status: true,
      publicadoEm: true,
      arquivadoEm: true,
      erroMensagem: true,
      imagemBytes: true,
      imagemMime: true,
      importId: true,
    },
  });

  const pendentes = textos.filter((t) => t.status === 'pendente');
  // A coluna mostra a posição na fila, não o valor bruto de `ordem`: depois de
  // uma importação os números têm buracos, e "5" numa fila de três assusta sem
  // motivo.
  const posicaoNaFila = new Map(pendentes.map((t, indice) => [t.id, indice + 1]));
  const semFiltro = !busca && !status && !filtros.imagem;
  const podeReordenar = semFiltro && pendentes.length > 1;

  return (
    <Casca sessao={sessao} titulo="Textos" caminho={`Textos · ${pasta.nome}`} atual="/textos">
      <Avisos erro={filtros.erro} ok={filtros.ok} />

      {pendentes.length < 5 ? (
        <div className={pendentes.length === 0 ? 'banner err' : 'banner warn'}>
          <div>
            {pendentes.length === 0
              ? 'A fila desta pasta está vazia.'
              : `Esta pasta tem apenas ${pendentes.length} texto(s) pendente(s).`}{' '}
            Ao esgotar, o comportamento configurado é{' '}
            <b>{pasta.aoEsgotar === 'reiniciar' ? 'reiniciar a fila' : 'parar e notificar'}</b>.{' '}
            <Link href={`/pastas/${pasta.id}`}>Alterar</Link>
          </div>
        </div>
      ) : null}

      <div className="card">
        <form className="toolbar" method="get">
          <select name="pasta" defaultValue={pasta.id} aria-label="Pasta">
            {pastas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <input type="text" name="busca" defaultValue={busca} placeholder="Buscar no conteúdo…" />
          <select name="status" defaultValue={status}>
            {SITUACOES.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
          <select name="imagem" defaultValue={filtros.imagem ?? ''}>
            <option value="">Com e sem imagem</option>
            <option value="com">Só com imagem</option>
            <option value="sem">Só sem imagem</option>
          </select>
          <button className="btn" type="submit">
            Filtrar
          </button>
          <span className="spacer" />
          <Link className="btn" href={`/importacao?pasta=${pasta.id}`}>
            Importar
          </Link>
          <Link className="btn" href={`/exportacao?pasta=${pasta.id}`}>
            Exportar
          </Link>
          <Link className="btn primary" href={`/textos/novo?pasta=${pasta.id}`}>
            Novo texto
          </Link>
        </form>

        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}>Ordem</th>
              <th>Texto</th>
              <th style={{ width: 110 }}>Situação</th>
              <th style={{ width: 170 }}>Publicado em</th>
              <th style={{ width: 210 }} />
            </tr>
          </thead>
          <tbody>
            {textos.length === 0 ? (
              <tr>
                <td colSpan={5} className="faint">
                  Nenhum texto com esses filtros.
                </td>
              </tr>
            ) : (
              textos.map((t) => (
                <tr key={t.id}>
                  <td className="num">
                    {t.status === 'pendente' ? (
                      posicaoNaFila.get(t.id)
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td className="textcell">
                    {t.imagemMime ? (
                      <img className="thumb" src={`/api/textos/${t.id}/imagem`} alt="" />
                    ) : (
                      <div className="thumb empty">—</div>
                    )}
                    <div className="t">
                      <p>{resumir(t.conteudo)}</p>
                      <div className="meta">
                        {tamanhoDoTexto(t.conteudo)} caracteres
                        {t.imagemBytes ? ` · imagem ${tamanhoLegivel(t.imagemBytes)} · limite 1024` : ' · sem imagem · limite 4096'}
                        {t.importId ? ' · importado' : ''}
                        {t.erroMensagem ? (
                          <span style={{ color: 'var(--danger)' }}> · {t.erroMensagem}</span>
                        ) : null}
                        {t.arquivadoEm ? ` · arquivado em ${formatarNoFuso(t.arquivadoEm, pasta.timezone)}` : ''}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        t.status === 'publicado'
                          ? 'pill ok'
                          : t.status === 'erro'
                            ? 'pill err'
                            : 'pill'
                      }
                    >
                      {t.status}
                    </span>
                  </td>
                  <td>
                    {t.publicadoEm ? (
                      formatarNoFuso(t.publicadoEm, pasta.timezone)
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Link className="btn sm" href={`/textos/${t.id}`}>
                      Abrir
                    </Link>{' '}
                    {t.status === 'arquivado' ? (
                      <form action={desarquivarTexto} style={{ display: 'inline' }}>
                        <CampoCsrf token={csrf} />
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                        <button className="btn sm" type="submit">
                          Desarquivar
                        </button>
                      </form>
                    ) : (
                      <form action={arquivarTexto} style={{ display: 'inline' }}>
                        <CampoCsrf token={csrf} />
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                        <button className="btn sm" type="submit">
                          Arquivar
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {podeReordenar ? (
        <div className="card">
          <header>
            <h2>Ordem da fila</h2>
            <span className="spacer" />
            <span className="sub">{pendentes.length} textos pendentes</span>
          </header>
          <FilaOrdenavel
            folderId={pasta.id}
            acao={reordenarFila}
            csrf={<CampoCsrf token={csrf} />}
            itens={pendentes.map((t) => ({
              id: t.id,
              resumo: resumir(t.conteudo, 120),
              miniatura: t.imagemMime ? `/api/textos/${t.id}/imagem` : null,
              caracteres: tamanhoDoTexto(t.conteudo),
            }))}
          />
        </div>
      ) : pendentes.length > 1 ? (
        <p className="faint">Limpe os filtros para reordenar a fila.</p>
      ) : null}
    </Casca>
  );
}
