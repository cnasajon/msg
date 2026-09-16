/**
 * Ordenação da lista de textos, e a fronteira com o arrastar.
 *
 * O ponto que mais importa aqui não é a cláusula de ordenação em si: é que
 * arrastar e ordenar por outra coluna não podem valer ao mesmo tempo. Numa lista
 * ordenada por data, soltar uma linha entre outras duas não diz nada sobre a
 * posição na fila, e gravar aquilo como ordem embaralharia a fila sem ninguém
 * pedir.
 */
import { describe, it, expect } from 'vitest';
import {
  ORDEM_DA_FILA,
  lerOrdenacao,
  paraPrisma,
  podeArrastar,
  proximoSentido,
} from '@/lib/ordenacao-da-lista';

describe('o que a URL pede', () => {
  it('sem parâmetro, a ordem da fila', () => {
    expect(lerOrdenacao(undefined, undefined)).toEqual(ORDEM_DA_FILA);
  });

  it('coluna desconhecida cai na ordem da fila, sem quebrar', () => {
    expect(lerOrdenacao('conteudo; DROP TABLE texts', 'desc')).toEqual(ORDEM_DA_FILA);
    expect(lerOrdenacao('texto', 'qualquer-coisa')).toEqual({ coluna: 'texto', descendente: false });
  });

  it('o primeiro clique sobe, o segundo desce, o terceiro sobe de novo', () => {
    let atual = ORDEM_DA_FILA;
    expect(proximoSentido(atual, 'texto')).toBe('asc');

    atual = { coluna: 'texto', descendente: false };
    expect(proximoSentido(atual, 'texto')).toBe('desc');

    atual = { coluna: 'texto', descendente: true };
    expect(proximoSentido(atual, 'texto')).toBe('asc');
  });

  it('mudar de coluna recomeça subindo, mesmo vindo de uma descendente', () => {
    expect(proximoSentido({ coluna: 'texto', descendente: true }, 'situacao')).toBe('asc');
  });
});

describe('a cláusula que vai ao banco', () => {
  it('a ordem da fila separa as situações antes de olhar a posição', () => {
    // Sem isso, um arquivado com ordem 2 apareceria no meio dos pendentes.
    expect(paraPrisma(ORDEM_DA_FILA)[0]).toEqual({ status: 'asc' });
  });

  it('numa lista por data, a primeira coluna é ano, mês e dia', () => {
    const clausula = paraPrisma(ORDEM_DA_FILA, true);
    expect(clausula.slice(0, 3)).toEqual([
      { anoDaPublicacao: { sort: 'asc', nulls: 'last' } },
      { mesDaPublicacao: { sort: 'asc', nulls: 'last' } },
      { diaDaPublicacao: { sort: 'asc', nulls: 'last' } },
    ]);
  });

  it('quem não tem data de publicação vai para o fim nos dois sentidos', () => {
    for (const descendente of [false, true]) {
      expect(paraPrisma({ coluna: 'publicadoEm', descendente })[0]).toEqual({
        publicadoEm: { sort: descendente ? 'desc' : 'asc', nulls: 'last' },
      });
    }
  });

  it('toda ordenação termina desempatando por id', () => {
    // Sem desempate, linhas de mesmo valor trocam de lugar entre um
    // carregamento e outro, e a pessoa clica na linha errada.
    for (const coluna of ['ordem', 'texto', 'situacao', 'publicadoEm'] as const) {
      for (const porData of [false, true]) {
        const clausula = paraPrisma({ coluna, descendente: false }, porData);
        expect(clausula[clausula.length - 1]).toEqual({ id: 'asc' });
      }
    }
  });
});

describe('quando as alças de arrastar valem', () => {
  const base = {
    ordenacao: ORDEM_DA_FILA,
    comFiltro: false,
    porData: false,
    pendentes: 3,
    temPermissao: true,
  };

  it('na ordem da fila, sem filtro, com permissão e mais de um pendente', () => {
    expect(podeArrastar(base)).toBe(true);
  });

  it('NÃO vale ordenado por outra coluna: a posição de soltura não diria nada', () => {
    expect(podeArrastar({ ...base, ordenacao: { coluna: 'texto', descendente: false } })).toBe(false);
    expect(podeArrastar({ ...base, ordenacao: { coluna: 'publicadoEm', descendente: true } })).toBe(false);
  });

  it('NÃO vale nem com a própria coluna invertida', () => {
    // De baixo para cima a lista mostra a fila ao contrário; soltar no topo
    // significaria o fim da fila, que é exatamente o engano a evitar.
    expect(podeArrastar({ ...base, ordenacao: { coluna: 'ordem', descendente: true } })).toBe(false);
  });

  it('NÃO vale com filtro: reordenar o que se vê reescreveria o que está escondido', () => {
    expect(podeArrastar({ ...base, comFiltro: true })).toBe(false);
  });

  it('NÃO vale em lista por data, que não tem fila', () => {
    expect(podeArrastar({ ...base, porData: true })).toBe(false);
  });

  it('NÃO vale sem permissão de reordenar', () => {
    expect(podeArrastar({ ...base, temPermissao: false })).toBe(false);
  });

  it('NÃO vale com um pendente só, nem com nenhum', () => {
    expect(podeArrastar({ ...base, pendentes: 1 })).toBe(false);
    expect(podeArrastar({ ...base, pendentes: 0 })).toBe(false);
  });
});
