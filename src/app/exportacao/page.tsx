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
  searchParams: Promise<{
    pasta?: string;
    status?: string;
    imagem?: string;
    busca?: string;
    textos?: string | string[];
  }>;
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
  // Quem chega pela barra de seleção da lista já disse o que quer exportar; aqui
  // só falta escolher o formato. Os demais filtros continuam aplicáveis, mas
  // sempre **dentro** da escolha.
  const escolhidos = (
    Array.isArray(filtros.textos) ? filtros.textos : filtros.textos ? [filtros.textos] : []
  )
    .map((i) => i.trim())
    .filter(Boolean);

  const quantidade = await prisma.text.count({
    where: {
      AND: [
        escopoDeTexto(sessao),
        { folderId: pasta.id },
        escolhidos.length > 0 ? { id: { in: escolhidos } } : {},
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
  for (const id of escolhidos) parametros.append('textos', id);

  return (
    <Casca
      sessao={sessao}
      titulo={t('titulo')}
      caminho={`${menu('textos')} · ${pasta.nome}`}
      atual="/textos"
    >
      <div className="card">
        <form className="toolbar" method="get">
          {/* Sem isto, mexer em qualquer filtro apagaria a escolha feita na lista:
              o formulário GET reescreve a URL inteira com os campos que tem. */}
          {escolhidos.map((id) => (
            <input key={id} type="hidden" name="textos" value={id} />
          ))}
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
          {escolhidos.length > 0 ? (
            <p style={{ marginTop: 0 }}>
              <b>{t('soAEscolha', { quantidade: escolhidos.length })}</b>{' '}
              <Link href={`/exportacao?pasta=${pasta.id}`}>{t('exportarTudo')}</Link>
            </p>
          ) : null}
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
