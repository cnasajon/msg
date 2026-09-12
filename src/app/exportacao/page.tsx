import Link from 'next/link';
import { redirect } from 'next/navigation';
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

  const filtros = await searchParams;
  const pastas = await prisma.folder.findMany({
    where: escopoDePasta(sessao),
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });
  const pasta = pastas.find((p) => p.id === filtros.pasta) ?? pastas[0] ?? null;

  if (!pasta) {
    return (
      <Casca sessao={sessao} titulo="Exportar textos" caminho="Textos" atual="/textos">
        <div className="banner warn">
          <div>Nenhuma pasta visível para você ainda.</div>
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
    <Casca sessao={sessao} titulo="Exportar textos" caminho={`Textos · ${pasta.nome}`} atual="/textos">
      <div className="card">
        <form className="toolbar" method="get">
          <select name="pasta" defaultValue={pasta.id} aria-label="Pasta">
            {pastas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <input type="text" name="busca" defaultValue={busca} placeholder="Buscar no conteúdo…" />
          <select name="status" defaultValue={status}>
            <option value="">Todas as situações</option>
            <option value="pendente">Pendente</option>
            <option value="publicado">Publicado</option>
            <option value="erro">Erro</option>
            <option value="arquivado">Arquivado</option>
          </select>
          <select name="imagem" defaultValue={imagem}>
            <option value="">Com e sem imagem</option>
            <option value="com">Só com imagem</option>
            <option value="sem">Só sem imagem</option>
          </select>
          <button className="btn" type="submit">
            Aplicar filtros
          </button>
          <span className="spacer" />
          <Link className="btn" href={`/textos?pasta=${pasta.id}`}>
            Voltar aos textos
          </Link>
        </form>

        <div className="body">
          <p style={{ marginTop: 0 }}>
            <b>{quantidade}</b> texto(s) serão exportados com estes filtros.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {FORMATOS.map((f) => (
              <a
                key={f.valor}
                className="btn primary"
                href={`/api/exportacao?${parametros.toString()}&formato=${f.valor}`}
              >
                Baixar {f.rotulo}
              </a>
            ))}
          </div>
          <p className="faint" style={{ marginBottom: 0, marginTop: 14 }}>
            A exportação respeita o que você enxerga: um usuário com duas pastas atribuídas exporta
            apenas essas duas. Datas saem no fuso da pasta, indicado no cabeçalho do arquivo.
          </p>
        </div>
      </div>
    </Casca>
  );
}
