import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { FilaOrdenavel } from '@/components/fila-ordenavel';
import { MoverTextos, CaixaDeTexto, CaixaDeTodos } from '@/components/mover-textos';
import { SelectQueFiltra } from '@/components/filtro-imediato';
import {
  IconeAbrir,
  IconeArquivar,
  IconeDaSituacao,
  IconeDesarquivar,
  IconePublicar,
  IconeReenviar,
} from '@/components/icones';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDePasta, escopoDeTexto } from '@/lib/escopo';
import { resumir, tamanhoDoTexto } from '@/lib/textos';
import { formatarNoFuso } from '@/lib/fuso';
import { formatarPadraoDeData } from '@/lib/data-da-publicacao';
import { SITUACOES, lembrarLista, listaLembrada, pastaDaVez } from '@/lib/lista-lembrada';
import {
  arquivarSelecionados,
  arquivarTexto,
  desarquivarTexto,
  excluirSelecionados,
  moverTextos,
  reordenarFila,
} from './acoes';
import { publicarAgora, reenviarTexto } from '../pastas/acoes-agenda';

export const dynamic = 'force-dynamic';

/** KB só a partir de 1 KB — "0 KB" não informa nada. */
function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Quanto do texto aparece na lista.
 *
 * Três vezes o resumo de antes, que era o que de fato limitava a leitura: sem
 * mexer aqui, alargar a coluna só deixaria espaço em branco depois das
 * reticências. O corte continua existindo — a lista é para reconhecer o texto,
 * não para lê-lo inteiro; para isso existe a tela do texto.
 */
const RESUMO_NA_LISTA = 480;

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
  const idioma = await getLocale();

  const filtros = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, timezone: true, aoEsgotar: true, tipoDeLista: true },
  });
  const lembrado = await listaLembrada(sessao.usuarioId);
  const pasta = pastaDaVez(pastas, filtros.pasta, lembrado.pastaId);

  if (!pasta) {
    return (
      <Casca sessao={sessao} titulo={t('titulo')} caminho={menu('textos')} atual="/textos">
        <Avisos erro={filtros.erro} ok={filtros.ok} />
        <div className="banner warn">
          <div>
            <div className="ttl">
              {sessao.perfil === 'usuario' ? comum('semPastaTitulo') : t('semPastaTitulo')}
            </div>
            {sessao.perfil === 'usuario' ? comum('semPastaExplicacao') : t('semPasta')}
          </div>
        </div>
      </Casca>
    );
  }

  const busca = (filtros.busca ?? '').trim();
  // A situação vem da URL quando ela traz uma, mesmo vazia — `?status=` é a
  // escolha explícita de "todas". Só a ausência do parâmetro cai no lembrado;
  // um valor desconhecido cai em "todas", sem sobrescrever o que estava guardado
  // por causa de uma URL malformada.
  const daUrl = SITUACOES.find((s) => s === filtros.status);
  const status = daUrl ?? (filtros.status === undefined ? lembrado.status : '');
  const rotuloDaSituacao = (valor: string) =>
    valor === '' ? t('todasAsSituacoes') : t(valor);

  // A escolha desta visita passa a ser a lembrada da próxima. Escreve durante a
  // renderização de um GET, o que normalmente não se faz — mas a barra de
  // filtros é um formulário GET de propósito: é o que mantém a tela marcável nos
  // favoritos, compartilhável por link e reversível pelo botão de voltar, e
  // trocá-la por uma ação de servidor só para poder gravar custaria as três.
  // `lembrarLista` só escreve quando a escolha mudou, então abrir a lista sem
  // mexer em nada não gera escrita nenhuma.
  await lembrarLista(sessao.usuarioId, lembrado, { pastaId: pasta.id, status });

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
      diaDaPublicacao: true,
      mesDaPublicacao: true,
      anoDaPublicacao: true,
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
  const podeReordenar = semFiltro && pendentes.length > 1 && pasta.tipoDeLista === 'fila';

  // Mover é de admin para cima; o destino sai da mesma lista de pastas que a
  // pessoa já enxerga, menos a que está aberta. Arquivar, excluir, incluir e
  // exportar em lote seguem `textos.gerenciar`, que o perfil `usuario` também
  // tem — por isso a caixa de seleção aparece para ele, e o bloco de mover não.
  const podeMover = podeFazer(sessao.perfil, 'textos.mover');
  const podeSelecionar = podeFazer(sessao.perfil, 'textos.gerenciar');
  const porData = pasta.tipoDeLista === 'data';
  const destinos = pastas.filter((p) => p.id !== pasta.id).map((p) => ({ id: p.id, nome: p.nome }));

  return (
    <Casca
      sessao={sessao}
      titulo={t('titulo')}
      caminho={`${menu('textos')} · ${pasta.nome}`}
      atual="/textos"
      largo
    >
      <Avisos erro={filtros.erro} ok={filtros.ok} />

      {pendentes.length < 5 && pasta.tipoDeLista === 'fila' ? (
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
          <SelectQueFiltra name="pasta" defaultValue={pasta.id} aria-label={menu('pastas')}>
            {pastas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </SelectQueFiltra>
          <input type="text" name="busca" defaultValue={busca} placeholder={comum('buscar')} />
          <SelectQueFiltra name="status" defaultValue={status} aria-label={t('situacao')}>
            {SITUACOES.map((s) => (
              <option key={s} value={s}>
                {rotuloDaSituacao(s)}
              </option>
            ))}
          </SelectQueFiltra>
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

        <MoverTextos
          ativo={podeSelecionar}
          podeMover={podeMover}
          folderId={pasta.id}
          destinos={destinos}
          acao={moverTextos}
          arquivarEmLote={arquivarSelecionados}
          excluirEmLote={excluirSelecionados}
          csrf={<CampoCsrf token={csrf} />}
        >
        <div className="rolagem">
        <table>
          <thead>
            <tr>
              {podeSelecionar ? (
                <th style={{ width: 34 }}>
                  <CaixaDeTodos rotulo={t('escolherTodos')} />
                </th>
              ) : null}
              <th style={{ width: porData ? 96 : 52 }}>
                {porData ? t('dataDaPublicacao') : t('ordem')}
              </th>
              <th>{t('texto')}</th>
              {/* Sem rótulo escrito: era ele, e não o conteúdo, que segurava a
                  coluna em noventa e cinco pixels. O nome continua chegando a
                  quem usa leitor de tela pelo `aria-label`, e ao mouse pelo
                  `title` — como já acontece na coluna das ações. */}
              <th style={{ width: 40 }} title={t('situacao')} aria-label={t('situacao')} />
              <th style={{ width: 128 }}>{t('publicadoEm')}</th>
              <th style={{ width: 104 }} />
            </tr>
          </thead>
          <tbody>
            {textos.length === 0 ? (
              <tr>
                <td colSpan={podeSelecionar ? 6 : 5} className="faint">
                  {t('nenhumComFiltros')}
                </td>
              </tr>
            ) : (
              textos.map((texto) => (
                <tr key={texto.id}>
                  {podeSelecionar ? (
                    <td>
                      <CaixaDeTexto id={texto.id} />
                    </td>
                  ) : null}
                  <td className="num">
                    {porData ? (
                      formatarPadraoDeData({
                        dia: texto.diaDaPublicacao,
                        mes: texto.mesDaPublicacao,
                        ano: texto.anoDaPublicacao,
                      })
                    ) : texto.status === 'pendente' ? (
                      posicaoNaFila.get(texto.id)
                    ) : (
                      <span className="faint">{comum('nenhum')}</span>
                    )}
                  </td>
                  <td className="textcell">
                    {/* Sem imagem, nada ocupa o lugar dela: o quadrado vazio
                        custava cinquenta e oito pixels de leitura por linha para
                        dizer o que a legenda abaixo do texto já diz. */}
                    {texto.imagemMime ? (
                      <img className="thumb" src={`/api/textos/${texto.id}/imagem`} alt="" />
                    ) : null}
                    <div className="t">
                      <p>{resumir(texto.conteudo, RESUMO_NA_LISTA)}</p>
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
                          ? ` · ${t('arquivadoEm', { quando: formatarNoFuso(texto.arquivadoEm, pasta.timezone, idioma) })}`
                          : ''}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        texto.status === 'publicado'
                          ? 'selo ok'
                          : texto.status === 'erro'
                            ? 'selo err'
                            : 'selo'
                      }
                      title={`${t('situacao')}: ${t(texto.status)}`}
                      aria-label={`${t('situacao')}: ${t(texto.status)}`}
                      role="img"
                    >
                      <IconeDaSituacao situacao={texto.status} />
                    </span>
                  </td>
                  <td>
                    {texto.publicadoEm ? (
                      formatarNoFuso(texto.publicadoEm, pasta.timezone, idioma)
                    ) : (
                      <span className="faint">{comum('nenhum')}</span>
                    )}
                  </td>
                  {/* Só ícones: cada rótulo aqui era largura tirada da coluna do
                      texto. O nome de cada ação vai no `title`, que aparece ao
                      passar o mouse, e no `aria-label`, que o leitor de tela
                      anuncia — o botão não fica anônimo, só fica estreito. */}
                  <td>
                   <div className="acoes">
                    <Link
                      className="btn sm icone"
                      href={`/textos/${texto.id}`}
                      title={comum('abrir')}
                      aria-label={comum('abrir')}
                    >
                      <IconeAbrir />
                    </Link>
                    {texto.status === 'pendente' ? (
                      <form action={publicarAgora}>
                        <CampoCsrf token={csrf} />
                        <input type="hidden" name="id" value={texto.id} />
                        <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                        <button
                          className="btn sm icone"
                          type="submit"
                          title={t('publicarAgora')}
                          aria-label={t('publicarAgora')}
                        >
                          <IconePublicar />
                        </button>
                      </form>
                    ) : null}
                    {texto.status === 'erro' ? (
                      <form action={reenviarTexto}>
                        <CampoCsrf token={csrf} />
                        <input type="hidden" name="id" value={texto.id} />
                        <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                        <button
                          className="btn sm icone"
                          type="submit"
                          title={t('reenviar')}
                          aria-label={t('reenviar')}
                        >
                          <IconeReenviar />
                        </button>
                      </form>
                    ) : null}
                    {texto.status === 'arquivado' ? (
                      <form action={desarquivarTexto}>
                        <CampoCsrf token={csrf} />
                        <input type="hidden" name="id" value={texto.id} />
                        <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                        <button
                          className="btn sm icone"
                          type="submit"
                          title={t('desarquivar')}
                          aria-label={t('desarquivar')}
                        >
                          <IconeDesarquivar />
                        </button>
                      </form>
                    ) : (
                      <form action={arquivarTexto}>
                        <CampoCsrf token={csrf} />
                        <input type="hidden" name="id" value={texto.id} />
                        <input type="hidden" name="destino" value={`/textos?pasta=${pasta.id}`} />
                        <button
                          className="btn sm icone"
                          type="submit"
                          title={t('arquivar')}
                          aria-label={t('arquivar')}
                        >
                          <IconeArquivar />
                        </button>
                      </form>
                    )}
                   </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        </MoverTextos>
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
