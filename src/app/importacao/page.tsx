import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { CampoCsrf } from '@/components/csrf';
import { Avisos } from '@/components/avisos';
import { AssistenteDeImportacao } from '@/components/assistente-importacao';
import { sessaoAtual } from '@/lib/sessao';
import { tokenCsrfPara } from '@/lib/csrf';
import { prisma } from '@/lib/db';
import { escopoDePasta, escopoDeImportacao } from '@/lib/escopo';
import { formatarNoFuso } from '@/lib/fuso';
import { desfazerImportacao, importar } from './acoes';

export const dynamic = 'force-dynamic';

export default async function Importacao({
  searchParams,
}: {
  searchParams: Promise<{ pasta?: string; erro?: string; ok?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const t = await getTranslations('importacao');
  const textos = await getTranslations('textos');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');
  const idioma = await getLocale();

  const { pasta: pastaId, erro, ok } = await searchParams;
  const csrf = tokenCsrfPara(sessao.sessaoId);

  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, timezone: true },
  });
  const pasta = pastas.find((p) => p.id === pastaId) ?? pastas[0] ?? null;

  if (!pasta) {
    return (
      <Casca sessao={sessao} titulo={menu('importacao')} caminho={menu('textos')} atual="/importacao">
        <Avisos erro={erro} ok={ok} />
        <div className="banner warn">
          <div>{textos('semPasta')}</div>
        </div>
      </Casca>
    );
  }

  const importacoes = await prisma.import.findMany({
    where: { AND: [escopoDeImportacao(sessao), { folderId: pasta.id }] },
    orderBy: { criadoEm: 'desc' },
    take: 20,
    include: {
      autor: { select: { nome: true } },
      _count: { select: { textos: true } },
    },
  });

  return (
    <Casca
      sessao={sessao}
      titulo={t('titulo')}
      caminho={`${menu('textos')} · ${pasta.nome}`}
      atual="/importacao"
    >
      <Avisos erro={erro} ok={ok} />

      <div className="card">
        <form className="toolbar" method="get">
          <select name="pasta" defaultValue={pasta.id} aria-label={menu('pastas')}>
            {pastas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            {t('trocarPasta')}
          </button>
          <span className="spacer" />
          <Link className="btn" href={`/textos?pasta=${pasta.id}`}>
            {t('verTextos')}
          </Link>
        </form>
      </div>

      <AssistenteDeImportacao
        folderId={pasta.id}
        csrf={<CampoCsrf token={csrf} />}
        acao={importar}
      />

      <div className="card">
        <header>
          <h2>{t('anteriores')}</h2>
        </header>
        <table>
          <thead>
            <tr>
              <th>{t('arquivoColuna')}</th>
              <th>{t('quando')}</th>
              <th>{t('por')}</th>
              <th className="num">{t('linhas')}</th>
              <th className="num">{t('importadas')}</th>
              <th className="num">{t('historico')}</th>
              <th className="num">{t('duplicadas')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {importacoes.length === 0 ? (
              <tr>
                <td colSpan={8} className="faint">
                  {t('nenhuma')}
                </td>
              </tr>
            ) : (
              importacoes.map((i) => (
                <tr key={i.id}>
                  <td>
                    <code>{i.arquivoNome}</code>
                  </td>
                  <td>{formatarNoFuso(i.criadoEm, pasta.timezone, idioma)}</td>
                  <td>{i.autor?.nome ?? <span className="faint">{comum('nenhum')}</span>}</td>
                  <td className="num">{i.totalLinhas}</td>
                  <td className="num">{i.importadas}</td>
                  <td className="num">{i.importadasComoHistorico}</td>
                  <td className="num">{i.duplicadasIgnoradas}</td>
                  <td>
                    {i.desfeitoEm ? (
                      <span className="faint">
                        {t('desfeitaEm', { quando: formatarNoFuso(i.desfeitoEm, pasta.timezone, idioma) })}
                      </span>
                    ) : i._count.textos === 0 ? (
                      <span className="faint">{t('semTextosRestantes')}</span>
                    ) : (
                      <form action={desfazerImportacao} style={{ display: 'inline' }}>
                        <CampoCsrf token={csrf} />
                        <input type="hidden" name="id" value={i.id} />
                        <button className="btn sm" type="submit">
                          {t('desfazer')}
                        </button>
                      </form>
                    )}
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
