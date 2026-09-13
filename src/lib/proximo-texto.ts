import type { PrismaClient } from '@prisma/client';

/** O que o envio precisa saber do texto escolhido. */
export type TextoParaPublicar = {
  id: string;
  conteudo: string;
  imagem: Uint8Array | null;
  imagemMime: string | null;
};

const CAMPOS = { id: true, conteudo: true, imagem: true, imagemMime: true } as const;

/** Lista por fila: o pendente de menor ordem. */
export function proximoDaFila(
  prisma: PrismaClient,
  folderId: string,
): Promise<TextoParaPublicar | null> {
  return prisma.text.findFirst({
    where: { folderId, status: 'pendente' },
    orderBy: { ordem: 'asc' },
    select: CAMPOS,
  });
}

/**
 * Lista por data: o texto cujo padrão casa com a data do slot.
 *
 * A situação do texto não conta aqui, tirando `arquivado`. Numa lista por data o
 * mesmo texto sai sempre que a data casar — um padrão de mês 9 com dia e ano
 * curinga sai em todos os dias de setembro que estiverem marcados —, então ficar
 * `publicado` não pode tirá-lo do caminho, como tira na fila.
 *
 * Quando mais de um texto casa com o mesmo dia, sai o que está há mais tempo
 * sem sair, e quem nunca saiu vem antes de todos; `ordem` desempata. Assim três
 * textos marcados para o mesmo mês se revezam, em vez de o primeiro deles
 * ocupar todos os slots e os outros nunca aparecerem.
 *
 * `data` chega como `aaaa-mm-dd` **no fuso da pasta** — quem converte é o
 * cálculo do slot, e é por isso que a data entra pronta em vez de ser derivada
 * aqui de um instante em UTC.
 */
export async function textoParaAData(
  prisma: PrismaClient,
  folderId: string,
  data: string,
): Promise<TextoParaPublicar | null> {
  const [ano, mes, dia] = data.split('-').map(Number);

  const candidatos = await prisma.text.findMany({
    where: {
      folderId,
      status: { not: 'arquivado' },
      AND: [
        { OR: [{ diaDaPublicacao: null }, { diaDaPublicacao: dia }] },
        { OR: [{ mesDaPublicacao: null }, { mesDaPublicacao: mes }] },
        { OR: [{ anoDaPublicacao: null }, { anoDaPublicacao: ano }] },
      ],
    },
    orderBy: [{ publicadoEm: { sort: 'asc', nulls: 'first' } }, { ordem: 'asc' }],
    take: 1,
    select: CAMPOS,
  });

  return candidatos[0] ?? null;
}
