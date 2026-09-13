import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Casca } from '@/components/casca';
import { sessaoAtual } from '@/lib/sessao';
import { prisma } from '@/lib/db';
import { escopoDePasta, escopoDeTexto } from '@/lib/escopo';
import { FORMATOS } from '@/lib/exportacao';

export const dynamic = 'force-dynamic';

export default async function Exportacao({
  searchParams,
}: {
  searchParams: Promise<{ pasta?: string; status?: string; imagem?: string; busca?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect('/entrar');
  if (sessao.senhaProvisoria) redirect('/primeiro-acesso');

  const t = await getTranslations('exportacao');
  const textos = await getTranslations('textos');
  const comum = await getTranslations('comum');
  const menu = await getTranslations('menu');

  const filtros = await searchParams;
  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });
  const pasta = pastas.find((p) => p.id === filtros.pasta) ?? pastas[0] ?? null;

  if (!pasta) {
    return (
      <Casca sessao={sessao} titulo={t('titulo')} caminho={menu('textos')} atual="/textos">
        <div className="banner warn">
          <div>{textos('semPasta')}</div>
        </div>
      </Casca>
    );
  }

  const status = filtros.status ?? '';
  const imagem = filtros.imagem ?? '';
  const busca = (filtros.busca ?? '').trim();

  const quantidade = await prisma.text.count({
    where: {
      AND: [
        escopoDeTexto(sessao),
        { folderId: pasta.id },
        status ? { status: status as 'pendente' } : {},
        busca ? { conteudo: { contains: busca, mode: 'insensitive' } } : {},
        imagem === 'com' ? { imagem: { not: null } } : {},
        imagem === 'sem' ? { imagem: null } : {},
      ],
    },
  });

  const parametros = new URLSearchParams({ pasta: pasta.id });
  if (status) parametros.set('status', status);
  if (imagem) parametros.set('imagem', imagem);
  if (busca) parametros.set('busca', busca);

  return (
    <Casca
      sessao={sessao}
      titulo={t('titulo')}
      caminho={`${menu('textos')} · ${pasta.nome}`}
      atual="/textos"
    >
      <div className="card">
        <form className="toolbar" method="get">
          <select name="pasta" defaultValue={pasta.id} aria-label={menu('pastas')}>
            {pastas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <input type="text" name="busca" defaultValue={busca} placeholder={comum('buscar')} />
          <select name="status" defaultValue={status}>
            <option value="">{textos('todasAsSituacoes')}</option>
            <option value="pendente">{textos('pendente')}</option>
            <option value="publicado">{textos('publicado')}</option>
            <option value="erro">{textos('erro')}</option>
            <option value="arquivado">{textos('arquivado')}</option>
          </select>
          <select name="imagem" defaultValue={imagem}>
            <option value="">{textos('comESemImagem')}</option>
            <option value="com">{textos('soComImagem')}</option>
            <option value="sem">{textos('soSemImagem')}</option>
          </select>
          <button className="btn" type="submit">
            {t('aplicarFiltros')}
          </button>
          <span className="spacer" />
          <Link className="btn" href={`/textos?pasta=${pasta.id}`}>
            {t('voltarAosTextos')}
          </Link>
        </form>

        <div className="body">
          <p style={{ marginTop: 0 }}>
            {t.rich('seraoExportados', { quantidade, b: (partes) => <b>{partes}</b> })}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {FORMATOS.map((f) => (
              <a
                key={f.valor}
                className="btn primary"
                href={`/api/exportacao?${parametros.toString()}&formato=${f.valor}`}
              >
                {t('baixar', { formato: f.rotulo })}
              </a>
            ))}
          </div>
          <p className="faint" style={{ marginBottom: 0, marginTop: 14 }}>
            {t('respeitaEscopo')}
          </p>
        </div>
      </div>
    </Casca>
  );
}
