import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { destinoDosAlertas } from '@/lib/alertas';
import { conferirBot } from '@/lib/telegram';
import { env } from '@/lib/env';
import { formatarNoFuso } from '@/lib/fuso';
import { tradutorDeAvisos } from '@/lib/avisos-servidor';
import { salvarDestinoDosAlertas, testarCanalDeAlerta } from './acoes';

export const dynamic = 'force-dynamic';

const CHAVE_DA_ORIGEM = {
  settings: 'origemSettings',
  ambiente: 'origemAmbiente',
  nenhum: 'origemNenhum',
} as const;

export default async function Configuracoes({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'alertas.configurarDestino')) redirect('/inicio');

  const t = await getTranslations('configuracoes');
  const menu = await getTranslations('menu');
  const { frase } = await tradutorDeAvisos();

  const { erro, ok } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  const configuracao = await prisma.settings.findUnique({
    where: { id: 'singleton' },
    include: { autor: { select: { nome: true } } },
  });
  const destino = await destinoDosAlertas(prisma);
  const bot = await conferirBot(env.telegramBotToken);
  const sobreposicoes = await prisma.folder.count({ where: { telegramBotTokenCifrado: { not: null } } });

  return (
    <Casca
      sessao={sessao}
      titulo={t('titulo')}
      caminho={`${menu('sistema')} · ${t('soSuperadmin')}`}
      atual="/configuracoes"
    >
      <Avisos erro={erro} ok={ok} />

      <div className="banner info">
        <div>
          <div className="ttl">{t('precedenciaTitulo')}</div>
          {t('precedenciaLinha')}
          <br />
          {t.rich('precedenciaExplicacao', { b: (partes) => <b>{partes}</b> })}
        </div>
      </div>

      <form action={salvarDestinoDosAlertas}>
        <CampoCsrf token={csrf} />
        <div className="grid c2">
          <div className="card">
            <header>
              <h2>{t('telegramTitulo')}</h2>
            </header>
            <div className="body">
              <label className="field">
                <span className="lbl">{t('chatIdAlertas')}</span>
                <input
                  type="text"
                  name="alertsChatId"
                  defaultValue={configuracao?.alertsChatId ?? ''}
                  placeholder={t('chatIdPlaceholder')}
                />
                <span className="hint">{t('chatIdHint')}</span>
              </label>
              <dl className="kv" style={{ gridTemplateColumns: '230px 1fr' }}>
                <dt>{t('valorNestaTela')}</dt>
                <dd>
                  {configuracao?.alertsChatId ? (
                    <code>{configuracao.alertsChatId}</code>
                  ) : (
                    <span className="faint">{t('vazio')}</span>
                  )}
                </dd>
                <dt>
                  {t('variavel')} <code>ALERTS_CHAT_ID</code>
                </dt>
                <dd>
                  {env.alertsChatId ? (
                    <code>{env.alertsChatId}</code>
                  ) : (
                    <span className="faint">{t('vazia')}</span>
                  )}
                </dd>
                <dt>
                  <b>{t('destinoEmVigor')}</b>
                </dt>
                <dd>
                  <span className={destino.chatId ? 'pill ok' : 'pill warn'}>
                    {destino.chatId
                      ? t('vindoDe', {
                          chatId: destino.chatId,
                          origem: t(CHAVE_DA_ORIGEM[destino.origemDoChat]),
                        })
                      : t('somenteLogEPainel')}
                  </span>
                </dd>
              </dl>
            </div>
          </div>

          <div className="card">
            <header>
              <h2>{t('googleChatTitulo')}</h2>
            </header>
            <div className="body">
              <label className="field">
                <span className="lbl">{t('urlWebhook')}</span>
                <input
                  type="text"
                  name="googleChatWebhook"
                  defaultValue={configuracao?.googleChatWebhook ?? ''}
                  placeholder={t('webhookPlaceholder')}
                />
                <span className="hint">{t('webhookHint')}</span>
              </label>
              <dl className="kv" style={{ gridTemplateColumns: '230px 1fr' }}>
                <dt>{t('valorNestaTela')}</dt>
                <dd>
                  {configuracao?.googleChatWebhook ? (
                    t('definido')
                  ) : (
                    <span className="faint">{t('vazio')}</span>
                  )}
                </dd>
                <dt>
                  {t('variavel')} <code>GOOGLE_CHAT_WEBHOOK</code>
                </dt>
                <dd>
                  {env.googleChatWebhook ? (
                    t('definida')
                  ) : (
                    <span className="faint">{t('vazia')}</span>
                  )}
                </dd>
                <dt>
                  <b>{t('destinoEmVigor')}</b>
                </dt>
                <dd>
                  <span className={destino.webhook ? 'pill ok' : 'pill'}>
                    {destino.webhook
                      ? t('webhookDe', { origem: t(CHAVE_DA_ORIGEM[destino.origemDoWebhook]) })
                      : t('desativado')}
                  </span>
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn primary" type="submit">
            {t('salvarDestino')}
          </button>
          {configuracao?.atualizadoEm ? (
            <span className="faint">
              {t('ultimaAlteracao', {
                quando: formatarNoFuso(configuracao.atualizadoEm, 'America/Sao_Paulo'),
              })}
              {configuracao.autor ? ` ${t('porAutor', { nome: configuracao.autor.nome })}` : ''}
            </span>
          ) : null}
        </div>
      </form>

      <div className="card">
        <header>
          <h2>{t('testarCanais')}</h2>
        </header>
        <div className="body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <form action={testarCanalDeAlerta}>
            <CampoCsrf token={csrf} />
            <input type="hidden" name="canal" value="telegram" />
            <button className="btn" type="submit">
              {t('testarTelegram')}
            </button>
          </form>
          <form action={testarCanalDeAlerta}>
            <CampoCsrf token={csrf} />
            <input type="hidden" name="canal" value="google_chat" />
            <button className="btn" type="submit">
              {t('testarGoogleChat')}
            </button>
          </form>
          <span className="faint" style={{ flexBasis: '100%' }}>
            {t('testeExplicacao')}
          </span>
        </div>
      </div>

      <div className="grid c2">
        <div className="card">
          <header>
            <h2>{t('botTitulo')}</h2>
            <span className="spacer" />
            <span className="sub">{t('somenteLeitura')}</span>
          </header>
          <div className="body">
            <dl className="kv">
              <dt>{t('botEmUso')}</dt>
              <dd>
                {bot.ok ? (
                  <>
                    <b>@{bot.username}</b> <span className="pill ok">{t('autenticando')}</span>
                  </>
                ) : (
                  <>
                    <span className="pill err">{t('falhaDeAutenticacao')}</span>
                    <div className="faint">{bot.problema ? frase(bot.problema) : null}</div>
                  </>
                )}
              </dd>
              <dt>{t('token')}</dt>
              <dd>
                {t('variavelCompartilhada')} <code>TELEGRAM_BOT_TOKEN</code>
                <div className="faint">{t('tokenExplicacao')}</div>
              </dd>
              <dt>{t('sobreposicoes')}</dt>
              <dd>
                {sobreposicoes === 0 ? (
                  <span className="faint">{t('nenhumaSobreposicao')}</span>
                ) : (
                  t('comTokenProprio', { quantidade: sobreposicoes })
                )}
              </dd>
            </dl>
          </div>
        </div>

        <div className="card">
          <header>
            <h2>{t('dispatcherTitulo')}</h2>
            <span className="spacer" />
            <span className="sub">{t('servicoWorker')}</span>
          </header>
          <div className="body">
            <dl className="kv">
              <dt>{t('intervalo')}</dt>
              <dd>
                {t('minutos', { quantidade: env.dispatchIntervalMinutes })}{' '}
                <span className="faint">
                  (<code>DISPATCH_INTERVAL_MINUTES</code>)
                </span>
              </dd>
              <dt>{t('tolerancia')}</dt>
              <dd>
                {t('minutos', { quantidade: env.dispatchGraceMinutes })}{' '}
                <span className="faint">{t('toleranciaExplicacao')}</span>
              </dd>
              <dt>{t('fusoDosServicos')}</dt>
              <dd>
                <code>TZ={process.env.TZ ?? t('naoDefinido')}</code> {t('conversaoNaAplicacao')}
              </dd>
              <dt>{t('replicas')}</dt>
              <dd>
                1 <span className="faint">{t('replicaFixa')}</span>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </Casca>
  );
}
