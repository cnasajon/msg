import type { PrismaClient } from '@prisma/client';
import { escopoDeTexto, type Sessao } from './escopo';

/**
 * O que se faz com as linhas escolhidas na lista de textos.
 *
 * Vive aqui, e não dentro das ações de servidor, pelo mesmo motivo de
 * `lib/mover.ts`: as ações trazem CSRF, tradução e redirecionamento em volta, e
 * o teste precisa exercitar a regra em si — sobretudo o escopo, que é o que
 * separa uma organização da outra.
 */

/**
 * Os textos escolhidos que a sessão realmente alcança.
 *
 * Os identificadores vêm do navegador; o escopo é quem decide quais existem.
 * Devolver só os permitidos, em vez de recusar o lote inteiro quando um não
 * bate, seria pior: a pessoa veria "3 arquivados" tendo escolhido 4, sem saber
 * qual ficou de fora — e um id forjado teria efeito parcial silencioso. Aqui o
 * lote é tudo ou nada, e `null` quer dizer "não faça nada".
 */
export async function escolhidosNaLista(
  prisma: PrismaClient,
  sessao: Sessao,
  folderId: string,
  ids: string[],
): Promise<string[] | null> {
  const limpos = [...new Set(ids.map((i) => i.trim()).filter(Boolean))];
  if (limpos.length === 0) return null;

  const permitidos = await prisma.text.findMany({
    where: { AND: [{ id: { in: limpos } }, { folderId }, escopoDeTexto(sessao)] },
    select: { id: true },
  });
  return permitidos.length === limpos.length ? limpos : null;
}

/**
 * Abre espaço logo depois de um texto e devolve a ordem do buraco.
 *
 * Sem isto todo texto novo cai no fim da fila, e intercalar um no meio exigia
 * criar e depois arrastar. O texto de referência passa pelo escopo como
 * qualquer outro: o identificador chega pela URL, e um de outra organização
 * precisa devolver `null` — o texto entra no fim, e não no meio da fila alheia.
 *
 * O deslocamento e a leitura da posição correm na mesma transação porque dois
 * textos criados ao mesmo tempo na mesma pasta pegariam a mesma ordem se cada
 * um lesse antes de o outro deslocar.
 */
export async function abrirEspacoDepoisDe(
  prisma: PrismaClient,
  sessao: Sessao,
  folderId: string,
  textoDeReferenciaId: string,
): Promise<number | null> {
  return prisma.$transaction(async (tx) => {
    const referencia = await tx.text.findFirst({
      where: { AND: [{ id: textoDeReferenciaId }, { folderId }, escopoDeTexto(sessao)] },
      select: { ordem: true },
    });
    if (!referencia) return null;

    await tx.text.updateMany({
      where: { folderId, ordem: { gt: referencia.ordem } },
      data: { ordem: { increment: 1 } },
    });
    return referencia.ordem + 1;
  });
}
