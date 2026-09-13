import type { PrismaClient } from '@prisma/client';
import { comEscopo, escopoDeTexto, type Sessao } from './escopo';

export type ResultadoDaMudanca = {
  destino: { id: string; nome: string };
  movidos: number;
  /** Pulados por o destino já ter um texto com o mesmo conteúdo. */
  pulados: number;
};

/**
 * Move textos de uma pasta para outra.
 *
 * Duas coisas passam pelo escopo, não uma: a pasta de destino e cada texto
 * escolhido. A lista de identificadores vem do navegador, e sem o segundo
 * filtro bastaria injetar o id de um texto de outra organização no formulário
 * para arrastá-lo para dentro da sua.
 *
 * Os textos entram no fim da fila do destino, preservando a ordem relativa. O
 * par (pasta, conteúdo) é único no banco, então um texto idêntico a algum que o
 * destino já tenha é pulado em vez de derrubar o lote inteiro — é como a
 * importação trata duplicata.
 *
 * Vive aqui, e não dentro da ação de servidor, para que o teste exercite este
 * caminho e não uma cópia dele.
 */
export async function moverTextosParaPasta(
  prisma: PrismaClient,
  sessao: Sessao,
  pedido: { origemId: string; destinoId: string; ids: string[] },
): Promise<ResultadoDaMudanca> {
  const destino = await comEscopo(sessao).pasta(pedido.destinoId);

  const escolhidos = await prisma.text.findMany({
    where: {
      AND: [{ id: { in: pedido.ids } }, { folderId: pedido.origemId }, escopoDeTexto(sessao)],
    },
    orderBy: { ordem: 'asc' },
    select: { id: true, hashConteudo: true },
  });

  const jaNoDestino = await prisma.text.findMany({
    where: { folderId: destino.id, hashConteudo: { in: escolhidos.map((e) => e.hashConteudo) } },
    select: { hashConteudo: true },
  });
  const repetidos = new Set(jaNoDestino.map((r) => r.hashConteudo));
  const aMover = escolhidos.filter((e) => !repetidos.has(e.hashConteudo));

  if (aMover.length > 0) {
    const ultimo = await prisma.text.findFirst({
      where: { folderId: destino.id },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });
    let ordem = (ultimo?.ordem ?? 0) + 1;

    await prisma.$transaction(
      aMover.map((texto) =>
        prisma.text.update({
          where: { id: texto.id },
          data: { folderId: destino.id, ordem: ordem++ },
        }),
      ),
    );
  }

  return {
    destino: { id: destino.id, nome: destino.nome },
    movidos: aMover.length,
    pulados: escolhidos.length - aMover.length,
  };
}
