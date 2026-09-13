import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { Ajuda } from '@/components/ajuda';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { podeFazer, perfisQuePodeGerenciar } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDeUsuario, escopoDePasta, escopoDeOrganizacao, organizacaoEmVigor } from '@/lib/escopo';
import { IDIOMAS, NOME_DO_IDIOMA } from '@/i18n/idiomas';
import { TAMANHO_MINIMO_DA_SENHA } from '@/lib/senha';
import {
  criarUsuario,
  editarUsuario,
  redefinirSenha,
  definirSenha,
  atribuirPastas,
  definirOrganizacoes,
} from './acoes';

export const dynamic = 'force-dynamic';


export default async function Usuarios({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; editar?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'usuarios.gerenciar')) redirect('/inicio');

  const t = await getTranslations('usuarios');
  const perfis = await getTranslations('perfis');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');
  const idioma = await getLocale();

  const { erro, ok, editar } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);
  const orgEmVigor = organizacaoEmVigor(sessao);

  const usuarios = await prisma.user.findMany({
    where: escopoDeUsuario(sessao),
    orderBy: [{ perfil: 'asc' }, { nome: 'asc' }],
    include: {
      organizacoes: { include: { organization: { select: { id: true, nome: true } } } },
      folders: { include: { folder: { select: { id: true, nome: true } } } },
    },
  });
  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });
  // A lista para o formulário de participação. Só o superadmin a vê, e para ele
  // `escopoDeOrganizacao` devolve todas.
  const organizacoes = podeFazer(sessao.perfil, 'organizacoes.gerenciar')
    ? await prisma.organization.findMany({
        where: escopoDeOrganizacao(sessao),
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true, ativa: true },
      })
    : [];
  const emEdicao = editar ? usuarios.find((u) => u.id === editar) : undefined;
  const perfisDisponiveis = perfisQuePodeGerenciar(sessao.perfil);

  return (
    <Casca sessao={sessao} titulo={t('titulo')} caminho={menu('configuracao')} atual="/usuarios">
      <Avisos erro={erro} ok={ok} />

      <div className="banner info">
        <div>{t.rich('explicacao', { b: (partes) => <b>{partes}</b> })}</div>
      </div>

      {sessao.perfil === 'superadmin' && !orgEmVigor ? (
        <div className="banner warn">
          <div>{t('semOrganizacao')}</div>
        </div>
      ) : null}

      <div className="card">
        <header>
          <h2>{t('titulo')}</h2>
          <span className="spacer" />
          <span className="sub">{t('noTotal', { quantidade: usuarios.length })}</span>
        </header>
        <table>
          <thead>
            <tr>
              <th>{t('nome')}</th>
              <th>{t('usuario')}</th>
              {sessao.perfil === 'superadmin' ? <th>{t('organizacao')}</th> : null}
              <th>{t('perfil')}</th>
              <th>{t('pastasAtribuidas')}</th>
              <th>{t('ultimoAcesso')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{u.nome}</b>
                  {u.senhaProvisoria ? (
                    <span className="pill warn" style={{ marginLeft: 6 }}>
                      {t('senhaProvisoria')}
                    </span>
                  ) : null}
                  {!u.ativo ? (
                    <span className="pill" style={{ marginLeft: 6 }}>
                      {t('inativo')}
                    </span>
                  ) : null}
                </td>
                <td className="mono">
                  {u.username}
                  <div className="faint">
                    {[u.email, u.telegramUsername, u.telefone].filter(Boolean).join(' · ') ||
                      comum('nenhum')}
                  </div>
                </td>
                {sessao.perfil === 'superadmin' ? (
                  <td>
                    {u.organizacoes.length > 0 ? (
                      u.organizacoes.map((o) => o.organization.nome).join(' · ')
                    ) : (
                      <span className="faint">{t('global')}</span>
                    )}
                  </td>
                ) : null}
                <td>
                  <span className={u.perfil === 'superadmin' ? 'pill accent' : u.perfil === 'admin' ? 'pill info' : 'pill'}>
                    {perfis(u.perfil)}
                  </span>
                </td>
                <td>
                  {u.perfil === 'usuario' ? (
                    u.folders.length ? (
                      u.folders.map((f) => f.folder.nome).join(', ')
                    ) : (
                      <span className="faint">{t('nenhuma')}</span>
                    )
                  ) : (
                    <span className="faint">{t('todaOrganizacao')}</span>
                  )}
                </td>
                <td>
                  {u.ultimoLoginEm ? (
                    u.ultimoLoginEm.toLocaleString(idioma)
                  ) : (
                    <span className="faint">{t('nuncaEntrou')}</span>
                  )}
                </td>
                <td>
                  <a className="btn sm" href={`/usuarios?editar=${u.id}`}>
                    {t('editar')}
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
            <h2>{t('editarUsuario', { nome: emEdicao.nome })}</h2>
            <span className="spacer" />
            <a className="btn sm" href="/usuarios">
              {t('fechar')}
            </a>
          </header>
          <div className="body">
            <form action={editarUsuario}>
              <CampoCsrf token={csrf} />
              <input type="hidden" name="id" value={emEdicao.id} />
              <div className="row">
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">{t('nome')}</span>
                  <input type="text" name="nome" defaultValue={emEdicao.nome} required />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    {t('usuario')}
                    <Ajuda texto={t('usuarioHint')} rotulo={comum('ajudaSobre', { campo: t('usuario') })} />
                  </span>
                  <input
                    type="text"
                    name="username"
                    defaultValue={emEdicao.username}
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                  />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    {t('email')} <span className="faint">{t('opcional')}</span>
                    <Ajuda texto={t('emailHint')} rotulo={comum('ajudaSobre', { campo: t('email') })} />
                  </span>
                  <input type="email" name="email" defaultValue={emEdicao.email ?? ''} />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    {t('telegram')} <span className="faint">{t('opcional')}</span>
                  </span>
                  <input type="text" name="telegramUsername" defaultValue={emEdicao.telegramUsername ?? ''} placeholder="@usuario" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    {t('telefone')} <span className="faint">{t('opcional')}</span>
                  </span>
                  <input type="text" name="telefone" defaultValue={emEdicao.telefone ?? ''} />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">{t('perfil')}</span>
                  <select name="perfil" defaultValue={emEdicao.perfil}>
                    {[...new Set([emEdicao.perfil, ...perfisDisponiveis])].map((p) => (
                      <option key={p} value={p}>
                        {perfis(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">{t('idiomaDaInterface')}</span>
                  <select name="idioma" defaultValue={emEdicao.idioma ?? ''}>
                    <option value="">{t('idiomaPadrao')}</option>
                    {IDIOMAS.map((codigo) => (
                      <option key={codigo} value={codigo}>
                        {NOME_DO_IDIOMA[codigo]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="check">
                <input type="checkbox" id="ativo" name="ativo" defaultChecked={emEdicao.ativo} />
                <label htmlFor="ativo">
                  {t('contaAtiva')} <span className="faint">{t('desativarEncerra')}</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn primary" type="submit">
                  {comum('salvar')}
                </button>
              </div>
            </form>

            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />

            <form action={redefinirSenha}>
              <CampoCsrf token={csrf} />
              <input type="hidden" name="id" value={emEdicao.id} />
              <button className="btn" type="submit">
                {t('redefinirSenha')}
              </button>
              <span className="faint" style={{ marginLeft: 10 }}>
                {t('redefinirExplicacao')}
              </span>
            </form>

            <h3 style={{ fontSize: 13, margin: '18px 0 8px' }}>{t('definirSenha')}</h3>
            <form action={definirSenha}>
              <CampoCsrf token={csrf} />
              <input type="hidden" name="id" value={emEdicao.id} />
              <div className="row">
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    {t('novaSenha')}
                    <Ajuda
                      texto={t('regraDaSenha', { minimo: TAMANHO_MINIMO_DA_SENHA })}
                      rotulo={comum('ajudaSobre', { campo: t('novaSenha') })}
                    />
                  </span>
                  <input type="password" name="senha" autoComplete="new-password" required />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">{t('repetirSenha')}</span>
                  <input type="password" name="senhaRepetida" autoComplete="new-password" required />
                </label>
              </div>
              <div className="check" style={{ marginTop: 12 }}>
                <input type="checkbox" id="exigir-troca" name="exigirTroca" defaultChecked />
                <label htmlFor="exigir-troca">{t('exigirTroca')}</label>
              </div>
              <button className="btn" type="submit">
                {t('definirSenha')}
              </button>
              <span className="faint" style={{ marginLeft: 10 }}>
                {t('definirExplicacao')}
              </span>
            </form>

            {/* De quais organizações a pessoa participa — só o superadmin. Um
                admin enxerga uma organização só; para escolher outra teria de
                enxergar todas, e poderia incluir a si mesmo onde quisesse. */}
            {podeFazer(sessao.perfil, 'organizacoes.gerenciar') && emEdicao.perfil !== 'superadmin' ? (
              <>
                <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />
                <form action={definirOrganizacoes}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={emEdicao.id} />
                  <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>
                    {t('organizacoesDoUsuario')}
                    <Ajuda
                      texto={t('organizacoesExplicacao')}
                      rotulo={comum('ajudaSobre', { campo: t('organizacoesDoUsuario') })}
                    />
                  </h3>
                  {organizacoes.map((o) => (
                    <div className="check" key={o.id}>
                      <input
                        type="checkbox"
                        id={`org-${o.id}`}
                        name="organizacoes"
                        value={o.id}
                        defaultChecked={emEdicao.organizacoes.some((x) => x.organizationId === o.id)}
                      />
                      <label htmlFor={`org-${o.id}`}>
                        {o.nome}
                        {o.ativa ? '' : ` (${comum('inativa')})`}
                      </label>
                    </div>
                  ))}
                  <button className="btn" type="submit" style={{ marginTop: 8 }}>
                    {t('salvarOrganizacoes')}
                  </button>
                  <span className="faint" style={{ marginLeft: 10 }}>
                    {t('tirarOrganizacaoAviso')}
                  </span>
                </form>
              </>
            ) : null}

            {emEdicao.perfil === 'usuario' ? (
              <>
                <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />
                <form action={atribuirPastas}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={emEdicao.id} />
                  <h3 style={{ fontSize: 13, margin: '0 0 8px' }}>{t('pastasAtribuidas')}</h3>
                  {pastas.length === 0 ? (
                    <p className="faint" style={{ marginTop: 0 }}>
                      {t('semPastas')}
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
                    {t('salvarPastas')}
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="card">
          <header>
            <h2>{t('novoUsuario')}</h2>
          </header>
          <div className="body">
            <form action={criarUsuario}>
              <CampoCsrf token={csrf} />
              <div className="row">
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">{t('nome')}</span>
                  <input type="text" name="nome" required />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    {t('usuario')}
                    <Ajuda texto={t('usuarioHint')} rotulo={comum('ajudaSobre', { campo: t('usuario') })} />
                  </span>
                  <input
                    type="text"
                    name="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                  />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    {t('email')} <span className="faint">{t('opcional')}</span>
                  </span>
                  <input type="email" name="email" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    {t('telegram')} <span className="faint">{t('opcional')}</span>
                  </span>
                  <input type="text" name="telegramUsername" placeholder="@usuario" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">
                    {t('telefone')} <span className="faint">{t('opcional')}</span>
                  </span>
                  <input type="text" name="telefone" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">{t('perfil')}</span>
                  <select name="perfil" defaultValue="usuario">
                    {perfisDisponiveis.map((p) => (
                      <option key={p} value={p}>
                        {perfis(p)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="btn primary" type="submit" style={{ marginTop: 4 }}>
                {t('criarUsuario')}
              </button>
              <p className="faint" style={{ margin: '10px 0 0' }}>
                {t('senhaApareceUmaVez')}
              </p>
            </form>
          </div>
        </div>
      )}
    </Casca>
  );
}
