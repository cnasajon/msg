import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Casca } from '@/components/casca';
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

const ROTULO_DA_ACAO: Record<string, string> = {
  criar: 'criar',
  editar: 'editar',
  excluir: 'excluir',
  login: 'entrar',
  trocar_senha: 'trocar senha',
  redefinir_senha: 'redefinir senha',
  atribuir_pastas: 'atribuir pastas',
  trocar_organizacao: 'trocar organização',
  importar: 'importar',
  desfazer_importacao: 'desfazer importação',
  exportar: 'exportar',
  arquivar: 'arquivar',
  desarquivar: 'desarquivar',
  reordenar: 'reordenar fila',
  pular: 'pular texto',
  publicar_agora: 'publicar agora',
  reiniciar_fila: 'reiniciar fila',
  testar_conexao: 'testar conexão',
  testar_alerta: 'testar alerta',
  definir_token_sobreposicao: 'definir token de sobreposição',
  remover_token_sobreposicao: 'remover token de sobreposição',
  alerta: 'alerta',
};

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

  const filtros = await searchParams;
  const porPagina = 50;
  const pagina = Math.max(1, Number(filtros.pagina ?? 1) || 1);
  const acao = filtros.acao && ROTULO_DA_ACAO[filtros.acao] ? filtros.acao : '';
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
    <Casca sessao={sessao} titulo="Log de auditoria" caminho="Configuração" atual="/auditoria">
      <div className="banner info">
        <div>
          Toda criação, edição, exclusão e publicação fica registrada.{' '}
          {sessao.perfil === 'superadmin'
            ? 'Como superadmin, você vê todas as organizações.'
            : 'Você vê os registros da sua organização.'}{' '}
          Nenhum valor de segredo é guardado aqui — a auditoria registra que um token ou uma senha
          mudou, nunca o que eles passaram a ser.
        </div>
      </div>

      <div className="card">
        <form className="toolbar" method="get">
          <select name="acao" defaultValue={acao}>
            <option value="">Todas as ações</option>
            {Object.entries(ROTULO_DA_ACAO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <select name="entidade" defaultValue={entidade}>
            <option value="">Todas as entidades</option>
            {ENTIDADES.filter(Boolean).map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            Filtrar
          </button>
          <span className="spacer" />
          <span className="faint">
            {total} registro(s) · página {pagina} de {paginas}
          </span>
        </form>

        <table>
          <thead>
            <tr>
              <th style={{ width: 160 }}>Quando</th>
              <th style={{ width: 170 }}>Quem</th>
              {sessao.perfil === 'superadmin' ? <th style={{ width: 150 }}>Organização</th> : null}
              <th style={{ width: 180 }}>Ação</th>
              <th style={{ width: 120 }}>Entidade</th>
              <th>Detalhes</th>
              <th style={{ width: 120 }}>IP</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={7} className="faint">
                  Nenhum registro com esses filtros.
                </td>
              </tr>
            ) : (
              registros.map((r) => (
                <tr key={r.id}>
                  <td>{formatarNoFuso(r.criadoEm, 'America/Sao_Paulo')}</td>
                  <td>
                    {r.user?.nome ?? <span className="faint">sistema (worker)</span>}
                  </td>
                  {sessao.perfil === 'superadmin' ? (
                    <td>{r.organization?.nome ?? <span className="faint">—</span>}</td>
                  ) : null}
                  <td>
                    <span className={CLASSE_DA_ACAO[r.acao] ?? 'pill'}>
                      {ROTULO_DA_ACAO[r.acao] ?? r.acao}
                    </span>
                  </td>
                  <td className="mono">{r.entidade}</td>
                  <td className="faint">
                    {r.detalhes ? (
                      <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {JSON.stringify(r.detalhes)}
                      </code>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="mono">{r.ip ?? <span className="faint">—</span>}</td>
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
                ← Anteriores
              </Link>
            ) : null}
            {pagina < paginas ? (
              <Link className="btn sm" href={parametros(pagina + 1)}>
                Seguintes →
              </Link>
            ) : null}
            <span className="faint">
              página {pagina} de {paginas}
            </span>
          </div>
        ) : null}
      </div>
    </Casca>
  );
}
