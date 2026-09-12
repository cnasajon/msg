import { redirect } from 'next/navigation';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDeOrganizacao } from '@/lib/escopo';
import { criarOrganizacao, editarOrganizacao } from './acoes';

export const dynamic = 'force-dynamic';

const IDIOMAS = [
  { valor: 'pt', rotulo: 'Português' },
  { valor: 'es', rotulo: 'Español' },
  { valor: 'en', rotulo: 'English' },
];

export default async function Organizacoes({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; editar?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'organizacoes.gerenciar')) redirect('/inicio');

  const { erro, ok, editar } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  const organizacoes = await prisma.organization.findMany({
    where: escopoDeOrganizacao(sessao),
    orderBy: { nome: 'asc' },
    include: { _count: { select: { folders: true, users: true } } },
  });
  const emEdicao = editar ? organizacoes.find((o) => o.id === editar) : undefined;

  return (
    <Casca sessao={sessao} titulo="Organizações" caminho="Sistema · só superadmin" atual="/organizacoes">
      <Avisos erro={erro} ok={ok} />

      <div className="banner info">
        <div>
          Cada organização opera de forma independente: suas pastas, seus grupos de Telegram e seus
          usuários. Toda troca de organização ativa fica registrada na auditoria.
        </div>
      </div>

      <div className="card">
        <header>
          <h2>Organizações cadastradas</h2>
          <span className="spacer" />
          <span className="sub">{organizacoes.length} no total</span>
        </header>
        <table>
          <thead>
            <tr>
              <th>Organização</th>
              <th>Idioma padrão</th>
              <th>Fuso padrão</th>
              <th className="num">Pastas</th>
              <th className="num">Usuários</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {organizacoes.length === 0 ? (
              <tr>
                <td colSpan={7} className="faint">
                  Nenhuma organização ainda. Crie a primeira no formulário abaixo.
                </td>
              </tr>
            ) : (
              organizacoes.map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>{o.nome}</b>
                    <div className="faint">criada em {o.criadaEm.toLocaleDateString('pt-BR')}</div>
                  </td>
                  <td>{IDIOMAS.find((i) => i.valor === o.idiomaPadrao)?.rotulo ?? o.idiomaPadrao}</td>
                  <td>{o.timezonePadrao}</td>
                  <td className="num">{o._count.folders}</td>
                  <td className="num">{o._count.users}</td>
                  <td>
                    <span className={o.ativa ? 'pill ok' : 'pill'}>{o.ativa ? 'ativa' : 'inativa'}</span>
                  </td>
                  <td>
                    <a className="btn sm" href={`/organizacoes?editar=${o.id}`}>
                      Editar
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
          <h2>{emEdicao ? `Editar — ${emEdicao.nome}` : 'Nova organização'}</h2>
        </header>
        <div className="body">
          <form action={emEdicao ? editarOrganizacao : criarOrganizacao}>
            <CampoCsrf token={csrf} />
            {emEdicao ? <input type="hidden" name="id" value={emEdicao.id} /> : null}
            <div className="row">
              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">Nome</span>
                <input type="text" name="nome" defaultValue={emEdicao?.nome ?? ''} required />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">Idioma padrão</span>
                <select name="idiomaPadrao" defaultValue={emEdicao?.idiomaPadrao ?? 'pt'}>
                  {IDIOMAS.map((i) => (
                    <option key={i.valor} value={i.valor}>
                      {i.rotulo}
                    </option>
                  ))}
                </select>
                <span className="hint">Cada usuário pode sobrepor o idioma no próprio perfil.</span>
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">Fuso padrão</span>
                <input
                  type="text"
                  name="timezonePadrao"
                  defaultValue={emEdicao?.timezonePadrao ?? 'America/Sao_Paulo'}
                  required
                />
                <span className="hint">Valor inicial das pastas novas; cada pasta tem o seu.</span>
              </label>
            </div>
            {emEdicao ? (
              <div className="check">
                <input type="checkbox" id="ativa" name="ativa" defaultChecked={emEdicao.ativa} />
                <label htmlFor="ativa">
                  Organização ativa <span className="faint">— desativar suspende publicações e acesso, sem apagar nada</span>
                </label>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn primary" type="submit">
                {emEdicao ? 'Salvar' : 'Criar organização'}
              </button>
              {emEdicao ? (
                <a className="btn" href="/organizacoes">
                  Cancelar
                </a>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </Casca>
  );
}
