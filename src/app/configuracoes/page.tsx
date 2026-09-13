import { redirect } from 'next/navigation';
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
import { salvarDestinoDosAlertas, testarCanalDeAlerta } from './acoes';

export const dynamic = 'force-dynamic';

const EXPLICACAO_DA_ORIGEM = {
  settings: 'o campo desta tela',
  ambiente: 'a variável de ambiente',
  nenhum: 'nenhum — só log e painel',
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
    <Casca sessao={sessao} titulo="Configurações globais" caminho="Sistema · só superadmin" atual="/configuracoes">
      <Avisos erro={erro} ok={ok} />

      <div className="banner info">
        <div>
          <div className="ttl">Precedência do destino dos alertas</div>
          1. o campo desta tela · 2. senão a variável de ambiente · 3. senão apenas o log da aplicação
          e o painel de alertas.
          <br />
          A variável de ambiente é o destino garantido: continua funcionando quando o próprio banco
          está inacessível — justamente quando o alerta é mais necessário. O campo daqui existe para
          trocar o grupo sem redeploy. <b>Os dois podem ficar vazios</b> sem quebrar nada.
        </div>
      </div>

      <form action={salvarDestinoDosAlertas}>
        <CampoCsrf token={csrf} />
        <div className="grid c2">
          <div className="card">
            <header>
              <h2>Telegram — grupo de alertas</h2>
            </header>
            <div className="body">
              <label className="field">
                <span className="lbl">chat_id do grupo de alertas</span>
                <input
                  type="text"
                  name="alertsChatId"
                  defaultValue={configuracao?.alertsChatId ?? ''}
                  placeholder="(vazio — usando ALERTS_CHAT_ID, se houver)"
                />
                <span className="hint">
                  Grupo só com os superadmins. O bot precisa ser membro. Promova a supergroup antes
                  de anotar o número.
                </span>
              </label>
              <dl className="kv" style={{ gridTemplateColumns: '230px 1fr' }}>
                <dt>Valor nesta tela</dt>
                <dd>{configuracao?.alertsChatId ? <code>{configuracao.alertsChatId}</code> : <span className="faint">vazio</span>}</dd>
                <dt>
                  Variável <code>ALERTS_CHAT_ID</code>
                </dt>
                <dd>{env.alertsChatId ? <code>{env.alertsChatId}</code> : <span className="faint">vazia</span>}</dd>
                <dt>
                  <b>Destino em vigor</b>
                </dt>
                <dd>
                  <span className={destino.chatId ? 'pill ok' : 'pill warn'}>
                    {destino.chatId ? `${destino.chatId} — de ${EXPLICACAO_DA_ORIGEM[destino.origemDoChat]}` : 'somente log e painel'}
                  </span>
                </dd>
              </dl>
            </div>
          </div>

          <div className="card">
            <header>
              <h2>Google Chat — webhook (opcional)</h2>
            </header>
            <div className="body">
              <label className="field">
                <span className="lbl">URL do webhook</span>
                <input
                  type="text"
                  name="googleChatWebhook"
                  defaultValue={configuracao?.googleChatWebhook ?? ''}
                  placeholder="(vazio — usando GOOGLE_CHAT_WEBHOOK, se houver)"
                />
                <span className="hint">Canal adicional, nunca substituto do Telegram.</span>
              </label>
              <dl className="kv" style={{ gridTemplateColumns: '230px 1fr' }}>
                <dt>Valor nesta tela</dt>
                <dd>{configuracao?.googleChatWebhook ? 'definido' : <span className="faint">vazio</span>}</dd>
                <dt>
                  Variável <code>GOOGLE_CHAT_WEBHOOK</code>
                </dt>
                <dd>{env.googleChatWebhook ? 'definida' : <span className="faint">vazia</span>}</dd>
                <dt>
                  <b>Destino em vigor</b>
                </dt>
                <dd>
                  <span className={destino.webhook ? 'pill ok' : 'pill'}>
                    {destino.webhook ? `de ${EXPLICACAO_DA_ORIGEM[destino.origemDoWebhook]}` : 'desativado'}
                  </span>
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn primary" type="submit">
            Salvar destino dos alertas
          </button>
          {configuracao?.atualizadoEm ? (
            <span className="faint">
              Última alteração em {formatarNoFuso(configuracao.atualizadoEm, 'America/Sao_Paulo')}
              {configuracao.autor ? ` por ${configuracao.autor.nome}` : ''}
            </span>
          ) : null}
        </div>
      </form>

      <div className="card">
        <header>
          <h2>Testar os canais</h2>
        </header>
        <div className="body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <form action={testarCanalDeAlerta}>
            <CampoCsrf token={csrf} />
            <input type="hidden" name="canal" value="telegram" />
            <button className="btn" type="submit">
              Enviar alerta de teste no Telegram
            </button>
          </form>
          <form action={testarCanalDeAlerta}>
            <CampoCsrf token={csrf} />
            <input type="hidden" name="canal" value="google_chat" />
            <button className="btn" type="submit">
              Enviar alerta de teste no Google Chat
            </button>
          </form>
          <span className="faint" style={{ flexBasis: '100%' }}>
            O teste usa o destino em vigor, com a precedência acima. Salve antes de testar, se acabou
            de mudar o campo.
          </span>
        </div>
      </div>

      <div className="grid c2">
        <div className="card">
          <header>
            <h2>Bot do Telegram</h2>
            <span className="spacer" />
            <span className="sub">somente leitura</span>
          </header>
          <div className="body">
            <dl className="kv">
              <dt>Bot em uso</dt>
              <dd>
                {bot.ok ? (
                  <>
                    <b>@{bot.username}</b> <span className="pill ok">autenticando</span>
                  </>
                ) : (
                  <>
                    <span className="pill err">falha de autenticação</span>
                    <div className="faint">{bot.erro}</div>
                  </>
                )}
              </dd>
              <dt>Token</dt>
              <dd>
                variável compartilhada <code>TELEGRAM_BOT_TOKEN</code>
                <div className="faint">
                  O valor nunca é exibido, nem aqui nem em log ou mensagem de erro. Em caso de
                  suspeita de vazamento, <code>/revoke</code> no @BotFather e atualização da variável.
                </div>
              </dd>
              <dt>Sobreposições por pasta</dt>
              <dd>
                {sobreposicoes === 0 ? (
                  <span className="faint">nenhuma pasta com token próprio</span>
                ) : (
                  `${sobreposicoes} pasta(s) com token próprio`
                )}
              </dd>
            </dl>
          </div>
        </div>

        <div className="card">
          <header>
            <h2>Dispatcher</h2>
            <span className="spacer" />
            <span className="sub">
              somente leitura · serviço <code>worker</code>
            </span>
          </header>
          <div className="body">
            <dl className="kv">
              <dt>Intervalo do ciclo</dt>
              <dd>
                {env.dispatchIntervalMinutes} minutos{' '}
                <span className="faint">
                  (<code>DISPATCH_INTERVAL_MINUTES</code>)
                </span>
              </dd>
              <dt>Tolerância</dt>
              <dd>
                {env.dispatchGraceMinutes} minutos{' '}
                <span className="faint">
                  (<code>DISPATCH_GRACE_MINUTES</code>) — passado isso o slot vira “perdido”, e nunca
                  é publicado com atraso
                </span>
              </dd>
              <dt>Fuso dos serviços</dt>
              <dd>
                <code>TZ={process.env.TZ ?? 'não definido'}</code> — a conversão para o fuso da pasta
                acontece na aplicação
              </dd>
              <dt>Réplicas</dt>
              <dd>
                1 <span className="faint">— fixa, configurada no painel do Railway</span>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </Casca>
  );
}
