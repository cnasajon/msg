import type { Prisma } from '@prisma/client';

/**
 * Ordenação da lista de textos pelo clique no cabeçalho.
 *
 * Vive fora da tela porque duas coisas dependem dela e precisam concordar: a
 * consulta ao banco e a decisão de mostrar ou não as alças de arrastar. Arrastar
 * só faz sentido quando a lista está na ordem da fila — numa lista ordenada por
 * data, soltar uma linha entre outras duas não quer dizer nada sobre a posição
 * na fila, e gravar aquilo como ordem seria embaralhar a fila sem a pessoa
 * pedir.
 */

export const COLUNAS = ['ordem', 'texto', 'situacao', 'publicadoEm'] as const;
export type Coluna = (typeof COLUNAS)[number];

export type Ordenacao = { coluna: Coluna; descendente: boolean };

/** O padrão: a fila como ela sai, pendentes primeiro. */
export const ORDEM_DA_FILA: Ordenacao = { coluna: 'ordem', descendente: false };

export function lerOrdenacao(
  coluna: string | undefined,
  sentido: string | undefined,
): Ordenacao {
  const escolhida = COLUNAS.find((c) => c === coluna);
  if (!escolhida) return ORDEM_DA_FILA;
  return { coluna: escolhida, descendente: sentido === 'desc' };
}

/** O que o próximo clique no mesmo cabeçalho deve fazer: primeiro sobe, depois desce. */
export function proximoSentido(atual: Ordenacao, coluna: Coluna): 'asc' | 'desc' {
  return atual.coluna === coluna && !atual.descendente ? 'desc' : 'asc';
}

/**
 * A ordenação traduzida para o Prisma.
 *
 * `status` entra sempre à frente na ordem da fila porque a lista mostra as
 * quatro situações juntas: sem isso, um texto arquivado com `ordem` 2 apareceria
 * no meio dos pendentes, como se estivesse na fila.
 *
 * O desempate por `id` não é capricho: sem ele, linhas com o mesmo valor na
 * coluna escolhida — várias sem data de publicação, por exemplo — podem trocar
 * de lugar entre um carregamento e outro, e a pessoa clica na linha errada.
 */
export function paraPrisma(
  ordenacao: Ordenacao,
  /** Numa lista por data, a primeira coluna é a data prevista, não a fila. */
  porData = false,
): Prisma.TextOrderByWithRelationInput[] {
  const dir = ordenacao.descendente ? ('desc' as const) : ('asc' as const);

  if (ordenacao.coluna === 'ordem') {
    if (porData) {
      // Ano, mês e dia são colunas separadas porque cada uma aceita `*`; a
      // ordenação segue a mesma hierarquia de leitura. Nulo é o `*`, e vai
      // para o fim: "todo ano" não tem lugar numa linha do tempo.
      return [
        { anoDaPublicacao: { sort: dir, nulls: 'last' } },
        { mesDaPublicacao: { sort: dir, nulls: 'last' } },
        { diaDaPublicacao: { sort: dir, nulls: 'last' } },
        { id: 'asc' },
      ];
    }
    return [{ status: dir }, { ordem: dir }, { id: 'asc' }];
  }
  if (ordenacao.coluna === 'texto') return [{ conteudo: dir }, { id: 'asc' }];
  if (ordenacao.coluna === 'situacao') return [{ status: dir }, { ordem: 'asc' }, { id: 'asc' }];
  // Sem data ainda? Vai para o fim nos dois sentidos: quem ordena por data de
  // publicação quer ver as publicadas, não uma parede de traços no topo.
  return [{ publicadoEm: { sort: dir, nulls: 'last' } }, { ordem: 'asc' }, { id: 'asc' }];
}

/**
 * Se as alças de arrastar valem nesta tela.
 *
 * Todas as condições precisam valer ao mesmo tempo, e cada uma por um motivo
 * diferente: fora da ordem da fila a posição de soltura não significa nada;
 * com filtro ativo a lista esconde textos, e reordenar o que se vê reescreveria
 * a posição dos escondidos; numa lista por data não há fila; e um texto só,
 * ou nenhum, não tem o que reordenar.
 */
export function podeArrastar(entrada: {
  ordenacao: Ordenacao;
  comFiltro: boolean;
  porData: boolean;
  pendentes: number;
  temPermissao: boolean;
}): boolean {
  return (
    entrada.temPermissao &&
    !entrada.porData &&
    !entrada.comFiltro &&
    entrada.pendentes > 1 &&
    entrada.ordenacao.coluna === 'ordem' &&
    !entrada.ordenacao.descendente
  );
}
