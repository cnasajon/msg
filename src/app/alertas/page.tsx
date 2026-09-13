import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { sessaoAtual } from '@/lib/sessao';
import { prisma } from '@/lib/db';
import { escopoDeAuditoria, escopoDePasta, escopoDePublicacao } from '@/lib/escopo';
import { destinoDosAlertas, TITULO_DO_ALERTA } from '@/lib/alertas';
import { formatarNoFuso, siglaDoFuso } from '@/lib/fuso';
import { podeFazer } from '@/lib/autorizacao';

export const dynamic = 'force-dynamic';

const CLASSE_DO_TIPO: Record<string, string> = {
  falha_publicacao: 'pill err',
  autenticacao_bot: 'pill err',
  slot_perdido: 'pill warn',
  fila_esgotada: 'pill warn',
  fila_curta: 'pill warn',
};

type DetalhesDoAlerta = { tipo?: string; titulo?: string; pasta?: string; mensagem?: string; destino?: string };

export default async function Alertas() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const t = await getTranslations('alertas');
  const tipos = await getTranslations('tiposDeAlerta');
  const textos = await getTranslations('textos');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');
  const idioma = await getLocale();

  const destino = await destinoDosAlertas(prisma);

  // O painel mostra duas coisas: o que já foi alertado (registro) e o que está
  // pendente agora (estado). O Telegram é o aviso imediato; isto é o registro
  // consultável, e continua existindo mesmo quando não há destino configurado.
  const [registros, comErro, perdidas, pastas] = await Promise.all([
    prisma.auditLog.findMany({
      where: { AND: [escopoDeAuditoria(sessao), { acao: 'alerta' }] },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    }),
    prisma.publication.findMany({
      where: { AND: [escopoDePublicacao(sessao), { status: 'erro' }] },
      orderBy: { dataPrevista: 'desc' },
      take: 20,
      include: { folder: { select: { id: true, nome: true, timezone: true } } },
    }),
    prisma.publication.count({ where: { AND: [escopoDePublicacao(sessao), { status: 'perdida' }] } }),
    prisma.folder.findMany({
      where: { AND: [escopoDePasta(sessao), { ativa: true }] },
      select: {
        id: true,
        nome: true,
        timezone: true,
        aoEsgotar: true,
        tipoDeLista: true,
        alertarAbaixoDe: true,
        textos: { where: { status: 'pendente' }, select: { id: true } },
        schedules: { where: { ativo: true }, select: { id: true } },
      },
    }),
  ]);

  // O limite é de cada pasta, e zero desliga o aviso. Lista por data não tem
  // fila que acabe, então também fica de fora.
  const filasCurtas = pastas.filter(
    (p) =>
      p.tipoDeLista === 'fila' &&
      p.alertarAbaixoDe > 0 &&
      p.schedules.length > 0 &&
      p.textos.length < p.alertarAbaixoDe,
  );

  return (
    <Casca
      sessao={sessao}
      titulo={t('titulo')}
      caminho={menu('painelDeControle')}
      atual="/alertas"
    >
      <div className={destino.chatId ? 'banner info' : 'banner warn'}>
        <div>
          <div className="ttl">{t('destinoAtual')}</div>
          {destino.chatId ? (
            <>
              {t('destinoConfigurado', {
                chatId: destino.chatId,
                origem:
                  destino.origemDoChat === 'settings' ? t('origemSettings') : t('origemAmbiente'),
              })}
              {destino.webhook ? ` ${t('googleChatTambem')}` : ''}
            </>
          ) : (
            t.rich('semDestino', { b: (partes) => <b>{partes}</b> })
          )}
          {podeFazer(sessao.perfil, 'alertas.configurarDestino') ? (
            <>
              {' '}
              <Link href="/configuracoes">{t('configurarDestino')}</Link>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid c3">
        <div className="card stat">
          <div className="k">{t('publicacoesComErro')}</div>
          <div className="v num">{comErro.length}</div>
          <div className="d">{t('aFilaNaoAvanca')}</div>
        </div>
        <div className="card stat">
          <div className="k">{t('slotsPerdidos')}</div>
          <div className="v num">{perdidas}</div>
          <div className="d">{t('vencidosAlemDaTolerancia')}</div>
        </div>
        <div className="card stat">
          <div className="k">{t('pastasComFilaCurta')}</div>
          <div className="v num">{filasCurtas.length}</div>
          <div className="d">{t('abaixoDoLimiteDaPasta')}</div>
        </div>
      </div>

      {comErro.length > 0 ? (
        <div className="card">
          <header>
            <h2>{t('publicacoesComErro')}</h2>
          </header>
          <table>
            <thead>
              <tr>
                <th style={{ width: 160 }}>{t('slot')}</th>
                <th style={{ width: 180 }}>{t('pasta')}</th>
                <th>{textos('erro')}</th>
                <th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {comErro.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.dataPrevista.toISOString().slice(0, 10).split('-').reverse().join('/')}{' '}
                    {p.horaPrevista ? p.horaPrevista.toISOString().slice(11, 16) : ''}{' '}
                    <span className="tz">{siglaDoFuso(p.folder.timezone)}</span>
                  </td>
                  <td>{p.folder.nome}</td>
                  <td style={{ color: 'var(--danger)' }}>{p.erroMensagem}</td>
                  <td>
                    <Link className="btn sm" href="/historico">
                      {menu('historico')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {filasCurtas.length > 0 ? (
        <div className="card">
          <header>
            <h2>{t('filasCurtas')}</h2>
          </header>
          <table>
            <thead>
              <tr>
                <th>{t('pasta')}</th>
                <th style={{ width: 130 }}>{t('pendentes')}</th>
                <th style={{ width: 200 }}>{t('aoEsgotar')}</th>
                <th style={{ width: 160 }} />
              </tr>
            </thead>
            <tbody>
              {filasCurtas.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>
                    <span className={p.textos.length === 0 ? 'pill err' : 'pill warn'}>{p.textos.length}</span>
                  </td>
                  <td>
                    {p.aoEsgotar === 'reiniciar'
                      ? comum('reiniciarFila')
                      : comum('pararNotificar')}
                  </td>
                  <td>
                    <Link className="btn sm" href={`/textos?pasta=${p.id}`}>
                      {t('abrirTextos')}
                    </Link>{' '}
                    <Link className="btn sm" href={`/importacao?pasta=${p.id}`}>
                      {t('importar')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="card">
        <header>
          <h2>{t('alertasEmitidos')}</h2>
          <span className="spacer" />
          <span className="sub">{t('ultimos100')}</span>
        </header>
        <table>
          <thead>
            <tr>
              <th style={{ width: 170 }}>{t('quando')}</th>
              <th style={{ width: 210 }}>{t('tipo')}</th>
              <th style={{ width: 170 }}>{t('pasta')}</th>
              <th>{t('detalhe')}</th>
              <th style={{ width: 120 }}>{t('envio')}</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={5} className="faint">
                  {t('nenhumAlerta')}
                </td>
              </tr>
            ) : (
              registros.map((registro) => {
                const detalhes = (registro.detalhes ?? {}) as DetalhesDoAlerta;
                const tipo = detalhes.tipo ?? registro.entidadeId ?? '';
                return (
                  <tr key={registro.id}>
                    <td>{formatarNoFuso(registro.criadoEm, 'America/Sao_Paulo', idioma)}</td>
                    <td>
                      <span className={CLASSE_DO_TIPO[tipo] ?? 'pill'}>
                        {tipo in TITULO_DO_ALERTA ? tipos(tipo) : (detalhes.titulo ?? tipo)}
                      </span>
                    </td>
                    <td>{detalhes.pasta ?? <span className="faint">{comum('nenhum')}</span>}</td>
                    <td>{detalhes.mensagem}</td>
                    <td>
                      <span className="pill">
                        {detalhes.destino === 'nenhum'
                          ? t('soLog')
                          : `Telegram (${detalhes.destino})`}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="faint">{t('falhaDeCanal')}</p>
    </Casca>
  );
}
