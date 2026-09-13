import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { Ajuda } from '@/components/ajuda';
import { CamposDoTipoDeListaEmLinha } from '@/components/campos-do-tipo-de-lista';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDePasta, organizacaoEmVigor } from '@/lib/escopo';
import { criarPasta } from './acoes';

export const dynamic = 'force-dynamic';

export default async function Pastas({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'pastas.gerenciar')) redirect('/inicio');

  const t = await getTranslations('pastas');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');

  const { erro, ok } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);
  const orgEmVigor = organizacaoEmVigor(sessao);

  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    include: {
      // Em lista por fila conta o que ainda não saiu; em lista por data não há
      // fila que acabe, e o que informa é quanto texto a pasta tem no total.
      _count: {
        select: { schedules: true, textos: { where: { status: { not: 'arquivado' } } } },
      },
      textos: { where: { status: 'pendente' }, select: { id: true } },
    },
  });

  const organizacao = orgEmVigor
    ? await prisma.organization.findUnique({
        where: { id: orgEmVigor },
        select: { timezonePadrao: true },
      })
    : null;

  return (
    <Casca sessao={sessao} titulo={t('titulo')} caminho={menu('configuracao')} atual="/pastas">
      <Avisos erro={erro} ok={ok} />

      {!orgEmVigor ? (
        <div className="banner warn">
          <div>{t('semOrganizacao')}</div>
        </div>
      ) : null}

      <div className="card">
        <header>
          <h2>{t('daOrganizacao')}</h2>
          <span className="spacer" />
          <span className="sub">{t('noTotal', { quantidade: pastas.length })}</span>
        </header>
        <table>
          <thead>
            <tr>
              <th>{t('pasta')}</th>
              <th>{t('grupoDeDestino')}</th>
              <th>{t('fuso')}</th>
              <th className="num">{t('agendamentos')}</th>
              <th>{t('tipoDeLista')}</th>
              <th>{t('fila')}</th>
              <th>{t('aoEsgotar')}</th>
              <th>{t('situacao')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pastas.length === 0 ? (
              <tr>
                <td colSpan={9} className="faint">
                  {t('nenhumaPasta')}
                </td>
              </tr>
            ) : (
              pastas.map((p) => {
                const pendentes = p.textos.length;
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{p.nome}</b>
                      {p.descricao ? <div className="faint">{p.descricao}</div> : null}
                    </td>
                    <td>
                      {p.telegramChatId ? (
                        <code>{p.telegramChatId}</code>
                      ) : (
                        <span className="faint">{t('naoConfigurado')}</span>
                      )}
                      {p.telegramBotTokenCifrado ? (
                        <div className="faint">{t('botProprio')}</div>
                      ) : null}
                    </td>
                    <td>{p.timezone}</td>
                    <td className="num">{p._count.schedules}</td>
                    <td>{p.tipoDeLista === 'data' ? t('tipoData') : t('tipoFila')}</td>
                    <td>
                      {p.tipoDeLista === 'data' ? (
                        <span className="pill">
                          {t('textosNaLista', { quantidade: p._count.textos })}
                        </span>
                      ) : (
                        <span
                          className={
                            pendentes === 0
                              ? 'pill err'
                              : p.alertaDeFilaCurtaAtivo && pendentes < p.alertarAbaixoDe
                                ? 'pill warn'
                                : 'pill'
                          }
                        >
                          {t('pendentes', { quantidade: pendentes })}
                        </span>
                      )}
                    </td>
                    <td>
                      {p.aoEsgotar === 'reiniciar'
                        ? comum('reiniciarFila')
                        : comum('pararNotificar')}
                    </td>
                    <td>
                      <span className={p.ativa ? 'pill ok' : 'pill'}>
                        {p.ativa ? t('ativa') : comum('inativa')}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link className="btn sm" href={`/pastas/${p.id}`}>
                        {t('configurar')}
                      </Link>{' '}
                      <Link className="btn sm" href={`/textos?pasta=${p.id}`}>
                        {menu('textos')}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {orgEmVigor ? (
        <div className="card">
          <header>
            <h2>{t('novaPasta')}</h2>
          </header>
          <div className="body">
            <form action={criarPasta}>
              <CampoCsrf token={csrf} />
              <div className="row">
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">{t('nome')}</span>
                  <input type="text" name="nome" required />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">{t('descricao')}</span>
                  <input type="text" name="descricao" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    {t('fusoHorario')}
                    <Ajuda texto={t('fusoHint')} rotulo={comum('ajudaSobre', { campo: t('fusoHorario') })} />
                  </span>
                  <input
                    type="text"
                    name="timezone"
                    defaultValue={organizacao?.timezonePadrao ?? 'America/Sao_Paulo'}
                    required
                  />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    {t('chatId')}
                    <Ajuda texto={t('chatIdHint')} rotulo={comum('ajudaSobre', { campo: t('chatId') })} />
                  </span>
                  <input type="text" name="telegramChatId" placeholder="-100…" />
                </label>
                <CamposDoTipoDeListaEmLinha />
              </div>
              <button className="btn primary" type="submit" style={{ marginTop: 4 }}>
                {t('criarPasta')}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </Casca>
  );
}
