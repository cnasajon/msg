import type { PrismaClient } from '@prisma/client';
import { instanteDoSlot } from './agenda';

/**
 * Marcar um texto como publicado numa data, ou desmarcar.
 *
 * Existe para o caso de a publicação ter acontecido fora daqui — alguém postou
 * à mão no grupo, ou o registro nasceu torto numa importação. É a mesma ideia
 * da coluna de data de publicação da importação, só que texto a texto, depois
 * do fato.
 *
 * Vive fora da ação de servidor, como `lib/mover.ts` e `lib/selecao.ts`, para
 * que os testes exercitem este caminho e não uma cópia dele.
 */

export type AjusteDaData =
  | { situacao: 'publicado'; quando: Date }
  | { situacao: 'pendente'; posicao: number };

/**
 * Converte o que veio do campo `datetime-local` num instante.
 *
 * O campo entrega "AAAA-MM-DDTHH:MM" sem fuso nenhum, e quem olha a tela está
 * pensando no fuso da pasta — é nele que a lista mostra as datas e é nele que
 * o agendamento acontece. Interpretar como UTC, ou como o fuso do navegador,
 * deslocaria a data em algumas horas sem ninguém perceber. `instanteDoSlot` é
 * o mesmo conversor que o agendamento usa, com as viradas de horário de verão
 * já resolvidas.
 */
export function instanteDoCampo(valor: string, timezone: string): Date | null {
  const casa = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(valor.trim());
  if (!casa) return null;
  const quando = instanteDoSlot(casa[1]!, casa[2]!, timezone);
  return Number.isNaN(quando.getTime()) ? null : quando;
}

/**
 * O dia do calendário em que aquele instante caiu, no fuso da pasta.
 *
 * `publications.data_prevista` é uma coluna `DATE`, e o dia dela precisa ser o
 * dia que quem olha a pasta enxerga. Guardar o instante cru deixaria o banco
 * derivar o dia do UTC: marcar 1º de março às 21h em São Paulo viraria 2 de
 * março no histórico, um dia à frente, porque em UTC já era meia-noite.
 */
export function diaNoFuso(quando: Date, timezone: string): Date {
  const dia = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(quando);
  return new Date(`${dia}T00:00:00.000Z`);
}

/** O valor que o campo `datetime-local` mostra para um instante, no fuso da pasta. */
export function campoDoInstante(quando: Date, timezone: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(quando);
  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  // `hourCycle` h23 pode devolver "24" na meia-noite em alguns ambientes.
  const hora = pegar('hour') === '24' ? '00' : pegar('hour');
  return `${pegar('year')}-${pegar('month')}-${pegar('day')}T${hora}:${pegar('minute')}`;
}

/**
 * Grava a data e acerta a situação.
 *
 * Com data, o texto passa a `publicado` e ganha uma linha em `publications` de
 * origem `retroativa`, sem hora prevista — do mesmo jeito que o histórico
 * importado, para não disputar slot com o dispatcher, que nunca reenvia essas
 * linhas.
 *
 * Sem data, o texto volta a `pendente` e ao fim da fila, e some a marcação
 * retroativa. As publicações que **de fato** saíram — dispatcher, publicar
 * agora, importação — ficam onde estão: o histórico sobrevive à edição, que é
 * ponto não negociável. Quer dizer que desmarcar um texto realmente publicado o
 * devolve à fila e ele publica de novo; é o que se está pedindo ao desmarcar, e
 * a tela avisa antes.
 */
export async function ajustarDataDePublicacao(
  prisma: PrismaClient,
  textoId: string,
  quando: Date | null,
  /** Fuso da pasta, que decide em que dia do calendário a publicação caiu. */
  timezone: string,
): Promise<AjusteDaData> {
  return prisma.$transaction(async (tx) => {
    const texto = await tx.text.findUniqueOrThrow({
      where: { id: textoId },
      select: { id: true, folderId: true, conteudo: true, imagemMime: true },
    });

    if (quando) {
      await tx.publication.deleteMany({ where: { textId: texto.id, origem: 'retroativa' } });
      await tx.publication.create({
        data: {
          folderId: texto.folderId,
          textId: texto.id,
          origem: 'retroativa',
          dataPrevista: diaNoFuso(quando, timezone),
          horaPrevista: null,
          status: 'enviada',
          conteudoPublicado: texto.conteudo,
          tinhaImagem: texto.imagemMime !== null,
          enviadaEm: quando,
        },
      });
      await tx.text.update({
        where: { id: texto.id },
        data: { status: 'publicado', publicadoEm: quando, erroMensagem: null, arquivadoEm: null },
      });
      return { situacao: 'publicado', quando } as const;
    }

    await tx.publication.deleteMany({ where: { textId: texto.id, origem: 'retroativa' } });
    // Volta para o fim da fila: a posição que ele tinha antes de publicar já foi
    // ocupada por outros, e enfiá-lo de volta no meio mexeria na ordem de textos
    // que ninguém pediu para mexer.
    const ultimo = await tx.text.findFirst({
      where: { folderId: texto.folderId },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });
    const posicao = (ultimo?.ordem ?? 0) + 1;
    await tx.text.update({
      where: { id: texto.id },
      data: { status: 'pendente', publicadoEm: null, erroMensagem: null, arquivadoEm: null, ordem: posicao },
    });
    return { situacao: 'pendente', posicao } as const;
  });
}
