import { comEscopo } from '@/lib/escopo';
import { sessaoAtual } from '@/lib/sessao';
import { NaoEncontrado } from '@/lib/erros';

export const dynamic = 'force-dynamic';

/**
 * Imagem de um texto, servida do Postgres.
 *
 * Esta rota é o ponto que a especificação manda provar: ela **não tem atalho**.
 * O identificador da URL passa pelo mesmo `comEscopo` das outras consultas, e
 * imagem de outra organização responde 404 — nunca 403, que confirmaria a
 * existência do registro. Sem sessão, 401.
 */
export async function GET(_pedido: Request, contexto: { params: Promise<{ id: string }> }) {
  const sessao = await sessaoAtual();
  if (!sessao) return new Response('Não autenticado.', { status: 401 });

  const { id } = await contexto.params;

  try {
    const texto = await comEscopo(sessao).imagemDoTexto(id);
    const corpo = new Uint8Array(texto.imagem);

    return new Response(corpo as unknown as BodyInit, {
      headers: {
        'content-type': texto.imagemMime ?? 'application/octet-stream',
        'content-length': String(corpo.byteLength),
        // privado: a imagem é de uma organização, não pode ficar em cache
        // compartilhado de proxy nenhum
        'cache-control': 'private, max-age=300',
        'content-disposition': `inline; filename="${(texto.imagemNomeOriginal ?? 'imagem').replace(/["\\]/g, '')}"`,
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (erro) {
    if (erro instanceof NaoEncontrado) return new Response('Não encontrado.', { status: 404 });
    throw erro;
  }
}
