import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
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
import { proximoSlot } from '@/lib/agenda';

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

  const t = await getTranslations('pastas');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');
  const idioma = await getLocale();

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
    <Casca
      sessao={sessao}
      titulo={pasta.nome}
      caminho={`${menu('configuracao')} · ${menu('pastas')}`}
      atual="/pastas"
    >
      <Avisos erro={erro} ok={ok} />

      <div className="grid c2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <header>
              <h2>{t('identificacao')}</h2>
              <span className="spacer" />
              <Link className="btn sm" href={`/textos?pasta=${pasta.id}`}>
                {t('verTextos')}
              </Link>
            </header>
            <div className="body">
              <form action={editarPasta}>
                <CampoCsrf token={csrf} />
                <input type="hidden" name="id" value={pasta.id} />

                <label className="field">
                  <span className="lbl">{t('nome')}</span>
                  <input type="text" name="nome" defaultValue={pasta.nome} required />
                </label>
                <label className="field">
                  <span className="lbl">{t('descricao')}</span>
                  <input type="text" name="descricao" defaultValue={pasta.descricao ?? ''} />
                </label>

                <div className="row">
                  <label className="field" style={{ margin: 0 }}>
                    <span className="lbl">{t('fusoDaPasta')}</span>
                    <input type="text" name="timezone" defaultValue={pasta.timezone} required />
                    <span className="hint">
                      {t('agoraSao', {
                        hora: new Date().toLocaleTimeString(idioma, {
                          timeZone: pasta.timezone,
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      })}{' '}
                      <span className="tz">{siglaDoFuso(pasta.timezone)}</span> {t('nestaPasta')}
                    </span>
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="lbl">{t('situacao')}</span>
                    <select name="ativaSelect" defaultValue={pasta.ativa ? 'sim' : 'nao'} disabled>
                      <option value="sim">{t('ativaOpcao')}</option>
                      <option value="nao">{t('inativa')}</option>
                    </select>
                    <span className="hint">{t('useACaixa')}</span>
                  </label>
                </div>

                <label className="field">
                  <span className="lbl">{t('chatIdDoGrupo')}</span>
                  <input
                    type="text"
                    name="telegramChatId"
                    defaultValue={pasta.telegramChatId ?? ''}
                    placeholder="-100…"
                  />
                  <span className="hint">
                    {t.rich('chatIdExplicacao', { b: (partes) => <b>{partes}</b> })}
                  </span>
                </label>

                <h3 style={{ fontSize: 13, margin: '18px 0 8px' }}>{t('aoEsgotarFila')}</h3>
                <div className="check">
                  <input
                    type="radio"
                    id="esgotar-parar"
                    name="aoEsgotar"
                    value="parar_notificar"
                    defaultChecked={pasta.aoEsgotar === 'parar_notificar'}
                  />
                  <label htmlFor="esgotar-parar">
                    {t.rich('pararNotificarExplicacao', { b: (partes) => <b>{partes}</b> })}
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
                    {t.rich('reiniciarExplicacao', { b: (partes) => <b>{partes}</b> })}
                  </label>
                </div>

                <div className="check" style={{ marginTop: 12 }}>
                  <input type="checkbox" id="ativa" name="ativa" defaultChecked={pasta.ativa} />
                  <label htmlFor="ativa">
                    {t('pastaAtiva')} <span className="faint">{t('inativaNaoPublica')}</span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="btn primary" type="submit">
                    {t('salvarPasta')}
                  </button>
                  <Link className="btn" href="/pastas">
                    {comum('voltar')}
                  </Link>
                </div>
              </form>

              <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <form action={testarConexao}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={pasta.id} />
                  <button className="btn" type="submit" disabled={!pasta.telegramChatId}>
                    {t('testarConexao')}
                  </button>
                </form>
                <span className="faint">{t('testarExplicacao')}</span>
              </div>
            </div>
          </div>

          {podeFazer(sessao.perfil, 'pastas.configurarTokenSobreposicao') ? (
            <div className="card">
              <header>
                <h2>{t('tokenSobreposicao')}</h2>
                <span className="spacer" />
                <span className="pill accent">{t('soSuperadmin')}</span>
              </header>
              <div className="body">
                <div className="banner info" style={{ marginBottom: 14 }}>
                  <div>{t.rich('tokenExplicacao', { b: (partes) => <b>{partes}</b> })}</div>
                </div>
                <form action={salvarTokenDeSobreposicao}>
                  <CampoCsrf token={csrf} />
                  <input type="hidden" name="id" value={pasta.id} />
                  <label className="field">
                    <span className="lbl">{t('tokenDaPasta')}</span>
                    <input
                      type="text"
                      name="token"
                      placeholder={
                        pasta.telegramBotTokenCifrado
                          ? t('tokenAtivoPlaceholder')
                          : t('tokenVazioPlaceholder')
                      }
                      autoComplete="off"
                    />
                    <span className="hint">{t('tokenHint')}</span>
                  </label>
                  <button className="btn" type="submit">
                    {pasta.telegramBotTokenCifrado
                      ? t('atualizarOuRemover')
                      : t('salvarSobreposicao')}
                  </button>
                  {pasta.telegramBotTokenCifrado ? (
                    <span className="pill accent" style={{ marginLeft: 10 }}>
                      {t('sobreposicaoAtiva')}
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
              <h2>{t('situacaoDaFila')}</h2>
            </header>
            <div className="body">
              <dl className="kv">
                <dt>{t('textosPendentes')}</dt>
                <dd>
                  <span className={pendentes === 0 ? 'pill err' : pendentes < 5 ? 'pill warn' : 'pill ok'}>
                    {pendentes}
                  </span>{' '}
                  {pendentes < 5 ? (
                    <span className="faint">{t('avisaAbaixoDeCinco')}</span>
                  ) : null}
                </dd>
                <dt>{t('jaPublicados')}</dt>
                <dd>{publicados}</dd>
                <dt>{t('agendamentosAtivos')}</dt>
                <dd>{agendamentos.filter((a) => a.ativo).length}</dd>
                <dt>{t('proximaPublicacao')}</dt>
                <dd>
                  {proximo ? (
                    <>
                      {proximo.data.split('-').reverse().join('/')} {t('as')} {proximo.hora}{' '}
                      <span className="tz">{siglaDoFuso(pasta.timezone)}</span>
                    </>
                  ) : (
                    <span className="faint">{t('nenhumAgendamentoAtivo')}</span>
                  )}
                </dd>
              </dl>
            </div>
          </div>

          <div className="card">
            <header>
              <h2>{t('quemTemAcesso')}</h2>
            </header>
            <div className="body">
              <p className="faint" style={{ marginTop: 0 }}>
                {t.rich('acessoExplicacao', { b: (partes) => <b>{partes}</b> })}
              </p>
              {usuarios.length === 0 ? (
                <p className="faint">{t('semUsuarios')}</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {usuarios.map((u) => (
                    <li key={u.id} style={{ marginBottom: 4 }}>
                      {u.nome}{' '}
                      {u.folders.length ? (
                        <span className="pill ok">{t('comAcesso')}</span>
                      ) : (
                        <span className="pill">{t('semAcesso')}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Link className="btn sm" href="/usuarios" style={{ marginTop: 12 }}>
                {t('gerenciarUsuarios')}
              </Link>
            </div>
          </div>

          <div className="card">
            <header>
              <h2>{t('excluirPasta')}</h2>
            </header>
            <div className="body">
              <p className="faint" style={{ marginTop: 0 }}>
                {t('excluirExplicacao')}
              </p>
              <form action={excluirPasta}>
                <CampoCsrf token={csrf} />
                <input type="hidden" name="id" value={pasta.id} />
                <button className="btn danger" type="submit">
                  {t('excluirPasta')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

          <div className="card">
        <header>
          <h2>{t('agendamentos')}</h2>
          <span className="spacer" />
          <span className="sub">{t('horariosNoFuso')}</span>
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
