import { prisma } from './db';

/**
 * Como a lista de textos estava da última vez, por pessoa.
 *
 * Quem trabalha numa pasta passa o dia voltando a ela, e a tela recomeçava
 * sempre na primeira em ordem alfabética, com todas as situações — duas
 * escolhas a refazer a cada visita.
 *
 * Vive no usuário, e não na sessão nem num cookie, pela mesma razão da última
 * organização (`lib/organizacao-lembrada.ts`): é preferência de quem usa. Sessão
 * morre a cada logout e a cada troca de domínio; cookie morre a cada limpeza do
 * navegador e não acompanha quem troca de máquina.
 */

/** As opções do filtro de situação. `''` é "todas as situações". */
export const SITUACOES = ['', 'pendente', 'publicado', 'erro', 'arquivado'] as const;
export type SituacaoFiltrada = (typeof SITUACOES)[number];

export type ListaLembrada = {
  /** `null` quando a pessoa nunca escolheu, ou a pasta escolhida sumiu. */
  pastaId: string | null;
  status: SituacaoFiltrada;
};

export const NADA_LEMBRADO: ListaLembrada = { pastaId: null, status: '' };

/**
 * Qual pasta a lista abre: a da URL, senão a da última visita, senão a primeira.
 *
 * Recebe as pastas **já filtradas pelo escopo** e procura dentro delas, em vez
 * de consultar o banco por conta própria. É o que garante que nem um id forjado
 * na URL nem uma pasta lembrada de outra organização — ou de uma organização que
 * a pessoa deixou de operar — abram a tela: não casando, a busca cai na opção
 * seguinte. Uma segunda porta de entrada para o mesmo dado é exatamente o que o
 * escopo existe para evitar.
 */
export function pastaDaVez<T extends { id: string }>(
  pastasNoEscopo: T[],
  daUrl: string | undefined,
  lembrada: string | null,
): T | null {
  return (
    pastasNoEscopo.find((p) => p.id === daUrl) ??
    pastasNoEscopo.find((p) => p.id === lembrada) ??
    pastasNoEscopo[0] ??
    null
  );
}

export async function listaLembrada(usuarioId: string): Promise<ListaLembrada> {
  const usuario = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { ultimaPastaId: true, ultimoStatusDeTexto: true },
  });
  if (!usuario) return NADA_LEMBRADO;

  // A pasta lembrada não é conferida aqui: quem chama procura este id **dentro**
  // da lista de pastas que o escopo já devolveu, e um id que não esteja lá
  // simplesmente não casa. Conferir de novo seria uma consulta a mais para
  // chegar ao mesmo lugar — e uma segunda porta de entrada para o mesmo dado,
  // que é justamente o que o escopo existe para evitar.
  return {
    pastaId: usuario.ultimaPastaId,
    // Nulo no banco é "todas as situações", que é também o padrão da tela.
    status: usuario.ultimoStatusDeTexto ?? '',
  };
}

/**
 * Grava a escolha, se ela mudou.
 *
 * A comparação com o que já estava guardado não é economia à toa: sem ela toda
 * abertura da lista faria um `UPDATE`, inclusive as que não escolheram nada.
 */
export async function lembrarLista(
  usuarioId: string,
  anterior: ListaLembrada,
  escolha: ListaLembrada,
): Promise<void> {
  if (anterior.pastaId === escolha.pastaId && anterior.status === escolha.status) return;

  await prisma.user.update({
    where: { id: usuarioId },
    data: {
      ultimaPastaId: escolha.pastaId,
      ultimoStatusDeTexto: escolha.status === '' ? null : escolha.status,
    },
  });
}
