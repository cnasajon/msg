import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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
import { publicarAgora, pularTexto, reenviarTexto } from '../pastas/acoes-agenda';

export const dynamic = 'force-dynamic';

/** KB só a partir de 1 KB — "0 KB" não informa nada. */
function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const SITUACOES = ['', 'pendente', 'publicado', 'erro', 'arquivado'] as const;

export default async function Textos({
  searchParams,
}: {
  searchParams: Promise<{ pasta?: string; busca?: string; status?: string; imagem?: string; erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const t = await getTranslations('textos');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');

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
      <Casca sessao={sessao} titulo={t('titulo')} caminho={menu('textos')} atual="/textos">
        <Avisos erro={filtros.erro} ok={filtros.ok} />
        <div className="banner warn">
          <div>{t('semPasta')}</div>
        </div>
      </Casca>
    );
  }

  const busca = (filtros.busca ?? '').trim();
  const status = SITUACOES.some((s) => s === filtros.status) ? filtros.status : '';
  const rotuloDaSituacao = (valor: string) =>
    valor === '' ? t('todasAsSituacoes') : t(valor);

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

  const pendentes = textos.filter((texto) => texto.status === 'pendente');
  // A coluna mostra a posição na fila, não o valor bruto de `ordem`: depois de
  // uma importação os números têm buracos, e "5" numa fila de três assusta sem
  // motivo.
  const posicaoNaFila = new Map(pendentes.map((texto, indice) => [texto.id, indice + 1]));
  const semFiltro = !busca && !status && !filtros.imagem;
  const podeReordenar = semFiltro && pendentes.length > 1;

  return (
    <Casca
      sessao={sessao}
      titulo={t('titulo')}
      caminho={`${menu('textos')} · ${pasta.nome}`}
      atual="/textos"
    >
      <Avisos erro={filtros.erro} ok={filtros.ok} />

      {pendentes.length < 5 ? (
        <div className={pendentes.length === 0 ? 'banner err' : 'banner warn'}>
          <div>
            {pendentes.length === 0
              ? t('filaVazia')
              : t('poucosPendentes', { quantidade: pendentes.length })}{' '}
            {t.rich('aoEsgotarConfigurado', {
              comportamento:
                pasta.aoEsgotar === 'reiniciar' ? comum('reiniciarFila') : comum('pararNotificar'),
              b: (partes) => <b>{partes}</b>,
            })}{' '}
            <Link href={`/pastas/${pasta.id}`}>{t('alterar')}</Link>
          </div>
        </div>
      ) : null}

      <div className="card">
        <form className="toolbar" method="get">
          <select name="pasta" defaultValue={pasta.id} aria-label={menu('pastas')}>
            {pastas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <input type="text" name="busca" defaultValue={busca} placeholder={comum('buscar')} />
          <select name="status" defaultValue={status}>
            {SITUACOES.map((s) => (
              <option key={s} value={s}>
                {rotuloDaSituacao(s)}
              </option>
            ))}
          </select>
          <select name="imagem" defaultValue={filtros.imagem ?? ''}>
            <option value="">{t('comESemImagem')}</option>
            <option value="com">{t('soComImagem')}</option>
            <option value="sem">{t('soSemImagem')}</option>
          </select>
          <button className="btn" type="submit">
            {comum('filtrar')}
          </button>
          <span className="spacer" />
          <Link className="btn" href={`/importacao?pasta=${pasta.id}`}>
            {menu('importacao')}
          </Link>
          <Link className="btn" href={`/exportacao?pasta=${pasta.id}`}>
            {t('exportar')}
          </Link>
          <Link className="btn primary" href={`/textos/novo?pasta=${pasta.id}`}>
            {t('novoTexto')}
          </Link>
        </form>

        <table>
          <thead>
            <tr>
              <th style={{ width: 60 }}>{t('ordem')}</th>
              <th>{t('texto')}</th>
              <th style={{ width: 110 }}>{t('situacao')}</th>
              <th style={{ width: 170 }}>{t('publicadoEm')}</th>
              <th style={{ width: 210 }} />
            </tr>
          </thead>
          <tbody>
            {textos.length === 0 ? (
              <tr>
                <td colSpan={5} className="faint">
                  {t('nenhumComFiltros')}
                </td>
              </tr>
            ) : (
              textos.map((texto) => (
                <tr key={texto.id}>
                  <td className="num">
                    {texto.status === 'pendente' ? (
                      posicaoNaFila.get(texto.id)
                    ) : (
                      <span className="faint">{comum('nenhum')}</span>
                    )}
                  </td>
                  <td className="textcell">
                    {texto.imagemMime ? (
                      <img className="thumb" src={`/api/textos/${texto.id}/imagem`} alt="" />
                    ) : (
                      <div className="thumb empty">{comum('nenhum')}</div>
                    )}
                    <div className="t">
                      <p>{resumir(texto.conteudo)}</p>
                      <div className="meta">
                        {t('caracteres', { quantidade: tamanhoDoTexto(texto.conteudo) })}
                        {texto.imagemBytes
                          ? ` · ${t('comImagemLimite', { tamanho: tamanhoLegivel(texto.imagemBytes) })}`
                          : ` · ${t('semImagemLimite')}`}
                        {texto.importId ? ` · ${t('importado')}` : ''}
                        {texto.erroMensagem ? (
                          <span style={{ color: 'var(--danger)' }}> · {texto.erroMensagem}</span>
                        ) : null}
                        {texto.arquivadoEm
                          ? ` · ${t('arquivadoEm', { quando: formatarNoFuso(texto.arquivadoEm, pasta.timezone) })}`
                          : ''}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        texto.status === 'publicado'
                          ? 'pill ok'
                          : texto.status === 'erro'
                            ? 'pill err'
                            : 'pill'
                      }
                    >
                      {t(texto.status)}
                    </span>
                  </td>
                  <td>
                    {texto.publicadoEm ? (
                      formatarNoFuso(texto.publicadoEm, pasta.timezone)
                    ) : (
                      <span className="faint">{comum('nenhum')}</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Link className="btn sm" href={`/textos/${texto.id}`}>
                      {comum('abrir')}
                    </Link>{' '}
                    {texto.status === 'pendente' ? (
                      <>
                        <form action={publicarAgora} style={{ display: 'inline' }}>
                          <CampoCsrf token={csrf} />
                          <input type="hidden" name="id" value={texto.id} />
                          <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                          <button className="btn sm" type="submit">
                            {t('publicarAgora')}
                          </button>
                        </form>{' '}
                        <form action={pularTexto} style={{ display: 'inline' }}>
                          <CampoCsrf token={csrf} />
                          <input type="hidden" name="id" value={texto.id} />
                          <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                          <button className="btn sm" type="submit" title={t('pularTitulo')}>
                            {t('pular')}
                          </button>
                        </form>{' '}
                      </>
                    ) : null}
                    {texto.status === 'erro' ? (
                      <>
                        <form action={reenviarTexto} style={{ display: 'inline' }}>
                          <CampoCsrf token={csrf} />
                          <input type="hidden" name="id" value={texto.id} />
                          <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                          <button className="btn sm" type="submit">
                            {t('reenviar')}
                          </button>
                        </form>{' '}
                      </>
                    ) : null}
                    {texto.status === 'arquivado' ? (
                      <form action={desarquivarTexto} style={{ display: 'inline' }}>
                        <CampoCsrf token={csrf} />
                        <input type="hidden" name="id" value={texto.id} />
                        <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                        <button className="btn sm" type="submit">
                          {t('desarquivar')}
                        </button>
                      </form>
                    ) : (
                      <form action={arquivarTexto} style={{ display: 'inline' }}>
                        <CampoCsrf token={csrf} />
                        <input type="hidden" name="id" value={texto.id} />
                        <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                        <button className="btn sm" type="submit">
                          {t('arquivar')}
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
            <h2>{t('ordemDaFila')}</h2>
            <span className="spacer" />
            <span className="sub">{t('textosPendentes', { quantidade: pendentes.length })}</span>
          </header>
          <FilaOrdenavel
            folderId={pasta.id}
            acao={reordenarFila}
            csrf={<CampoCsrf token={csrf} />}
            itens={pendentes.map((texto) => ({
              id: texto.id,
              resumo: resumir(texto.conteudo, 120),
              miniatura: texto.imagemMime ? `/api/textos/${texto.id}/imagem` : null,
              caracteres: tamanhoDoTexto(texto.conteudo),
            }))}
          />
        </div>
      ) : pendentes.length > 1 ? (
        <p className="faint">{t('limpeOsFiltros')}</p>
      ) : null}
    </Casca>
  );
}
