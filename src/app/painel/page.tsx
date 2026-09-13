import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { sessaoAtual } from '@/lib/sessao';
import { prisma } from '@/lib/db';
import { escopoDePasta, escopoDePublicacao, organizacaoEmVigor } from '@/lib/escopo';
import { proximoSlot, resumirDias } from '@/lib/agenda';
import { formatarNoFuso, siglaDoFuso } from '@/lib/fuso';
import { resumir } from '@/lib/textos';

export const dynamic = 'force-dynamic';

type TradutorDoPainel = Awaited<ReturnType<typeof getTranslations<'painel'>>>;

/** Diferenca em palavras: "em 3 horas", "ha 2 dias" — no idioma da interface. */
function quando(instante: Date, agora: Date, t: TradutorDoPainel): string {
  const minutos = Math.round((instante.getTime() - agora.getTime()) / 60_000);
  const absoluto = Math.abs(minutos);
  const futuro = minutos >= 0;

  if (absoluto < 1) return t('agora');
  if (absoluto < 60) return t(futuro ? 'emMinutos' : 'haMinutos', { quantidade: absoluto });
  if (absoluto < 60 * 24) {
    return t(futuro ? 'emHoras' : 'haHoras', { quantidade: Math.round(absoluto / 60) });
  }
  return t(futuro ? 'emDias' : 'haDias', { quantidade: Math.round(absoluto / (60 * 24)) });
}

export default async function Painel() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const t = await getTranslations('painel');
  const menu = await getTranslations('menu');
  const comum = await getTranslations('comum');
  const historico = await getTranslations('historico');
  const dias = await getTranslations('dias');

  const agora = new Date();
  const orgEmVigor = organizacaoEmVigor(sessao);

  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    include: {
      schedules: true,
      textos: {
        where: { status: 'pendente' },
        orderBy: { ordem: 'asc' },
        select: { id: true, conteudo: true, imagemMime: true },
      },
    },
  });

  const ultimasPublicacoes = await prisma.publication.findMany({
    where: { AND: [escopoDePublicacao(sessao), { status: 'enviada' }] },
    orderBy: { enviadaEm: 'desc' },
    take: 8,
    include: {
      folder: { select: { nome: true, timezone: true } },
      texto: { select: { id: true, imagemMime: true } },
    },
  });

  const comErro = await prisma.publication.count({
    where: { AND: [escopoDePublicacao(sessao), { status: 'erro' }] },
  });

  // Cada pasta com o que interessa olhar todo dia: quando sai a proxima, qual
  // texto sai, e se a fila aguenta.
  const linhas = pastas.map((pasta) => {
    const agendamentos = pasta.schedules.map((s) => ({
      horaLocal: s.horaLocal,
      diasSemana: s.diasSemana,
      ativo: s.ativo,
    }));
    return {
      pasta,
      proximo: proximoSlot(agendamentos, pasta.timezone, agora),
      proximoTexto: pasta.textos[0] ?? null,
      pendentes: pasta.textos.length,
      agendamentosAtivos: agendamentos.filter((a) => a.ativo),
    };
  });

  const totalPendentes = linhas.reduce((soma, l) => soma + l.pendentes, 0);
  const filasCurtas = linhas.filter((l) => l.agendamentosAtivos.length > 0 && l.pendentes < 5);
  const semAgendamento = linhas.filter((l) => l.agendamentosAtivos.length === 0);
  const semChatId = linhas.filter((l) => !l.pasta.telegramChatId);

  const publicadosEm30Dias = await prisma.publication.count({
    where: {
      AND: [
        escopoDePublicacao(sessao),
        { status: 'enviada' },
        { enviadaEm: { gte: new Date(agora.getTime() - 30 * 24 * 3_600_000) } },
      ],
    },
  });

  const proximaDeTodas = linhas
    .filter((l) => l.proximo)
    .sort((a, b) => a.proximo!.instante.getTime() - b.proximo!.instante.getTime())[0];

  return (
    <Casca sessao={sessao} titulo={t('titulo')} caminho={menu('painelDeControle')} atual="/painel">
      {sessao.perfil === 'superadmin' && !orgEmVigor ? (
        <div className="banner warn">
          <div>
            {t('semOrganizacao')}
          </div>
        </div>
      ) : null}

      {comErro > 0 ? (
        <div className="banner err">
          <div>
            <div className="ttl">
              {t('comErro', { quantidade: comErro })}
            </div>
            <Link href="/alertas">{t('verAlertas')}</Link> ·{' '}
            <Link href="/historico?status=erro">{t('verHistorico')}</Link>
          </div>
        </div>
      ) : null}

      {filasCurtas.length > 0 ? (
        <div className="banner warn">
          <div>
            <div className="ttl">
              {filasCurtas.length === 1
                ? t('filaCurtaUma', { pasta: filasCurtas[0]!.pasta.nome })
                : t('filaCurtaVarias', { quantidade: filasCurtas.length })}
            </div>
            {t('filaCurtaExplicacao')}{' '}
            {filasCurtas.map((l) => (
              <Link key={l.pasta.id} href={`/importacao?pasta=${l.pasta.id}`} style={{ marginRight: 10 }}>
                {t('importarPara', { pasta: l.pasta.nome })}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid c4">
        <div className="card stat">
          <div className="k">{t('pastas')}</div>
          <div className="v num">{pastas.length}</div>
          <div className="d">
            {semChatId.length > 0
              ? t('semChatId', { quantidade: semChatId.length })
              : semAgendamento.length > 0
                ? t('semAgendamento', { quantidade: semAgendamento.length })
                : t('todasConfiguradas')}
          </div>
        </div>
        <div className="card stat">
          <div className="k">{t('textosPendentes')}</div>
          <div className="v num">{totalPendentes}</div>
          <div className="d">
            {filasCurtas.length > 0
              ? t('pastasComFilaCurta', { quantidade: filasCurtas.length })
              : t('filasSaudaveis')}
          </div>
        </div>
        <div className="card stat">
          <div className="k">{t('publicadosEm30Dias')}</div>
          <div className="v num">{publicadosEm30Dias}</div>
          <div className="d">
            {comErro > 0 ? t('comErroContagem', { quantidade: comErro }) : t('nenhumErro')}
          </div>
        </div>
        <div className="card stat">
          <div className="k">{t('proximaPublicacao')}</div>
          <div className="v">{proximaDeTodas ? proximaDeTodas.proximo!.hora : '—'}</div>
          <div className="d">
            {proximaDeTodas ? (
              <>
                {quando(proximaDeTodas.proximo!.instante, agora, t)} · {proximaDeTodas.pasta.nome}
              </>
            ) : (
              t('nenhumAgendamentoAtivo')
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <header>
          <h2>{t('pastas')}</h2>
          <span className="spacer" />
          <span className="faint">{comum('fusoDaPasta')}</span>
        </header>
        <table>
          <thead>
            <tr>
              <th>{menu('pastas')}</th>
              <th style={{ width: 210 }}>{t('proximaPublicacao')}</th>
              <th>{t('proximoDaFila')}</th>
              <th style={{ width: 120 }}>{t('pendentes')}</th>
              <th style={{ width: 150 }} />
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={5} className="faint">
                  {t('nenhumaPasta')}
                </td>
              </tr>
            ) : (
              linhas.map(({ pasta, proximo, proximoTexto, pendentes, agendamentosAtivos }) => (
                <tr key={pasta.id}>
                  <td>
                    <b>{pasta.nome}</b>
                    <div className="faint">
                      {pasta.timezone}
                      {!pasta.ativa ? ` · ${t('pastaInativa')}` : ''}
                      {!pasta.telegramChatId ? ` · ${t('chatIdAusente')}` : ''}
                    </div>
                  </td>
                  <td>
                    {proximo ? (
                      <>
                        {proximo.data.split('-').reverse().join('/')} às {proximo.hora}{' '}
                        <span className="tz">{siglaDoFuso(pasta.timezone)}</span>
                        <div className="faint">
                          {quando(proximo.instante, agora, t)} ·{' '}
                          {resumirDias(agendamentosAtivos.flatMap((a) => a.diasSemana), dias)}
                        </div>
                      </>
                    ) : (
                      <span className="faint">
                        {t('semAgendamentoAtivo')} ·{' '}
                        <Link href={`/pastas/${pasta.id}`}>{t('configurar')}</Link>
                      </span>
                    )}
                  </td>
                  <td className="textcell">
                    {proximoTexto ? (
                      <>
                        {proximoTexto.imagemMime ? (
                          <img className="thumb" src={`/api/textos/${proximoTexto.id}/imagem`} alt="" />
                        ) : (
                          <div className="thumb empty">—</div>
                        )}
                        <div className="t">
                          <p>{resumir(proximoTexto.conteudo, 90)}</p>
                        </div>
                      </>
                    ) : (
                      <span className="faint">
                        {pasta.aoEsgotar === 'reiniciar' ? t('filaVaziaReinicia') : t('filaVaziaPara')}
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={pendentes === 0 ? 'pill err' : pendentes < 5 ? 'pill warn' : 'pill ok'}
                    >
                      {pendentes}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Link className="btn sm" href={`/textos?pasta=${pasta.id}`}>
                      {menu('textos')}
                    </Link>{' '}
                    <Link className="btn sm" href={`/importacao?pasta=${pasta.id}`}>
                      {t('importar')}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <header>
          <h2>{t('ultimosPublicados')}</h2>
          <span className="spacer" />
          <Link className="btn sm" href="/historico">
            {t('historicoCompleto')}
          </Link>
        </header>
        <table>
          <tbody>
            {ultimasPublicacoes.length === 0 ? (
              <tr>
                <td className="faint">
                  {t('nadaPublicado')}
                </td>
              </tr>
            ) : (
              ultimasPublicacoes.map((p) => (
                <tr key={p.id}>
                  <td className="textcell">
                    {p.texto?.imagemMime ? (
                      <img className="thumb" src={`/api/textos/${p.texto.id}/imagem`} alt="" />
                    ) : (
                      <div className="thumb empty">{p.tinhaImagem ? '×' : '—'}</div>
                    )}
                    <div className="t">
                      <p>{resumir(p.conteudoPublicado ?? '', 120)}</p>
                      <div className="meta">
                        {p.folder.nome} ·{' '}
                        {p.enviadaEm ? formatarNoFuso(p.enviadaEm, p.folder.timezone) : '—'}
                        {p.origem === 'manual' ? ` · ${historico('publicadoAgora')}` : ''}
                        {p.origem === 'importacao' ? ` · ${historico('historicoImportado')}` : ''}
                      </div>
                    </div>
                  </td>
                  <td style={{ width: 110, textAlign: 'right' }}>
                    <span className="pill ok">{historico('enviada')}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Casca>
  );
}
