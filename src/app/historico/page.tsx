import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { escopoDePasta, escopoDePublicacao } from '@/lib/escopo';
import { formatarNoFuso, siglaDoFuso } from '@/lib/fuso';
import { resumir } from '@/lib/textos';
import { reenviarTexto } from '../pastas/acoes-agenda';

export const dynamic = 'force-dynamic';

const SITUACOES = [
  { valor: '', rotulo: 'Todas as situações' },
  { valor: 'enviada', rotulo: 'Enviada' },
  { valor: 'erro', rotulo: 'Erro' },
  { valor: 'perdida', rotulo: 'Perdida' },
  { valor: 'reivindicada', rotulo: 'Reivindicada' },
];

const CLASSE = {
  enviada: 'pill ok',
  erro: 'pill err',
  perdida: 'pill warn',
  reivindicada: 'pill',
} as const;

/** "1970-01-01T07:00:00Z" guardado como time vira "07:00". */
function horaDoSlot(valor: Date | null): string | null {
  return valor ? valor.toISOString().slice(11, 16) : null;
}

export default async function Historico({
  searchParams,
}: {
  searchParams: Promise<{ pasta?: string; status?: string; erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const filtros = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, timezone: true },
  });
  const pastaEscolhida = pastas.find((p) => p.id === filtros.pasta) ?? null;
  const status = SITUACOES.some((s) => s.valor === filtros.status) ? filtros.status : '';

  const publicacoes = await prisma.publication.findMany({
    where: {
      AND: [
        escopoDePublicacao(sessao),
        pastaEscolhida ? { folderId: pastaEscolhida.id } : {},
        status ? { status: status as 'enviada' } : {},
      ],
    },
    orderBy: [{ dataPrevista: 'desc' }, { horaPrevista: 'desc' }],
    take: 200,
    include: {
      folder: { select: { id: true, nome: true, timezone: true } },
      texto: { select: { id: true, conteudo: true, status: true } },
    },
  });

  return (
    <Casca sessao={sessao} titulo="Histórico de publicações" caminho="Textos" atual="/historico">
      <Avisos erro={filtros.erro} ok={filtros.ok} />

      <div className="card">
        <form className="toolbar" method="get">
          <select name="pasta" defaultValue={pastaEscolhida?.id ?? ''} aria-label="Pasta">
            <option value="">Todas as pastas visíveis</option>
            {pastas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status}>
            {SITUACOES.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            Filtrar
          </button>
          <span className="spacer" />
          <span className="faint">datas no fuso de cada pasta</span>
        </form>

        <table>
          <thead>
            <tr>
              <th style={{ width: 170 }}>Slot previsto</th>
              <th style={{ width: 160 }}>Pasta</th>
              <th>Texto publicado</th>
              <th style={{ width: 110 }}>Situação</th>
              <th style={{ width: 150 }}>Enviada em</th>
              <th style={{ width: 110 }}>message_id</th>
              <th style={{ width: 110 }} />
            </tr>
          </thead>
          <tbody>
            {publicacoes.length === 0 ? (
              <tr>
                <td colSpan={7} className="faint">
                  Nenhuma publicação ainda. Elas aparecem aqui assim que o dispatcher rodar o
                  primeiro slot.
                </td>
              </tr>
            ) : (
              publicacoes.map((p) => {
                const hora = horaDoSlot(p.horaPrevista);
                return (
                  <tr key={p.id}>
                    <td>
                      {p.dataPrevista.toISOString().slice(0, 10).split('-').reverse().join('/')}{' '}
                      {hora ? (
                        <>
                          {hora} <span className="tz">{siglaDoFuso(p.folder.timezone)}</span>
                        </>
                      ) : (
                        <span className="faint">sem hora</span>
                      )}
                      {p.origem !== 'dispatcher' ? (
                        <div className="faint">{p.origem === 'manual' ? 'publicado agora' : 'histórico importado'}</div>
                      ) : null}
                    </td>
                    <td>{p.folder.nome}</td>
                    <td>
                      {p.conteudoPublicado ? (
                        <>
                          {resumir(p.conteudoPublicado, 110)}
                          <div className="meta faint">
                            {p.tinhaImagem ? 'com imagem · ' : ''}
                            {p.texto ? '' : 'texto excluído depois da publicação — conteúdo preservado aqui'}
                          </div>
                        </>
                      ) : (
                        <span className="faint">
                          {p.status === 'perdida'
                            ? '— slot vencido além da tolerância'
                            : p.erroMensagem ?? '—'}
                        </span>
                      )}
                      {p.erroMensagem && p.conteudoPublicado ? (
                        <div className="meta" style={{ color: 'var(--danger)' }}>{p.erroMensagem}</div>
                      ) : null}
                      {p.status === 'erro' && !p.conteudoPublicado && p.erroMensagem ? (
                        <div className="meta" style={{ color: 'var(--danger)' }}>{p.erroMensagem}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={CLASSE[p.status]}>{p.status}</span>
                      {p.tentativas > 1 ? <div className="faint">{p.tentativas} tentativas</div> : null}
                    </td>
                    <td>
                      {p.enviadaEm ? (
                        formatarNoFuso(p.enviadaEm, p.folder.timezone)
                      ) : (
                        <span className="faint">—</span>
                      )}
                    </td>
                    <td className="num">{p.telegramMessageId ?? <span className="faint">—</span>}</td>
                    <td>
                      {p.status === 'erro' && p.texto ? (
                        <form action={reenviarTexto} style={{ display: 'inline' }}>
                          <CampoCsrf token={csrf} />
                          <input type="hidden" name="id" value={p.texto.id} />
                          <input type="hidden" name="destino" value="/historico" />
                          <button className="btn sm" type="submit">
                            Reenviar
                          </button>
                        </form>
                      ) : p.texto ? (
                        <Link className="btn sm" href={`/textos/${p.texto.id}`}>
                          Ver texto
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="faint">
        Cada linha é um slot <code>(pasta, data prevista, hora prevista)</code> — a mesma chave única
        que garante a idempotência: um slot nunca aparece duas vezes. O histórico importado entra sem
        hora prevista e nunca é reenviado pelo dispatcher.
      </p>
    </Casca>
  );
}
