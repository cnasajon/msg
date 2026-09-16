import { sessaoAtual } from '@/lib/sessao';
import { comEscopo, escopoDeTexto } from '@/lib/escopo';
import { podeFazer } from '@/lib/autorizacao';
import { NaoEncontrado } from '@/lib/erros';
import { prisma } from '@/lib/db';
import { tamanhoDoTexto } from '@/lib/textos';
import { exportar, FORMATOS, nomeDoArquivo, type FormatoDeExportacao } from '@/lib/exportacao';
import { registrarAuditoria } from '@/lib/auditoria';

export const dynamic = 'force-dynamic';

/**
 * Download da exportação. Os filtros chegam pela URL, mas o recorte de dados
 * continua vindo do escopo da sessão — a URL escolhe **dentro** do que a pessoa
 * já pode ver, nunca além.
 */
export async function GET(pedido: Request) {
  const sessao = await sessaoAtual();
  if (!sessao) return new Response('Não autenticado.', { status: 401 });
  if (!podeFazer(sessao.perfil, 'textos.exportar')) return new Response('Sem permissão.', { status: 403 });

  const url = new URL(pedido.url);
  const formato = (url.searchParams.get('formato') ?? 'csv') as FormatoDeExportacao;
  if (!FORMATOS.some((f) => f.valor === formato)) {
    return new Response('Formato desconhecido.', { status: 400 });
  }

  try {
    const pasta = await comEscopo(sessao).pasta(url.searchParams.get('pasta') ?? '');
    const status = url.searchParams.get('status') ?? '';
    const comImagem = url.searchParams.get('imagem') ?? '';
    const busca = (url.searchParams.get('busca') ?? '').trim();
    // Escolha feita na lista. Continua sendo um recorte *dentro* do escopo: os
    // identificadores entram no mesmo `AND`, ao lado de `escopoDeTexto`, então
    // trocar um deles na URL não alcança texto de outra organização — some da
    // exportação, que é o resultado certo.
    const escolhidos = url.searchParams.getAll('textos').map((i) => i.trim()).filter(Boolean);

    const textos = await prisma.text.findMany({
      where: {
        AND: [
          escopoDeTexto(sessao),
          { folderId: pasta.id },
          escolhidos.length > 0 ? { id: { in: escolhidos } } : {},
          status ? { status: status as 'pendente' } : {},
          busca ? { conteudo: { contains: busca, mode: 'insensitive' } } : {},
          comImagem === 'com' ? { imagem: { not: null } } : {},
          comImagem === 'sem' ? { imagem: null } : {},
        ],
      },
      orderBy: [{ status: 'asc' }, { ordem: 'asc' }],
      select: {
        ordem: true,
        conteudo: true,
        status: true,
        publicadoEm: true,
        arquivadoEm: true,
        imagemMime: true,
        criadoEm: true,
      },
    });

    const organizacao = await prisma.organization.findUnique({
      where: { id: pasta.organizationId },
      select: { nome: true },
    });

    const filtros = [
      escolhidos.length > 0 ? `escolhidos na lista: ${escolhidos.length}` : null,
      status ? `situação: ${status}` : 'todas as situações',
      comImagem === 'com' ? 'só com imagem' : comImagem === 'sem' ? 'só sem imagem' : 'com e sem imagem',
      busca ? `busca: "${busca}"` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const gerado = new Date();
    const arquivo = await exportar(
      formato,
      textos.map((t) => ({
        ordem: t.status === 'pendente' ? t.ordem : null,
        conteudo: t.conteudo,
        situacao: t.status,
        publicadoEm: t.publicadoEm,
        arquivadoEm: t.arquivadoEm,
        temImagem: t.imagemMime !== null,
        caracteres: tamanhoDoTexto(t.conteudo),
        criadoEm: t.criadoEm,
      })),
      {
        organizacao: organizacao?.nome ?? '',
        pasta: pasta.nome,
        timezone: pasta.timezone,
        gerado,
        filtros,
      },
    );

    await registrarAuditoria(sessao, {
      acao: 'exportar',
      entidade: 'folder',
      entidadeId: pasta.id,
      detalhes: { formato, textos: textos.length, filtros },
    });

    const tipo = FORMATOS.find((f) => f.valor === formato)!.mime;
    return new Response(arquivo as unknown as BodyInit, {
      headers: {
        'content-type': tipo,
        'content-length': String(arquivo.byteLength),
        'content-disposition': `attachment; filename="${nomeDoArquivo(pasta.nome, formato, gerado)}"`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (erro) {
    if (erro instanceof NaoEncontrado) return new Response('Não encontrado.', { status: 404 });
    throw erro;
  }
}
