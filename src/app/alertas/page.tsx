import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Casca } from '@/components/casca';
import { sessaoAtual } from '@/lib/sessao';
import { prisma } from '@/lib/db';
import { escopoDeAuditoria, escopoDePasta, escopoDePublicacao } from '@/lib/escopo';
import { destinoDosAlertas, TITULO_DO_ALERTA, type TipoDeAlerta } from '@/lib/alertas';
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
        textos: { where: { status: 'pendente' }, select: { id: true } },
        schedules: { where: { ativo: true }, select: { id: true } },
      },
    }),
  ]);

  const filasCurtas = pastas.filter((p) => p.schedules.length > 0 && p.textos.length < 5);

  return (
    <Casca sessao={sessao} titulo="Painel de alertas" caminho="Painel de controle" atual="/alertas">
      <div className={destino.chatId ? 'banner info' : 'banner warn'}>
        <div>
          <div className="ttl">Destino atual dos alertas</div>
          {destino.chatId ? (
            <>
              Telegram <code>{destino.chatId}</code>, vindo{' '}
              {destino.origemDoChat === 'settings' ? 'das configurações globais' : 'da variável de ambiente'}.
              {destino.webhook ? ' Google Chat também configurado.' : ''}
            </>
          ) : (
            <>
              Nenhum destino configurado: os alertas ficam <b>no log e neste painel</b>, que é o
              terceiro nível da precedência da seção 7.4 — e é um estado válido, não uma falha.
            </>
          )}
          {podeFazer(sessao.perfil, 'alertas.configurarDestino') ? (
            <>
              {' '}
              <Link href="/configuracoes">Configurar destino</Link>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid c3">
        <div className="card stat">
          <div className="k">Publicações com erro</div>
          <div className="v num">{comErro.length}</div>
          <div className="d">a fila não avança enquanto não resolver</div>
        </div>
        <div className="card stat">
          <div className="k">Slots perdidos</div>
          <div className="v num">{perdidas}</div>
          <div className="d">vencidos além da tolerância</div>
        </div>
        <div className="card stat">
          <div className="k">Pastas com fila curta</div>
          <div className="v num">{filasCurtas.length}</div>
          <div className="d">menos de cinco textos pendentes</div>
        </div>
      </div>

      {comErro.length > 0 ? (
        <div className="card">
          <header>
            <h2>Publicações com erro</h2>
          </header>
          <table>
            <thead>
              <tr>
                <th style={{ width: 160 }}>Slot</th>
                <th style={{ width: 180 }}>Pasta</th>
                <th>Erro</th>
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
                      Histórico
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
            <h2>Filas curtas</h2>
          </header>
          <table>
            <thead>
              <tr>
                <th>Pasta</th>
                <th style={{ width: 130 }}>Pendentes</th>
                <th style={{ width: 200 }}>Ao esgotar</th>
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
                  <td>{p.aoEsgotar === 'reiniciar' ? 'reiniciar a fila' : 'parar e notificar'}</td>
                  <td>
                    <Link className="btn sm" href={`/textos?pasta=${p.id}`}>
                      Abrir textos
                    </Link>{' '}
                    <Link className="btn sm" href={`/importacao?pasta=${p.id}`}>
                      Importar
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
          <h2>Alertas emitidos</h2>
          <span className="spacer" />
          <span className="sub">últimos 100</span>
        </header>
        <table>
          <thead>
            <tr>
              <th style={{ width: 170 }}>Quando</th>
              <th style={{ width: 210 }}>Tipo</th>
              <th style={{ width: 170 }}>Pasta</th>
              <th>Detalhe</th>
              <th style={{ width: 120 }}>Envio</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={5} className="faint">
                  Nenhum alerta emitido ainda.
                </td>
              </tr>
            ) : (
              registros.map((registro) => {
                const detalhes = (registro.detalhes ?? {}) as DetalhesDoAlerta;
                const tipo = detalhes.tipo ?? registro.entidadeId ?? '';
                return (
                  <tr key={registro.id}>
                    <td>{formatarNoFuso(registro.criadoEm, 'America/Sao_Paulo')}</td>
                    <td>
                      <span className={CLASSE_DO_TIPO[tipo] ?? 'pill'}>
                        {TITULO_DO_ALERTA[tipo as TipoDeAlerta] ?? detalhes.titulo ?? tipo}
                      </span>
                    </td>
                    <td>{detalhes.pasta ?? <span className="faint">—</span>}</td>
                    <td>{detalhes.mensagem}</td>
                    <td>
                      <span className="pill">
                        {detalhes.destino === 'nenhum' ? 'só log' : `Telegram (${detalhes.destino})`}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="faint">
        A falha de um canal de alerta nunca interrompe a publicação nem gera novo alerta — só
        registro no log.
      </p>
    </Casca>
  );
}
