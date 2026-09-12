import { redirect } from 'next/navigation';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { podeFazer, perfisQuePodeGerenciar } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDeUsuario, escopoDePasta, organizacaoEmVigor } from '@/lib/escopo';
import { criarUsuario, editarUsuario, redefinirSenha, atribuirPastas } from './acoes';

export const dynamic = 'force-dynamic';

const ROTULO_DO_PERFIL = { superadmin: 'superadmin', admin: 'admin', usuario: 'usuário' } as const;
const IDIOMAS = [
  { valor: '', rotulo: 'Padrão da organização' },
  { valor: 'pt', rotulo: 'Português' },
  { valor: 'es', rotulo: 'Español' },
  { valor: 'en', rotulo: 'English' },
];

export default async function Usuarios({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; editar?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'usuarios.gerenciar')) redirect('/inicio');

  const { erro, ok, editar } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);
  const orgEmVigor = organizacaoEmVigor(sessao);

  const usuarios = await prisma.user.findMany({
    where: escopoDeUsuario(sessao),
    orderBy: [{ perfil: 'asc' }, { nome: 'asc' }],
    include: {
      organization: { select: { nome: true } },
      folders: { include: { folder: { select: { id: true, nome: true } } } },
    },
  });
  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });
  const emEdicao = editar ? usuarios.find((u) => u.id === editar) : undefined;
  const perfisDisponiveis = perfisQuePodeGerenciar(sessao.perfil);

  return (
    <Casca sessao={sessao} titulo="Usuários" caminho="Configuração" atual="/usuarios">
      <Avisos erro={erro} ok={ok} />

      <div className="banner info">
        <div>
          Não existe cadastro público. Cada conta é criada por quem está acima na hierarquia, com{' '}
          <b>senha provisória</b> e troca obrigatória no primeiro acesso. O e-mail serve apenas como
          identificador de login — o sistema não envia e-mail algum. <b>Telegram e telefone são
          opcionais</b> e existem para localizar a pessoa.
        </div>
      </div>

      {sessao.perfil === 'superadmin' && !orgEmVigor ? (
        <div className="banner warn">
          <div>
            Nenhuma organização ativa escolhida. Você está vendo apenas os superadmins; escolha uma
            organização no seletor do topo para gerenciar os usuários dela.
          </div>
        </div>
      ) : null}

      <div className="card">
        <header>
          <h2>Usuários</h2>
          <span className="spacer" />
          <span className="sub">{usuarios.length} no total</span>
        </header>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contato</th>
              {sessao.perfil === 'superadmin' ? <th>Organização</th> : null}
              <th>Perfil</th>
              <th>Pastas atribuídas</th>
              <th>Último acesso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{u.nome}</b>
                  {u.senhaProvisoria ? <span className="pill warn" style={{ marginLeft: 6 }}>senha provisória</span> : null}
                  {!u.ativo ? <span className="pill" style={{ marginLeft: 6 }}>inativo</span> : null}
                </td>
                <td className="mono">
                  {u.email}
                  <div className="faint">
                    {[u.telegramUsername, u.telefone].filter(Boolean).join(' · ') || '—'}
                  </div>
                </td>
                {sessao.perfil === 'superadmin' ? (
                  <td>{u.organization?.nome ?? <span className="faint">— (global)</span>}</td>
                ) : null}
                <td>
                  <span className={u.perfil === 'superadmin' ? 'pill accent' : u.perfil === 'admin' ? 'pill info' : 'pill'}>
                    {ROTULO_DO_PERFIL[u.perfil]}
                  </span>
                </td>
                <td>
                  {u.perfil === 'usuario' ? (
                    u.folders.length ? (
                      u.folders.map((f) => f.folder.nome).join(', ')
                    ) : (
                      <span className="faint">nenhuma</span>
                    )
                  ) : (
                    <span className="faint">toda a organização</span>
                  )}
                </td>
                <td>
                  {u.ultimoLoginEm ? (
                    u.ultimoLoginEm.toLocaleString('pt-BR')
                  ) : (
                    <span className="faint">nunca entrou</span>
                  )}
                </td>
                <td>
                  <a className="btn sm" href={`/usuarios?editar=${u.id}`}>
                    Editar
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {emEdicao ? (
        <div className="card">
          <header>
            <h2>Editar usuário — {emEdicao.nome}</h2>
            <span className="spacer" />
            <a className="btn sm" href="/usuarios">
              Fechar
            </a>
          </header>
          <div className="body">
            <form action={editarUsuario}>
              <CampoCsrf token={csrf} />
              <input type="hidden" name="id" value={emEdicao.id} />
              <div className="row">
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">Nome</span>
                  <input type="text" name="nome" defaultValue={emEdicao.nome} required />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">E-mail (login)</span>
                  <input type="email" defaultValue={emEdicao.email} disabled />
                  <span className="hint">É a credencial de entrada e não muda por aqui.</span>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    Telegram <span className="faint">(opcional)</span>
                  </span>
                  <input type="text" name="telegramUsername" defaultValue={emEdicao.telegramUsername ?? ''} placeholder="@usuario" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    Telefone <span className="faint">(opcional)</span>
                  </span>
                  <input type="text" name="telefone" defaultValue={emEdicao.telefone ?? ''} />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">Perfil</span>
                  <select name="perfil" defaultValue={emEdicao.perfil}>
                    {[...new Set([emEdicao.perfil, ...perfisDisponiveis])].map((p) => (
                      <option key={p} value={p}>
                        {ROTULO_DO_PERFIL[p]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">Idioma da interface</span>
                  <select name="idioma" defaultValue={emEdicao.idioma ?? ''}>
                    {IDIOMAS.map((i) => (
                      <option key={i.valor} value={i.valor}>
                        {i.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="check">
                <input type="checkbox" id="ativo" name="ativo" defaultChecked={emEdicao.ativo} />
                <label htmlFor="ativo">
                  Conta ativa <span className="faint">— desativar encerra as sessões abertas na hora</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn primary" type="submit">
                  Salvar
                </button>
              </div>
            </form>

            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />

            <form action={redefinirSenha}>
              <CampoCsrf token={csrf} />
              <input type="hidden" name="id" value={emEdicao.id} />
              <button className="btn" type="submit">
                Redefinir senha (gera provisória)
              </button>
              <span className="faint" style={{ marginLeft: 10 }}>
                Encerra todas as sessões abertas do usuário.
              </span>
            </form>

            {emEdicao.perfil === 'usuario' ? (
              <>
                <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />
                <form action={atribuirPastas}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={emEdicao.id} />
                  <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>Pastas atribuídas</h3>
                  {pastas.length === 0 ? (
                    <p className="faint" style={{ marginTop: 0 }}>
                      Nenhuma pasta cadastrada nesta organização ainda.
                    </p>
                  ) : (
                    pastas.map((p) => (
                      <div className="check" key={p.id}>
                        <input
                          type="checkbox"
                          id={`pasta-${p.id}`}
                          name="pastas"
                          value={p.id}
                          defaultChecked={emEdicao.folders.some((f) => f.folderId === p.id)}
                        />
                        <label htmlFor={`pasta-${p.id}`}>{p.nome}</label>
                      </div>
                    ))
                  )}
                  <button className="btn" type="submit" style={{ marginTop: 10 }}>
                    Salvar pastas
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="card">
          <header>
            <h2>Novo usuário</h2>
          </header>
          <div className="body">
            <form action={criarUsuario}>
              <CampoCsrf token={csrf} />
              <div className="row">
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">Nome</span>
                  <input type="text" name="nome" required />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">E-mail (login)</span>
                  <input type="email" name="email" required />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    Telegram <span className="faint">(opcional)</span>
                  </span>
                  <input type="text" name="telegramUsername" placeholder="@usuario" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    Telefone <span className="faint">(opcional)</span>
                  </span>
                  <input type="text" name="telefone" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">Perfil</span>
                  <select name="perfil" defaultValue="usuario">
                    {perfisDisponiveis.map((p) => (
                      <option key={p} value={p}>
                        {ROTULO_DO_PERFIL[p]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="btn primary" type="submit" style={{ marginTop: 4 }}>
                Criar usuário
              </button>
              <p className="faint" style={{ margin: '10px 0 0' }}>
                A senha provisória aparece uma única vez, aqui na tela, para você repassar à pessoa.
              </p>
            </form>
          </div>
        </div>
      )}
    </Casca>
  );
}
