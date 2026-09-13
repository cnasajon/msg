/**
 * Mover textos entre pastas.
 *
 * Duas coisas precisam ser verdade: a pasta de destino passa pelo escopo, de
 * modo que ninguém arrasta um texto para dentro de outra organização nem para
 * fora da sua; e o índice único `(pasta, conteúdo)` não derruba o lote quando o
 * destino já tem um texto idêntico.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prepararBanco, criarCenario, sessaoDe, temBanco, cliente, type Cenario } from './helpers/banco';
import { NaoEncontrado } from '@/lib/erros';
import { hashDoConteudo } from '@/lib/textos';
import { moverTextosParaPasta } from '@/lib/mover';

/** A mesma função que a ação de servidor chama — sem o formulário em volta. */
function mover(
  sessao: ReturnType<typeof sessaoDe>,
  origemId: string,
  destinoId: string,
  ids: string[],
) {
  return moverTextosParaPasta(cliente(), sessao, { origemId, destinoId, ids });
}

describe.skipIf(!temBanco)('mover textos entre pastas', () => {
  let cenario: Cenario;

  beforeAll(async () => {
    await prepararBanco();
    cenario = await criarCenario();
  });

  afterAll(async () => {
    await cliente().$disconnect();
  });

  it('RECUSA a pasta de outra organização como destino', async () => {
    const sessao = sessaoDe(cenario.a.admin);

    await expect(mover(sessao, cenario.a.pasta.id, cenario.b.pasta.id, [cenario.a.texto.id]))
      .rejects.toThrow(NaoEncontrado);

    // e o texto continua exatamente onde estava
    const intacto = await cliente().text.findUniqueOrThrow({ where: { id: cenario.a.texto.id } });
    expect(intacto.folderId).toBe(cenario.a.pasta.id);
  });

  it('não arrasta texto de outra organização para dentro da sua', async () => {
    const db = cliente();
    const sessao = sessaoDe(cenario.a.admin);

    const segunda = await db.folder.create({
      data: {
        organizationId: cenario.a.organizacao.id,
        nome: 'Segunda pasta de A',
        timezone: 'America/Sao_Paulo',
        telegramChatId: '-1009999999999',
      },
    });

    // o id de um texto de B, injetado na lista, simplesmente não sobrevive ao filtro
    const resultado = await mover(sessao, cenario.b.pasta.id, segunda.id, [cenario.b.texto.id]);
    expect(resultado.movidos).toBe(0);

    const intacto = await db.text.findUniqueOrThrow({ where: { id: cenario.b.texto.id } });
    expect(intacto.folderId).toBe(cenario.b.pasta.id);
  });

  it('move para o fim da fila do destino, preservando a ordem relativa', async () => {
    const db = cliente();
    const sessao = sessaoDe(cenario.a.admin);

    const origem = await db.folder.create({
      data: {
        organizationId: cenario.a.organizacao.id,
        nome: 'Origem',
        timezone: 'America/Sao_Paulo',
        telegramChatId: '-1008888888888',
      },
    });
    const destino = await db.folder.create({
      data: {
        organizationId: cenario.a.organizacao.id,
        nome: 'Destino',
        timezone: 'America/Sao_Paulo',
        telegramChatId: '-1007777777777',
      },
    });

    await db.text.create({
      data: {
        folderId: destino.id,
        conteudo: 'Já estava no destino',
        ordem: 1,
        hashConteudo: hashDoConteudo('Já estava no destino'),
      },
    });
    const primeiro = await db.text.create({
      data: {
        folderId: origem.id,
        conteudo: 'Primeiro da origem',
        ordem: 1,
        hashConteudo: hashDoConteudo('Primeiro da origem'),
      },
    });
    const segundo = await db.text.create({
      data: {
        folderId: origem.id,
        conteudo: 'Segundo da origem',
        ordem: 2,
        hashConteudo: hashDoConteudo('Segundo da origem'),
      },
    });

    const resultado = await mover(sessao, origem.id, destino.id, [primeiro.id, segundo.id]);
    expect(resultado).toMatchObject({ movidos: 2, pulados: 0 });

    const fila = await db.text.findMany({
      where: { folderId: destino.id },
      orderBy: { ordem: 'asc' },
      select: { conteudo: true },
    });
    expect(fila.map((t) => t.conteudo)).toEqual([
      'Já estava no destino',
      'Primeiro da origem',
      'Segundo da origem',
    ]);
  });

  it('PULA o texto que o destino já tem, em vez de derrubar o lote inteiro', async () => {
    const db = cliente();
    const sessao = sessaoDe(cenario.a.admin);
    const repetido = 'Exatamente o mesmo conteúdo';

    const origem = await db.folder.create({
      data: {
        organizationId: cenario.a.organizacao.id,
        nome: 'Origem com repetido',
        timezone: 'America/Sao_Paulo',
        telegramChatId: '-1006666666666',
      },
    });
    const destino = await db.folder.create({
      data: {
        organizationId: cenario.a.organizacao.id,
        nome: 'Destino com repetido',
        timezone: 'America/Sao_Paulo',
        telegramChatId: '-1005555555555',
      },
    });

    await db.text.create({
      data: {
        folderId: destino.id,
        conteudo: repetido,
        ordem: 1,
        hashConteudo: hashDoConteudo(repetido),
      },
    });
    const igual = await db.text.create({
      data: {
        folderId: origem.id,
        conteudo: repetido,
        ordem: 1,
        hashConteudo: hashDoConteudo(repetido),
      },
    });
    const diferente = await db.text.create({
      data: {
        folderId: origem.id,
        conteudo: 'Este é diferente',
        ordem: 2,
        hashConteudo: hashDoConteudo('Este é diferente'),
      },
    });

    const resultado = await mover(sessao, origem.id, destino.id, [igual.id, diferente.id]);
    expect(resultado).toMatchObject({ movidos: 1, pulados: 1 });

    // o diferente foi; o repetido ficou onde estava, e nada foi sobrescrito
    await expect(
      db.text.findUniqueOrThrow({ where: { id: diferente.id } }),
    ).resolves.toMatchObject({ folderId: destino.id });
    await expect(db.text.findUniqueOrThrow({ where: { id: igual.id } })).resolves.toMatchObject({
      folderId: origem.id,
    });
  });
});
