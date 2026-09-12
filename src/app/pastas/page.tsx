import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { prisma } from '@/lib/db';
import { escopoDePasta, organizacaoEmVigor } from '@/lib/escopo';
import { criarPasta } from './acoes';

export const dynamic = 'force-dynamic';

const AO_ESGOTAR = {
  parar_notificar: 'parar e notificar',
  reiniciar: 'reiniciar fila',
} as const;

export default async function Pastas({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');
  if (!podeFazer(sessao.perfil, 'pastas.gerenciar')) redirect('/inicio');

  const { erro, ok } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);
  const orgEmVigor = organizacaoEmVigor(sessao);

  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    include: {
      _count: { select: { schedules: true } },
      textos: { where: { status: 'pendente' }, select: { id: true } },
    },
  });

  const organizacao = orgEmVigor
    ? await prisma.organization.findUnique({
        where: { id: orgEmVigor },
        select: { timezonePadrao: true },
      })
    : null;

  return (
    <Casca sessao={sessao} titulo="Pastas" caminho="Configuração" atual="/pastas">
      <Avisos erro={erro} ok={ok} />

      {!orgEmVigor ? (
        <div className="banner warn">
          <div>
            Nenhuma organização ativa escolhida. Escolha uma no seletor do topo para ver e criar
            pastas.
          </div>
        </div>
      ) : null}

      <div className="card">
        <header>
          <h2>Pastas da organização</h2>
          <span className="spacer" />
          <span className="sub">{pastas.length} no total</span>
        </header>
        <table>
          <thead>
            <tr>
              <th>Pasta</th>
              <th>Grupo de destino</th>
              <th>Fuso</th>
              <th className="num">Agendamentos</th>
              <th>Fila</th>
              <th>Ao esgotar</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pastas.length === 0 ? (
              <tr>
                <td colSpan={8} className="faint">
                  Nenhuma pasta ainda. Crie a primeira no formulário abaixo.
                </td>
              </tr>
            ) : (
              pastas.map((p) => {
                const pendentes = p.textos.length;
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{p.nome}</b>
                      {p.descricao ? <div className="faint">{p.descricao}</div> : null}
                    </td>
                    <td>
                      {p.telegramChatId ? (
                        <code>{p.telegramChatId}</code>
                      ) : (
                        <span className="faint">não configurado</span>
                      )}
                      {p.telegramBotTokenCifrado ? (
                        <div className="faint">bot próprio (sobreposição)</div>
                      ) : null}
                    </td>
                    <td>{p.timezone}</td>
                    <td className="num">{p._count.schedules}</td>
                    <td>
                      <span className={pendentes === 0 ? 'pill err' : pendentes < 5 ? 'pill warn' : 'pill'}>
                        {pendentes} pendente{pendentes === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td>{AO_ESGOTAR[p.aoEsgotar]}</td>
                    <td>
                      <span className={p.ativa ? 'pill ok' : 'pill'}>{p.ativa ? 'ativa' : 'inativa'}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link className="btn sm" href={`/pastas/${p.id}`}>
                        Configurar
                      </Link>{' '}
                      <Link className="btn sm" href={`/textos?pasta=${p.id}`}>
                        Textos
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {orgEmVigor ? (
        <div className="card">
          <header>
            <h2>Nova pasta</h2>
          </header>
          <div className="body">
            <form action={criarPasta}>
              <CampoCsrf token={csrf} />
              <div className="row">
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">Nome</span>
                  <input type="text" name="nome" required />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">Descrição</span>
                  <input type="text" name="descricao" />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">Fuso horário</span>
                  <input
                    type="text"
                    name="timezone"
                    defaultValue={organizacao?.timezonePadrao ?? 'America/Sao_Paulo'}
                    required
                  />
                  <span className="hint">Agendamento e exibição usam sempre este fuso.</span>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">chat_id do grupo</span>
                  <input type="text" name="telegramChatId" placeholder="-100…" />
                  <span className="hint">Pode ficar em branco e ser preenchido depois.</span>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="lbl">Ao esgotar a fila</span>
                  <select name="aoEsgotar" defaultValue="parar_notificar">
                    <option value="parar_notificar">Parar e notificar</option>
                    <option value="reiniciar">Reiniciar a fila</option>
                  </select>
                </label>
              </div>
              <button className="btn primary" type="submit" style={{ marginTop: 4 }}>
                Criar pasta
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </Casca>
  );
}
