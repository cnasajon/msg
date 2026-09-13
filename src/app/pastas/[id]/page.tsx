import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { comEscopo } from '@/lib/escopo';
import { prisma } from '@/lib/db';
import { siglaDoFuso } from '@/lib/fuso';
import { editarPasta, excluirPasta, salvarTokenDeSobreposicao, testarConexao } from '../acoes';
import {
  alternarAgendamento,
  criarAgendamento,
  editarAgendamento,
  excluirAgendamento,
} from '../acoes-agenda';
import { TabelaDeAgendamentos } from '@/components/tabela-agendamentos';
import { proximoSlot, resumirDias } from '@/lib/agenda';

export const dynamic = 'force-dynamic';

export default async function ConfigurarPasta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'pastas.gerenciar')) redirect('/inicio');

  const { id } = await params;
  const { erro, ok } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  // resolve pelo escopo: id de outra organização não chega aqui
  const pasta = await comEscopo(sessao).pasta(id);
  const agendamentos = await prisma.schedule.findMany({
    where: { folderId: pasta.id },
    orderBy: { horaLocal: 'asc' },
  });
  const proximo = proximoSlot(
    agendamentos.map((a) => ({ horaLocal: a.horaLocal, diasSemana: a.diasSemana, ativo: a.ativo })),
    pasta.timezone,
    new Date(),
  );
  const [pendentes, publicados, usuarios] = await Promise.all([
    prisma.text.count({ where: { folderId: pasta.id, status: 'pendente' } }),
    prisma.text.count({ where: { folderId: pasta.id, status: 'publicado' } }),
    prisma.user.findMany({
      where: { organizationId: pasta.organizationId, perfil: 'usuario' },
      orderBy: { nome: 'asc' },
      include: { folders: { where: { folderId: pasta.id }, select: { folderId: true } } },
    }),
  ]);

  return (
    <Casca sessao={sessao} titulo={pasta.nome} caminho="Configuração · Pastas" atual="/pastas">
      <Avisos erro={erro} ok={ok} />

      <div className="grid c2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <header>
              <h2>Identificação e destino</h2>
              <span className="spacer" />
              <Link className="btn sm" href={`/textos?pasta=${pasta.id}`}>
                Ver textos
              </Link>
            </header>
            <div className="body">
              <form action={editarPasta}>
                <CampoCsrf token={csrf} />
                <input type="hidden" name="id" value={pasta.id} />

                <label className="field">
                  <span className="lbl">Nome</span>
                  <input type="text" name="nome" defaultValue={pasta.nome} required />
                </label>
                <label className="field">
                  <span className="lbl">Descrição</span>
                  <input type="text" name="descricao" defaultValue={pasta.descricao ?? ''} />
                </label>

                <div className="row">
                  <label className="field" style={{ margin: 0 }}>
                    <span className="lbl">Fuso horário da pasta</span>
                    <input type="text" name="timezone" defaultValue={pasta.timezone} required />
                    <span className="hint">
                      Agora são {new Date().toLocaleTimeString('pt-BR', { timeZone: pasta.timezone, hour: '2-digit', minute: '2-digit' })}{' '}
                      <span className="tz">{siglaDoFuso(pasta.timezone)}</span> nesta pasta. Os serviços
                      rodam em <code>TZ=UTC</code>.
                    </span>
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="lbl">Situação</span>
                    <select name="ativaSelect" defaultValue={pasta.ativa ? 'sim' : 'nao'} disabled>
                      <option value="sim">Ativa</option>
                      <option value="nao">Inativa</option>
                    </select>
                    <span className="hint">Use a caixa abaixo para mudar.</span>
                  </label>
                </div>

                <label className="field">
                  <span className="lbl">chat_id do grupo no Telegram</span>
                  <input
                    type="text"
                    name="telegramChatId"
                    defaultValue={pasta.telegramChatId ?? ''}
                    placeholder="-100…"
                  />
                  <span className="hint">
                    Sempre o número, nunca o link ou o @nome — o nome pode ser trocado por um
                    administrador do grupo. Promova o grupo a supergroup <b>antes</b> de anotar o
                    número: ele muda na promoção, e a publicação passa a falhar com{' '}
                    <code>chat not found</code>.
                  </span>
                </label>

                <h3 style={{ fontSize: 13, margin: '18px 0 8px' }}>Ao esgotar a fila</h3>
                <div className="check">
                  <input
                    type="radio"
                    id="esgotar-parar"
                    name="aoEsgotar"
                    value="parar_notificar"
                    defaultChecked={pasta.aoEsgotar === 'parar_notificar'}
                  />
                  <label htmlFor="esgotar-parar">
                    <b>Parar e notificar</b> — registra a publicação sem texto, alerta os
                    administradores e não publica nada.
                  </label>
                </div>
                <div className="check">
                  <input
                    type="radio"
                    id="esgotar-reiniciar"
                    name="aoEsgotar"
                    value="reiniciar"
                    defaultChecked={pasta.aoEsgotar === 'reiniciar'}
                  />
                  <label htmlFor="esgotar-reiniciar">
                    <b>Reiniciar a fila</b> — devolve todos os textos a pendente, preservando a
                    ordem, e publica o primeiro. O evento fica na auditoria.
                  </label>
                </div>

                <div className="check" style={{ marginTop: 12 }}>
                  <input type="checkbox" id="ativa" name="ativa" defaultChecked={pasta.ativa} />
                  <label htmlFor="ativa">
                    Pasta ativa <span className="faint">— inativa não publica nada</span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="btn primary" type="submit">
                    Salvar pasta
                  </button>
                  <Link className="btn" href="/pastas">
                    Voltar
                  </Link>
                </div>
              </form>

              <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <form action={testarConexao}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={pasta.id} />
                  <button className="btn" type="submit" disabled={!pasta.telegramChatId}>
                    Testar conexão
                  </button>
                </form>
                <span className="faint">
                  Envia uma mensagem de teste ao grupo e mostra o erro exato devolvido pela API.
                </span>
              </div>
            </div>
          </div>

          {podeFazer(sessao.perfil, 'pastas.configurarTokenSobreposicao') ? (
            <div className="card">
              <header>
                <h2>Token de sobreposição</h2>
                <span className="spacer" />
                <span className="pill accent">só superadmin</span>
              </header>
              <div className="body">
                <div className="banner info" style={{ marginBottom: 14 }}>
                  <div>
                    Vazio por padrão. Todas as organizações usam o bot único <b>@OAmsg_bot</b>, com o
                    token na variável compartilhada <code>TELEGRAM_BOT_TOKEN</code>. Preencha apenas
                    para isolar uma organização em outro bot.
                  </div>
                </div>
                <form action={salvarTokenDeSobreposicao}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={pasta.id} />
                  <label className="field">
                    <span className="lbl">Token do bot desta pasta</span>
                    <input
                      type="text"
                      name="token"
                      placeholder={
                        pasta.telegramBotTokenCifrado
                          ? 'sobreposição ativa — cole outro token para trocar, ou salve vazio para remover'
                          : '(vazio — usando o bot global)'
                      }
                      autoComplete="off"
                    />
                    <span className="hint">
                      Cifrado com AES-256-GCM e nunca reexibido. O token é conferido no Telegram
                      antes de ser gravado. Trocar a <code>ENCRYPTION_KEY</code> invalida o que já
                      está cifrado.
                    </span>
                  </label>
                  <button className="btn" type="submit">
                    {pasta.telegramBotTokenCifrado ? 'Atualizar ou remover' : 'Salvar sobreposição'}
                  </button>
                  {pasta.telegramBotTokenCifrado ? (
                    <span className="pill accent" style={{ marginLeft: 10 }}>
                      sobreposição ativa
                    </span>
                  ) : null}
                </form>
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <header>
              <h2>Situação da fila</h2>
            </header>
            <div className="body">
              <dl className="kv">
                <dt>Textos pendentes</dt>
                <dd>
                  <span className={pendentes === 0 ? 'pill err' : pendentes < 5 ? 'pill warn' : 'pill ok'}>
                    {pendentes}
                  </span>{' '}
                  {pendentes < 5 ? (
                    <span className="faint">o painel avisa abaixo de cinco</span>
                  ) : null}
                </dd>
                <dt>Já publicados</dt>
                <dd>{publicados}</dd>
                <dt>Agendamentos ativos</dt>
                <dd>{agendamentos.filter((a) => a.ativo).length}</dd>
                <dt>Próxima publicação</dt>
                <dd>
                  {proximo ? (
                    <>
                      {proximo.data.split('-').reverse().join('/')} às {proximo.hora}{' '}
                      <span className="tz">{siglaDoFuso(pasta.timezone)}</span>
                    </>
                  ) : (
                    <span className="faint">nenhum agendamento ativo</span>
                  )}
                </dd>
              </dl>
            </div>
          </div>

          <div className="card">
            <header>
              <h2>Quem tem acesso</h2>
            </header>
            <div className="body">
              <p className="faint" style={{ marginTop: 0 }}>
                Admins enxergam todas as pastas da organização. O perfil <b>usuário</b> só enxerga as
                pastas atribuídas a ele, o que é feito na tela de usuários.
              </p>
              {usuarios.length === 0 ? (
                <p className="faint">Nenhum usuário com perfil “usuário” nesta organização.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {usuarios.map((u) => (
                    <li key={u.id} style={{ marginBottom: 4 }}>
                      {u.nome}{' '}
                      {u.folders.length ? (
                        <span className="pill ok">com acesso</span>
                      ) : (
                        <span className="pill">sem acesso</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Link className="btn sm" href="/usuarios" style={{ marginTop: 12 }}>
                Gerenciar usuários
              </Link>
            </div>
          </div>

          <div className="card">
            <header>
              <h2>Excluir pasta</h2>
            </header>
            <div className="body">
              <p className="faint" style={{ marginTop: 0 }}>
                Excluir apaga a pasta e os textos dela. Pastas com textos já publicados não podem ser
                excluídas — desative-as, para preservar o histórico.
              </p>
              <form action={excluirPasta}>
                <CampoCsrf token={csrf} />
                <input type="hidden" name="id" value={pasta.id} />
                <button className="btn danger" type="submit">
                  Excluir pasta
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

          <div className="card">
        <header>
          <h2>Agendamentos</h2>
          <span className="spacer" />
          <span className="sub">horários no fuso da pasta</span>
        </header>
        <TabelaDeAgendamentos
          folderId={pasta.id}
          csrf={<CampoCsrf token={csrf} />}
          agendamentos={agendamentos.map((a) => ({
            id: a.id,
            horaLocal: a.horaLocal,
            diasSemana: a.diasSemana,
            ativo: a.ativo,
          }))}
          acoes={{
            criar: criarAgendamento,
            editar: editarAgendamento,
            alternar: alternarAgendamento,
            excluir: excluirAgendamento,
          }}
        />
      </div>

    </Casca>
  );
}
