/**
 * Ações a partir das linhas escolhidas na lista de textos.
 *
 * Duas coisas precisam ser verdade. A primeira é o ponto não negociável nº 1: os
 * identificadores chegam do navegador, então o lote inteiro precisa passar pelo
 * escopo — um id de outra organização enfiado no formulário não pode arquivar,
 * excluir nem exportar coisa nenhuma, e nem sequer parcialmente. A segunda é que
 * incluir um texto "abaixo da linha atual" abre espaço de verdade na fila, sem
 * empatar a ordem com quem já estava lá.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prepararBanco, criarCenario, sessaoDe, temBanco, cliente, type Cenario } from './helpers/banco';
import { abrirEspacoDepoisDe, escolhidosNaLista } from '@/lib/selecao';

describe.skipIf(!temBanco)('seleção na lista de textos', () => {
  let cenario: Cenario;

  beforeAll(async () => {
    await prepararBanco();
    cenario = await criarCenario();
  });

  afterAll(async () => {
    await cliente().$disconnect();
  });

  /** Textos extras na pasta de A, em sequência a partir da ordem indicada. */
  async function encher(quantos: number, aPartirDe: number) {
    const criados = [];
    for (let i = 0; i < quantos; i++) {
      criados.push(
        await cliente().text.create({
          data: {
            folderId: cenario.a.pasta.id,
            conteudo: `Fila ${randomUUID()}`,
            ordem: aPartirDe + i,
            hashConteudo: randomUUID(),
          },
        }),
      );
    }
    return criados;
  }

  it('devolve os escolhidos quando todos estão no escopo', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    const ids = await escolhidosNaLista(cliente(), sessao, cenario.a.pasta.id, [cenario.a.texto.id]);
    expect(ids).toEqual([cenario.a.texto.id]);
  });

  it('RECUSA o lote inteiro se um único id for de outra organização', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    const ids = await escolhidosNaLista(cliente(), sessao, cenario.a.pasta.id, [
      cenario.a.texto.id,
      cenario.b.texto.id,
    ]);
    // Não é "devolve só o de A": tudo ou nada, para não arquivar parte do que a
    // pessoa escolheu sem dizer qual ficou de fora.
    expect(ids).toBeNull();
  });

  it('RECUSA id de texto que existe, mas está em outra pasta', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    const deOutraPasta = await cliente().text.create({
      data: {
        folderId: cenario.a.pastaSemAtribuicao.id,
        conteudo: `Vizinha ${randomUUID()}`,
        ordem: 1,
        hashConteudo: randomUUID(),
      },
    });
    const ids = await escolhidosNaLista(cliente(), sessao, cenario.a.pasta.id, [
      cenario.a.texto.id,
      deOutraPasta.id,
    ]);
    expect(ids).toBeNull();
  });

  it('o usuário só alcança os textos das pastas atribuídas a ele', async () => {
    const semAtribuicao = sessaoDe(cenario.a.usuario, { pastasAtribuidas: [] });
    expect(
      await escolhidosNaLista(cliente(), semAtribuicao, cenario.a.pasta.id, [cenario.a.texto.id]),
    ).toBeNull();

    const comAtribuicao = sessaoDe(cenario.a.usuario, { pastasAtribuidas: [cenario.a.pasta.id] });
    expect(
      await escolhidosNaLista(cliente(), comAtribuicao, cenario.a.pasta.id, [cenario.a.texto.id]),
    ).toEqual([cenario.a.texto.id]);
  });

  it('lista vazia devolve null, e id repetido conta uma vez só', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    expect(await escolhidosNaLista(cliente(), sessao, cenario.a.pasta.id, [])).toBeNull();
    expect(await escolhidosNaLista(cliente(), sessao, cenario.a.pasta.id, ['', '  '])).toBeNull();
    expect(
      await escolhidosNaLista(cliente(), sessao, cenario.a.pasta.id, [
        cenario.a.texto.id,
        cenario.a.texto.id,
      ]),
    ).toEqual([cenario.a.texto.id]);
  });

  it('abre espaço depois do texto escolhido e empurra só quem vem depois', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    const criados = await encher(3, 100);
    const [primeiro, segundo, terceiro] = criados as [
      (typeof criados)[number],
      (typeof criados)[number],
      (typeof criados)[number],
    ];

    const posicao = await abrirEspacoDepoisDe(cliente(), sessao, cenario.a.pasta.id, segundo.id);
    expect(posicao).toBe(segundo.ordem + 1);

    const depois = await cliente().text.findMany({
      where: { id: { in: [primeiro.id, segundo.id, terceiro.id] } },
      select: { id: true, ordem: true },
    });
    const ordemDe = new Map(depois.map((t) => [t.id, t.ordem]));
    // Quem estava antes e o próprio ficam onde estavam; quem vinha depois anda.
    expect(ordemDe.get(primeiro.id)).toBe(primeiro.ordem);
    expect(ordemDe.get(segundo.id)).toBe(segundo.ordem);
    expect(ordemDe.get(terceiro.id)).toBe(terceiro.ordem + 1);
    // E a posição devolvida está de fato livre.
    const ocupando = await cliente().text.count({
      where: { folderId: cenario.a.pasta.id, ordem: posicao! },
    });
    expect(ocupando).toBe(0);
  });

  it('RECUSA abrir espaço a partir de texto de outra organização, e não move nada', async () => {
    const sessao = sessaoDe(cenario.a.admin);
    const antes = await cliente().text.findMany({
      where: { folderId: cenario.b.pasta.id },
      select: { id: true, ordem: true },
      orderBy: { ordem: 'asc' },
    });

    const posicao = await abrirEspacoDepoisDe(cliente(), sessao, cenario.b.pasta.id, cenario.b.texto.id);
    expect(posicao).toBeNull();

    const depois = await cliente().text.findMany({
      where: { folderId: cenario.b.pasta.id },
      select: { id: true, ordem: true },
      orderBy: { ordem: 'asc' },
    });
    expect(depois).toEqual(antes);
  });
});
