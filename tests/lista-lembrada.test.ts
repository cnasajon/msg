/**
 * A lista de textos volta como estava: mesma pasta, mesma situação.
 *
 * Duas coisas precisam ser verdade. A preferência tem de sobreviver ao logout —
 * é por isso que vive no usuário, e não na sessão. E ela não pode virar uma
 * segunda porta de entrada para dado de outra organização: a pasta lembrada é
 * procurada **dentro** do que o escopo já devolveu, nunca consultada por conta
 * própria.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prepararBanco, criarCenario, temBanco, cliente, type Cenario } from './helpers/banco';
import { lembrarLista, listaLembrada, pastaDaVez, NADA_LEMBRADO } from '@/lib/lista-lembrada';

describe('qual pasta a lista abre', () => {
  const noEscopo = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('a URL manda quando a pasta está no escopo', () => {
    expect(pastaDaVez(noEscopo, 'c', 'b')).toEqual({ id: 'c' });
  });

  it('sem URL, vale a pasta da última visita', () => {
    expect(pastaDaVez(noEscopo, undefined, 'b')).toEqual({ id: 'b' });
  });

  it('sem URL e sem nada lembrado, a primeira do escopo', () => {
    expect(pastaDaVez(noEscopo, undefined, null)).toEqual({ id: 'a' });
  });

  it('PASTA DE FORA DO ESCOPO não abre, nem pela URL nem pela memória', () => {
    // O id existe no banco, mas não na lista que o escopo devolveu: é o caso de
    // quem troca o identificador na URL e o de quem foi tirado de uma
    // organização depois de ter escolhido uma pasta dela.
    expect(pastaDaVez(noEscopo, 'de-outra-organizacao', null)).toEqual({ id: 'a' });
    expect(pastaDaVez(noEscopo, undefined, 'de-outra-organizacao')).toEqual({ id: 'a' });
    expect(pastaDaVez(noEscopo, 'de-outra-organizacao', 'tambem-de-fora')).toEqual({ id: 'a' });
  });

  it('sem nenhuma pasta no escopo, não inventa uma', () => {
    expect(pastaDaVez([], 'a', 'b')).toBeNull();
  });
});

describe.skipIf(!temBanco)('a preferência guardada no usuário', () => {
  let cenario: Cenario;

  beforeAll(async () => {
    await prepararBanco();
    cenario = await criarCenario();
  });

  afterAll(async () => {
    await cliente().$disconnect();
  });

  it('quem nunca escolheu nada começa em todas as situações', async () => {
    expect(await listaLembrada(cenario.a.admin.id)).toEqual(NADA_LEMBRADO);
  });

  it('grava a escolha e devolve a mesma na visita seguinte', async () => {
    await lembrarLista(cenario.a.admin.id, NADA_LEMBRADO, {
      pastaId: cenario.a.pasta.id,
      status: 'publicado',
    });
    expect(await listaLembrada(cenario.a.admin.id)).toEqual({
      pastaId: cenario.a.pasta.id,
      status: 'publicado',
    });
  });

  it('"todas as situações" volta como todas as situações', async () => {
    // No banco isso é nulo, que é também o estado de quem nunca escolheu — os
    // dois casos abrem a tela do mesmo jeito, que é o padrão dela.
    const antes = await listaLembrada(cenario.a.admin.id);
    await lembrarLista(cenario.a.admin.id, antes, { pastaId: cenario.a.pasta.id, status: '' });

    const guardado = await cliente().user.findUniqueOrThrow({
      where: { id: cenario.a.admin.id },
      select: { ultimoStatusDeTexto: true },
    });
    expect(guardado.ultimoStatusDeTexto).toBeNull();
    expect((await listaLembrada(cenario.a.admin.id)).status).toBe('');
  });

  it('NÃO escreve quando a escolha não mudou', async () => {
    const mesma = { pastaId: cenario.a.pasta.id, status: 'erro' as const };
    await lembrarLista(cenario.a.admin.id, NADA_LEMBRADO, mesma);

    // Mexe no registro por fora e repete a chamada dizendo que nada mudou: se
    // ela escrevesse mesmo assim, a marca sumiria. Sem esta guarda, toda
    // abertura da lista faria um UPDATE.
    await cliente().user.update({
      where: { id: cenario.a.admin.id },
      data: { ultimaPastaId: null },
    });
    await lembrarLista(cenario.a.admin.id, mesma, mesma);

    const depois = await cliente().user.findUniqueOrThrow({
      where: { id: cenario.a.admin.id },
      select: { ultimaPastaId: true },
    });
    expect(depois.ultimaPastaId).toBeNull();
  });

  it('apagar a pasta lembrada não impede de abrir a lista', async () => {
    const descartavel = await cliente().folder.create({
      data: {
        organizationId: cenario.a.organizacao.id,
        nome: `Descartável ${randomUUID().slice(0, 8)}`,
        timezone: 'America/Sao_Paulo',
      },
    });
    await lembrarLista(cenario.a.usuario.id, NADA_LEMBRADO, {
      pastaId: descartavel.id,
      status: 'pendente',
    });

    await cliente().folder.delete({ where: { id: descartavel.id } });

    // `ON DELETE SET NULL`: a referência some, o usuário fica de pé, e a lista
    // volta a abrir na primeira pasta.
    expect(await listaLembrada(cenario.a.usuario.id)).toEqual({
      pastaId: null,
      status: 'pendente',
    });
  });

  it('a preferência é de cada pessoa, não do sistema', async () => {
    await lembrarLista(cenario.b.admin.id, NADA_LEMBRADO, {
      pastaId: cenario.b.pasta.id,
      status: 'arquivado',
    });
    const deA = await listaLembrada(cenario.a.admin.id);
    expect(deA.pastaId).not.toBe(cenario.b.pasta.id);
  });
});
