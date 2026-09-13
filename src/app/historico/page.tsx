import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { escopoDePasta, escopoDePublicacao } from '@/lib/escopo';
import { formatarNoFuso, siglaDoFuso } from '@/lib/fuso';
import { resumir } from '@/lib/textos';
import { reenviarTexto } from '../pastas/acoes-agenda';

export const dynamic = 'force-dynamic';

const SITUACOES = ['', 'enviada', 'erro', 'perdida', 'reivindicada', 'sem_texto'] as const;

const CLASSE = {
  enviada: 'pill ok',
  erro: 'pill err',
  perdida: 'pill warn',
  reivindicada: 'pill',
  sem_texto: 'pill',
} as const;

/** "1970-01-01T07:00:00Z" guardado como time vira "07:00". */
function horaDoSlot(valor: Date | null): string | null {
  return valor ? valor.toISOString().slice(11, 16) : null;
}

export default async function Historico({
  searchParams,
}: {
  searchParams: Promise<{ pasta?: string; status?: string; erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const t = await getTranslations('historico');
  const textos = await getTranslations('textos');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');
  const idioma = await getLocale();

  const filtros = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, timezone: true },
  });
  const pastaEscolhida = pastas.find((p) => p.id === filtros.pasta) ?? null;
  const status = SITUACOES.some((s) => s === filtros.status) ? filtros.status : '';
  const rotuloDaSituacao = (valor: string) =>
    valor === '' ? textos('todasAsSituacoes') : valor === 'erro' ? textos('erro') : t(valor);

  const publicacoes = await prisma.publication.findMany({
    where: {
      AND: [
        escopoDePublicacao(sessao),
        pastaEscolhida ? { folderId: pastaEscolhida.id } : {},
        status ? { status: status as 'enviada' } : {},
      ],
    },
    orderBy: [{ dataPrevista: 'desc' }, { horaPrevista: 'desc' }],
    take: 200,
    include: {
      folder: { select: { id: true, nome: true, timezone: true } },
      texto: { select: { id: true, conteudo: true, status: true } },
    },
  });

  // Sem pasta atribuída a lista fica vazia, e vazio parece "nada aconteceu"
  // em vez de "você ainda não tem acesso a nenhuma pasta".
  const semPastaAtribuida = sessao.perfil === 'usuario' && pastas.length === 0;

  return (
    <Casca sessao={sessao} titulo={t('titulo')} caminho={menu('textos')} atual="/historico">
      <Avisos erro={filtros.erro} ok={filtros.ok} />

      {semPastaAtribuida ? (
        <div className="banner warn">
          <div>
            <div className="ttl">{comum('semPastaTitulo')}</div>
            {comum('semPastaExplicacao')}
          </div>
        </div>
      ) : null}

      <div className="card">
        <form className="toolbar" method="get">
          <select name="pasta" defaultValue={pastaEscolhida?.id ?? ''} aria-label={menu('pastas')}>
            <option value="">{t('todasAsPastas')}</option>
            {pastas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status}>
            {SITUACOES.map((s) => (
              <option key={s} value={s}>
                {rotuloDaSituacao(s)}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            {comum('filtrar')}
          </button>
          <span className="spacer" />
          <span className="faint">{comum('fusoDaPasta')}</span>
        </form>

        <table>
          <thead>
            <tr>
              <th style={{ width: 170 }}>{t('slotPrevisto')}</th>
              <th style={{ width: 160 }}>{t('pasta')}</th>
              <th>{t('textoPublicado')}</th>
              <th style={{ width: 110 }}>{textos('situacao')}</th>
              <th style={{ width: 150 }}>{t('enviadaEm')}</th>
              <th style={{ width: 110 }}>message_id</th>
              <th style={{ width: 110 }} />
            </tr>
          </thead>
          <tbody>
            {publicacoes.length === 0 ? (
              <tr>
                <td colSpan={7} className="faint">
                  {t('vazio')}
                </td>
              </tr>
            ) : (
              publicacoes.map((p) => {
                const hora = horaDoSlot(p.horaPrevista);
                return (
                  <tr key={p.id}>
                    <td>
                      {p.dataPrevista.toISOString().slice(0, 10).split('-').reverse().join('/')}{' '}
                      {hora ? (
                        <>
                          {hora} <span className="tz">{siglaDoFuso(p.folder.timezone)}</span>
                        </>
                      ) : (
                        <span className="faint">{t('semHora')}</span>
                      )}
                      {p.origem !== 'dispatcher' ? (
                        <div className="faint">
                          {p.origem === 'manual' ? t('publicadoAgora') : t('historicoImportado')}
                        </div>
                      ) : null}
                    </td>
                    <td>{p.folder.nome}</td>
                    <td>
                      {p.conteudoPublicado ? (
                        <>
                          {resumir(p.conteudoPublicado, 110)}
                          <div className="meta faint">
                            {p.tinhaImagem ? `${t('comImagem')} · ` : ''}
                            {p.texto ? '' : t('textoExcluido')}
                          </div>
                        </>
                      ) : (
                        <span className="faint">
                          {p.status === 'perdida'
                            ? t('slotVencido')
                            : (p.erroMensagem ?? comum('nenhum'))}
                        </span>
                      )}
                      {p.erroMensagem && p.conteudoPublicado ? (
                        <div className="meta" style={{ color: 'var(--danger)' }}>{p.erroMensagem}</div>
                      ) : null}
                      {p.status === 'erro' && !p.conteudoPublicado && p.erroMensagem ? (
                        <div className="meta" style={{ color: 'var(--danger)' }}>{p.erroMensagem}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={CLASSE[p.status]}>{rotuloDaSituacao(p.status)}</span>
                      {p.tentativas > 1 ? (
                        <div className="faint">{t('tentativas', { quantidade: p.tentativas })}</div>
                      ) : null}
                    </td>
                    <td>
                      {p.enviadaEm ? (
                        formatarNoFuso(p.enviadaEm, p.folder.timezone, idioma)
                      ) : (
                        <span className="faint">{comum('nenhum')}</span>
                      )}
                    </td>
                    <td className="num">
                      {p.telegramMessageId ?? <span className="faint">{comum('nenhum')}</span>}
                    </td>
                    <td>
                      {p.status === 'erro' && p.texto ? (
                        <form action={reenviarTexto} style={{ display: 'inline' }}>
                          <CampoCsrf token={csrf} />
                          <input type="hidden" name="id" value={p.texto.id} />
                          <input type="hidden" name="destino" value="/historico" />
                          <button className="btn sm" type="submit">
                            {textos('reenviar')}
                          </button>
                        </form>
                      ) : p.texto ? (
                        <Link className="btn sm" href={`/textos/${p.texto.id}`}>
                          {t('verTexto')}
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="faint">{t('explicacao')}</p>
    </Casca>
  );
}
