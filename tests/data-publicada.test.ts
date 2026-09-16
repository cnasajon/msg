/**
 * Informar ou limpar a data em que o texto foi publicado.
 *
 * Duas coisas precisam ser verdade. A data é lida no fuso da pasta, e não no do
 * servidor nem no do navegador — errar isso desloca a publicação em horas sem
 * ninguém perceber. E limpar a data pode apagar a marcação retroativa, mas nunca
 * uma publicação que de fato saiu: o histórico sobreviver à edição é ponto não
 * negociável.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prepararBanco, criarCenario, temBanco, cliente, type Cenario } from './helpers/banco';
import {
  ajustarDataDePublicacao,
  campoDoInstante,
  diaNoFuso,
  instanteDoCampo,
} from '@/lib/data-publicada';

describe('o campo de data e hora fala o fuso da pasta', () => {
  it('“1º de março às 09:00 em São Paulo” é 12:00 UTC', () => {
    const quando = instanteDoCampo('2026-03-01T09:00', 'America/Sao_Paulo');
    expect(quando?.toISOString()).toBe('2026-03-01T12:00:00.000Z');
  });

  it('a mesma hora em Madri dá outro instante', () => {
    const quando = instanteDoCampo('2026-03-01T09:00', 'Europe/Madrid');
    expect(quando?.toISOString()).toBe('2026-03-01T08:00:00.000Z');
  });

  it('ida e volta devolvem o que foi digitado', () => {
    for (const fuso of ['America/Sao_Paulo', 'Europe/Madrid', 'UTC']) {
      for (const valor of ['2026-03-01T09:00', '2026-07-15T23:45', '2026-01-01T00:00']) {
        const instante = instanteDoCampo(valor, fuso)!;
        expect(campoDoInstante(instante, fuso)).toBe(valor);
      }
    }
  });

  it('recusa o que não é data, em vez de inventar uma', () => {
    expect(instanteDoCampo('', 'UTC')).toBeNull();
    expect(instanteDoCampo('ontem', 'UTC')).toBeNull();
    expect(instanteDoCampo('2026-03-01', 'UTC')).toBeNull();
  });
});

describe('o dia do histórico é o dia da pasta, não o do UTC', () => {
  it('21h em São Paulo ainda é o mesmo dia, embora já seja amanhã em UTC', () => {
    // 2026-03-01T21:00 em São Paulo é 2026-03-02T00:00Z. Sem a conversão, o
    // histórico mostraria a publicação um dia à frente.
    const instante = new Date('2026-03-02T00:00:00Z');
    expect(diaNoFuso(instante, 'America/Sao_Paulo').toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(diaNoFuso(instante, 'UTC').toISOString()).toBe('2026-03-02T00:00:00.000Z');
  });
});

describe.skipIf(!temBanco)('marcar e desmarcar como publicado', () => {
  /** O fuso da pasta do cenário A. */
  const FUSO = 'America/Sao_Paulo';
  let cenario: Cenario;

  beforeAll(async () => {
    await prepararBanco();
    cenario = await criarCenario();
  });

  afterAll(async () => {
    await cliente().$disconnect();
  });

  async function textoNovo(conteudo = `Texto ${randomUUID()}`) {
    return cliente().text.create({
      data: {
        folderId: cenario.a.pasta.id,
        conteudo,
        ordem: 1,
        hashConteudo: randomUUID(),
      },
    });
  }

  it('informar a data marca como publicado e deixa registro no histórico', async () => {
    const texto = await textoNovo();
    const quando = new Date('2026-03-01T12:00:00Z');

    const resultado = await ajustarDataDePublicacao(cliente(), texto.id, quando, FUSO);
    expect(resultado.situacao).toBe('publicado');

    const depois = await cliente().text.findUniqueOrThrow({ where: { id: texto.id } });
    expect(depois.status).toBe('publicado');
    expect(depois.publicadoEm?.toISOString()).toBe(quando.toISOString());

    const publicacoes = await cliente().publication.findMany({ where: { textId: texto.id } });
    expect(publicacoes).toHaveLength(1);
    expect(publicacoes[0]!.origem).toBe('retroativa');
    // Sem hora prevista: assim não disputa slot com o dispatcher, como já
    // acontece com o histórico importado.
    expect(publicacoes[0]!.horaPrevista).toBeNull();
    expect(publicacoes[0]!.conteudoPublicado).toBe(texto.conteudo);
  });

  it('remarcar não acumula linhas de histórico', async () => {
    const texto = await textoNovo();
    await ajustarDataDePublicacao(cliente(), texto.id, new Date('2026-03-01T12:00:00Z'), FUSO);
    await ajustarDataDePublicacao(cliente(), texto.id, new Date('2026-04-02T12:00:00Z'), FUSO);

    const publicacoes = await cliente().publication.findMany({ where: { textId: texto.id } });
    expect(publicacoes).toHaveLength(1);
    // `data_prevista` é coluna DATE: guarda o dia, não o instante.
    expect(publicacoes[0]!.dataPrevista.toISOString()).toBe('2026-04-02T00:00:00.000Z');
  });

  it('limpar a data devolve o texto ao FIM da fila', async () => {
    const texto = await textoNovo();
    await ajustarDataDePublicacao(cliente(), texto.id, new Date('2026-03-01T12:00:00Z'), FUSO);

    const ultimo = await cliente().text.findFirst({
      where: { folderId: cenario.a.pasta.id },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });

    const resultado = await ajustarDataDePublicacao(cliente(), texto.id, null, FUSO);
    expect(resultado).toEqual({ situacao: 'pendente', posicao: ultimo!.ordem + 1 });

    const depois = await cliente().text.findUniqueOrThrow({ where: { id: texto.id } });
    expect(depois.status).toBe('pendente');
    expect(depois.publicadoEm).toBeNull();
    expect(depois.ordem).toBe(ultimo!.ordem + 1);
  });

  it('limpar apaga a marcação retroativa', async () => {
    const texto = await textoNovo();
    await ajustarDataDePublicacao(cliente(), texto.id, new Date('2026-03-01T12:00:00Z'), FUSO);
    await ajustarDataDePublicacao(cliente(), texto.id, null, FUSO);

    expect(await cliente().publication.count({ where: { textId: texto.id } })).toBe(0);
  });

  it('limpar NÃO apaga uma publicação que de fato saiu', async () => {
    const texto = await textoNovo();
    // O que o dispatcher gravou ao enviar de verdade.
    const real = await cliente().publication.create({
      data: {
        folderId: cenario.a.pasta.id,
        textId: texto.id,
        origem: 'dispatcher',
        dataPrevista: new Date('2026-02-10T00:00:00Z'),
        horaPrevista: new Date('1970-01-01T07:00:00Z'),
        status: 'enviada',
        conteudoPublicado: texto.conteudo,
      },
    });

    await ajustarDataDePublicacao(cliente(), texto.id, new Date('2026-03-01T12:00:00Z'), FUSO);
    await ajustarDataDePublicacao(cliente(), texto.id, null, FUSO);

    const sobrou = await cliente().publication.findMany({ where: { textId: texto.id } });
    expect(sobrou).toHaveLength(1);
    expect(sobrou[0]!.id).toBe(real.id);
    expect(sobrou[0]!.origem).toBe('dispatcher');
  });

  it('marcar um texto arquivado o tira do arquivo, sem deixar as duas marcas', async () => {
    const texto = await textoNovo();
    await cliente().text.update({
      where: { id: texto.id },
      data: { status: 'arquivado', arquivadoEm: new Date() },
    });

    await ajustarDataDePublicacao(cliente(), texto.id, new Date('2026-03-01T12:00:00Z'), FUSO);
    const depois = await cliente().text.findUniqueOrThrow({ where: { id: texto.id } });
    expect(depois.status).toBe('publicado');
    expect(depois.arquivadoEm).toBeNull();
  });

  it('marcar limpa o erro da tentativa anterior', async () => {
    const texto = await textoNovo();
    await cliente().text.update({
      where: { id: texto.id },
      data: { status: 'erro', erroMensagem: 'chat not found' },
    });

    await ajustarDataDePublicacao(cliente(), texto.id, new Date('2026-03-01T12:00:00Z'), FUSO);
    const depois = await cliente().text.findUniqueOrThrow({ where: { id: texto.id } });
    expect(depois.status).toBe('publicado');
    expect(depois.erroMensagem).toBeNull();
  });
});
