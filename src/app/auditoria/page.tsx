import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { DetalhesDaAuditoria } from '@/components/detalhes-da-auditoria';
import { sessaoAtual } from '@/lib/sessao';
import { podeFazer } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDeAuditoria } from '@/lib/escopo';
import { formatarNoFuso } from '@/lib/fuso';

export const dynamic = 'force-dynamic';

/**
 * Log de auditoria. O admin ve a propria organizacao; o superadmin ve todas.
 *
 * Nada aqui mostra valor de segredo: a auditoria registra que um token ou uma
 * senha mudou, nunca o que eles passaram a ser.
 */

/** As acoes registradas; os rotulos vivem no grupo `acoesDaAuditoria`. */
const ACOES = [
  'criar',
  'editar',
  'excluir',
  'login',
  'trocar_senha',
  'redefinir_senha',
  'definir_senha',
  'atribuir_pastas',
  'definir_organizacoes',
  'trocar_organizacao',
  'importar',
  'desfazer_importacao',
  'exportar',
  'arquivar',
  'desarquivar',
  'reordenar',
  'mover',
  'pular',
  'publicar_agora',
  'reiniciar_fila',
  'testar_conexao',
  'testar_alerta',
  'definir_token_sobreposicao',
  'remover_token_sobreposicao',
  'alerta',
];

const CLASSE_DA_ACAO: Record<string, string> = {
  excluir: 'pill err',
  alerta: 'pill warn',
  publicar_agora: 'pill ok',
  reiniciar_fila: 'pill warn',
  trocar_organizacao: 'pill info',
  login: 'pill info',
};

const ENTIDADES = [
  '', 'organization', 'user', 'folder', 'text', 'schedule', 'publication', 'import', 'settings', 'alerta',
];

export default async function Auditoria({
  searchParams,
}: {
  searchParams: Promise<{ acao?: string; entidade?: string; pagina?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'auditoria.ver')) redirect('/inicio');

  const t = await getTranslations('auditoria');
  const acoes = await getTranslations('acoesDaAuditoria');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');
  const idioma = await getLocale();

  const filtros = await searchParams;
  const porPagina = 50;
  const pagina = Math.max(1, Number(filtros.pagina ?? 1) || 1);
  const acao = filtros.acao && ACOES.includes(filtros.acao) ? filtros.acao : '';
  const entidade = ENTIDADES.includes(filtros.entidade ?? '') ? (filtros.entidade ?? '') : '';

  const onde = {
    AND: [escopoDeAuditoria(sessao), acao ? { acao } : {}, entidade ? { entidade } : {}],
  };

  const [registros, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: onde,
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      include: {
        user: { select: { nome: true } },
        organization: { select: { nome: true } },
      },
    }),
    prisma.auditLog.count({ where: onde }),
  ]);
  const paginas = Math.max(1, Math.ceil(total / porPagina));

  const parametros = (novaPagina: number) => {
    const p = new URLSearchParams();
    if (acao) p.set('acao', acao);
    if (entidade) p.set('entidade', entidade);
    p.set('pagina', String(novaPagina));
    return `/auditoria?${p.toString()}`;
  };

  return (
    <Casca sessao={sessao} titulo={t('titulo')} caminho={menu('configuracao')} atual="/auditoria">
      <div className="banner info">
        <div>
          {t('explicacao')}{' '}
          {sessao.perfil === 'superadmin' ? t('comoSuperadmin') : t('comoAdmin')}{' '}
          {t('semSegredos')}
        </div>
      </div>

      <div className="card">
        <form className="toolbar" method="get">
          <select name="acao" defaultValue={acao}>
            <option value="">{t('todasAsAcoes')}</option>
            {ACOES.map((valor) => (
              <option key={valor} value={valor}>
                {acoes(valor)}
              </option>
            ))}
          </select>
          <select name="entidade" defaultValue={entidade}>
            <option value="">{t('todasAsEntidades')}</option>
            {ENTIDADES.filter(Boolean).map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            {comum('filtrar')}
          </button>
          <span className="spacer" />
          <span className="faint">{t('contagem', { total, pagina, paginas })}</span>
        </form>

        <table>
          <thead>
            <tr>
              <th style={{ width: 160 }}>{t('quando')}</th>
              <th style={{ width: 170 }}>{t('quem')}</th>
              {sessao.perfil === 'superadmin' ? (
                <th style={{ width: 150 }}>{t('organizacao')}</th>
              ) : null}
              <th style={{ width: 180 }}>{t('acao')}</th>
              <th style={{ width: 120 }}>{t('entidade')}</th>
              <th style={{ width: 120 }}>{t('detalhes')}</th>
              <th style={{ width: 120 }}>IP</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={7} className="faint">
                  {t('nenhum')}
                </td>
              </tr>
            ) : (
              registros.map((r) => (
                <tr key={r.id}>
                  <td>{formatarNoFuso(r.criadoEm, 'America/Sao_Paulo', idioma)}</td>
                  <td>
                    {r.user?.nome ?? <span className="faint">{t('sistema')}</span>}
                  </td>
                  {sessao.perfil === 'superadmin' ? (
                    <td>
                      {r.organization?.nome ?? <span className="faint">{comum('nenhum')}</span>}
                    </td>
                  ) : null}
                  <td>
                    <span className={CLASSE_DA_ACAO[r.acao] ?? 'pill'}>
                      {ACOES.includes(r.acao) ? acoes(r.acao) : r.acao}
                    </span>
                  </td>
                  <td className="mono">{r.entidade}</td>
                  <td>
                    {r.detalhes ? (
                      <DetalhesDaAuditoria
                        detalhes={r.detalhes}
                        resumo={[
                          formatarNoFuso(r.criadoEm, 'America/Sao_Paulo', idioma),
                          r.user?.nome ?? t('sistema'),
                          ACOES.includes(r.acao) ? acoes(r.acao) : r.acao,
                          r.entidade,
                        ].join(' · ')}
                      />
                    ) : (
                      <span className="faint">{comum('nenhum')}</span>
                    )}
                  </td>
                  <td className="mono">
                    {r.ip ?? <span className="faint">{comum('nenhum')}</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {paginas > 1 ? (
          <div
            className="body"
            style={{ borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}
          >
            {pagina > 1 ? (
              <Link className="btn sm" href={parametros(pagina - 1)}>
                {t('anteriores')}
              </Link>
            ) : null}
            {pagina < paginas ? (
              <Link className="btn sm" href={parametros(pagina + 1)}>
                {t('seguintes')}
              </Link>
            ) : null}
            <span className="faint">{t('pagina', { pagina, paginas })}</span>
          </div>
        ) : null}
      </div>
    </Casca>
  );
}
