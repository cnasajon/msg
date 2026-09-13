import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { Ajuda } from '@/components/ajuda';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDeOrganizacao } from '@/lib/escopo';
import { IDIOMAS, NOME_DO_IDIOMA, type Idioma } from '@/i18n/idiomas';
import { criarOrganizacao, editarOrganizacao } from './acoes';

export const dynamic = 'force-dynamic';


export default async function Organizacoes({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; editar?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'organizacoes.gerenciar')) redirect('/inicio');

  const t = await getTranslations('organizacoes');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');
  const idioma = await getLocale();

  const { erro, ok, editar } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  const organizacoes = await prisma.organization.findMany({
    where: escopoDeOrganizacao(sessao),
    orderBy: { nome: 'asc' },
    include: { _count: { select: { folders: true, users: true } } },
  });
  const emEdicao = editar ? organizacoes.find((o) => o.id === editar) : undefined;

  return (
    <Casca
      sessao={sessao}
      titulo={t('titulo')}
      caminho={`${menu('sistema')} · ${t('soSuperadmin')}`}
      atual="/organizacoes"
    >
      <Avisos erro={erro} ok={ok} />

      <div className="banner info">
        <div>{t('explicacao')}</div>
      </div>

      <div className="card">
        <header>
          <h2>{t('cadastradas')}</h2>
          <span className="spacer" />
          <span className="sub">{t('noTotal', { quantidade: organizacoes.length })}</span>
        </header>
        <table>
          <thead>
            <tr>
              <th>{t('organizacao')}</th>
              <th>{t('idiomaPadrao')}</th>
              <th>{t('fusoPadrao')}</th>
              <th className="num">{t('pastas')}</th>
              <th className="num">{t('usuarios')}</th>
              <th>{t('situacao')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {organizacoes.length === 0 ? (
              <tr>
                <td colSpan={7} className="faint">
                  {t('nenhuma')}
                </td>
              </tr>
            ) : (
              organizacoes.map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>{o.nome}</b>
                    <div className="faint">
                      {t('criadaEm', { quando: o.criadaEm.toLocaleDateString(idioma) })}
                    </div>
                  </td>
                  <td>{NOME_DO_IDIOMA[o.idiomaPadrao as Idioma] ?? o.idiomaPadrao}</td>
                  <td>{o.timezonePadrao}</td>
                  <td className="num">{o._count.folders}</td>
                  <td className="num">{o._count.users}</td>
                  <td>
                    <span className={o.ativa ? 'pill ok' : 'pill'}>
                      {o.ativa ? t('ativa') : comum('inativa')}
                    </span>
                  </td>
                  <td>
                    <a className="btn sm" href={`/organizacoes?editar=${o.id}`}>
                      {t('editar')}
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <header>
          <h2>{emEdicao ? t('editarTitulo', { nome: emEdicao.nome }) : t('nova')}</h2>
        </header>
        <div className="body">
          <form action={emEdicao ? editarOrganizacao : criarOrganizacao}>
            <CampoCsrf token={csrf} />
            {emEdicao ? <input type="hidden" name="id" value={emEdicao.id} /> : null}
            <div className="row">
              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">{t('nome')}</span>
                <input type="text" name="nome" defaultValue={emEdicao?.nome ?? ''} required />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">
                  {t('idiomaPadrao')}
                  <Ajuda texto={t('idiomaHint')} rotulo={comum('ajudaSobre', { campo: t('idiomaPadrao') })} />
                </span>
                <select name="idiomaPadrao" defaultValue={emEdicao?.idiomaPadrao ?? 'pt'}>
                  {IDIOMAS.map((codigo) => (
                    <option key={codigo} value={codigo}>
                      {NOME_DO_IDIOMA[codigo]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">
                  {t('fusoPadrao')}
                  <Ajuda texto={t('fusoHint')} rotulo={comum('ajudaSobre', { campo: t('fusoPadrao') })} />
                </span>
                <input
                  type="text"
                  name="timezonePadrao"
                  defaultValue={emEdicao?.timezonePadrao ?? 'America/Sao_Paulo'}
                  required
                />
              </label>
            </div>
            {emEdicao ? (
              <div className="check">
                <input type="checkbox" id="ativa" name="ativa" defaultChecked={emEdicao.ativa} />
                <label htmlFor="ativa">
                  {t('organizacaoAtiva')}{' '}
                  <span className="faint">{t('desativarSuspende')}</span>
                </label>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn primary" type="submit">
                {emEdicao ? comum('salvar') : t('criar')}
              </button>
              {emEdicao ? (
                <a className="btn" href="/organizacoes">
                  {comum('cancelar')}
                </a>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </Casca>
  );
}
