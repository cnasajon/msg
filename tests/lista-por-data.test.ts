/**
 * Listas baseadas em data.
 *
 * O padrão diz em quais datas o texto PODE sair; o agendamento da pasta diz em
 * quais dias existe slot. Sem dia da semana marcado não há slot nenhum, e nada é
 * publicado — é o cálculo da agenda que garante isso, e há teste dele à parte.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  analisarPadraoDeData,
  formatarPadraoDeData,
  padraoCasaComAData,
  QUALQUER_DATA,
} from '@/lib/data-da-publicacao';
import { frase } from './helpers/frase';
import { prepararBanco, criarCenario, temBanco, cliente, type Cenario } from './helpers/banco';
import { textoParaAData } from '@/lib/proximo-texto';
import { hashDoConteudo } from '@/lib/textos';

/** Açúcar para os testes: analisa e devolve o padrão, ou explode. */
function padrao(bruto: string) {
  const analise = analisarPadraoDeData(bruto);
  if ('problema' in analise) throw new Error(`não deveria recusar: ${bruto}`);
  return analise.padrao;
}

describe('padrão de data', () => {
  it('lê as três partes, com * valendo para todos', () => {
    expect(padrao('25/12/2026')).toEqual({ dia: 25, mes: 12, ano: 2026 });
    expect(padrao('*/09/*')).toEqual({ dia: null, mes: 9, ano: null });
    expect(padrao('01/*/*')).toEqual({ dia: 1, mes: null, ano: null });
  });

  it('campo vazio e * sozinho são qualquer data', () => {
    expect(padrao('')).toEqual(QUALQUER_DATA);
    expect(padrao('   ')).toEqual(QUALQUER_DATA);
    expect(padrao('*')).toEqual(QUALQUER_DATA);
  });

  it('volta para a tela no mesmo formato que se digita', () => {
    expect(formatarPadraoDeData(padrao('25/12/2026'))).toBe('25/12/2026');
    expect(formatarPadraoDeData(padrao('*/09/*'))).toBe('*/09/*');
    expect(formatarPadraoDeData(QUALQUER_DATA)).toBe('*/*/*');
    // o que se digita sem zero à esquerda volta com ele
    expect(formatarPadraoDeData(padrao('1/9/2026'))).toBe('01/09/2026');
  });

  it('recusa o que não é data', () => {
    for (const ruim of ['25-12-2026', '25/12', 'ontem', '25/12/2026/1', '25//2026']) {
      expect(analisarPadraoDeData(ruim), ruim).toHaveProperty('problema');
    }
  });

  it('recusa mês, dia e ano fora da faixa', () => {
    expect(frase((analisarPadraoDeData('01/13/*') as { problema: never }).problema)).toMatch(/1 a 12/);
    expect(frase((analisarPadraoDeData('32/01/*') as { problema: never }).problema)).toMatch(/1 a 31/);
    expect(frase((analisarPadraoDeData('01/01/1999') as { problema: never }).problema)).toMatch(/2000/);
  });

  it('RECUSA a data que nunca aconteceria, em vez de deixar o texto esperando', () => {
    // 31 de fevereiro não chega nunca: o texto ficaria parado para sempre
    const analise = analisarPadraoDeData('31/02/*');
    expect(analise).toHaveProperty('problema');
    expect(frase((analise as { problema: never }).problema)).toMatch(/não existe no mês/);

    // 29/02 continua valendo: ano bissexto existe
    expect(analisarPadraoDeData('29/02/*')).toHaveProperty('padrao');
  });

  it('casa a data conforme cada parte', () => {
    expect(padraoCasaComAData(padrao('*/09/*'), '2026-09-14')).toBe(true);
    expect(padraoCasaComAData(padrao('*/09/*'), '2026-10-14')).toBe(false);
    expect(padraoCasaComAData(padrao('25/12/*'), '2027-12-25')).toBe(true);
    expect(padraoCasaComAData(padrao('25/12/2026'), '2027-12-25')).toBe(false);
    expect(padraoCasaComAData(QUALQUER_DATA, '2026-01-01')).toBe(true);
  });
});

describe.skipIf(!temBanco)('escolha do texto numa lista por data', () => {
  let cenario: Cenario;

  beforeAll(async () => {
    await prepararBanco();
    cenario = await criarCenario();
  });

  afterAll(async () => {
    await cliente().$disconnect();
  });

  async function pastaPorData(nome: string) {
    return cliente().folder.create({
      data: {
        organizationId: cenario.a.organizacao.id,
        nome,
        timezone: 'America/Sao_Paulo',
        telegramChatId: '-1001111111111',
        tipoDeLista: 'data',
      },
    });
  }

  async function texto(
    folderId: string,
    conteudo: string,
    data: { dia?: number | null; mes?: number | null; ano?: number | null },
    extras: { ordem?: number; status?: 'pendente' | 'publicado' | 'arquivado'; publicadoEm?: Date } = {},
  ) {
    return cliente().text.create({
      data: {
        folderId,
        conteudo,
        ordem: extras.ordem ?? 1,
        hashConteudo: hashDoConteudo(conteudo),
        status: extras.status ?? 'pendente',
        publicadoEm: extras.publicadoEm ?? null,
        diaDaPublicacao: data.dia ?? null,
        mesDaPublicacao: data.mes ?? null,
        anoDaPublicacao: data.ano ?? null,
      },
    });
  }

  it('escolhe o texto cuja data casa com o dia do slot', async () => {
    const pasta = await pastaPorData('Datas comemorativas');
    await texto(pasta.id, 'Feliz Natal', { dia: 25, mes: 12 });
    await texto(pasta.id, 'Feliz Ano Novo', { dia: 1, mes: 1 });

    await expect(textoParaAData(cliente(), pasta.id, '2026-12-25')).resolves.toMatchObject({
      conteudo: 'Feliz Natal',
    });
    await expect(textoParaAData(cliente(), pasta.id, '2027-01-01')).resolves.toMatchObject({
      conteudo: 'Feliz Ano Novo',
    });
    await expect(textoParaAData(cliente(), pasta.id, '2026-07-04')).resolves.toBeNull();
  });

  it('REPETE o texto já publicado: numa lista por data ele sai sempre que a data casar', async () => {
    const pasta = await pastaPorData('Mês inteiro');
    await texto(
      pasta.id,
      'Mensagem de setembro',
      { mes: 9 },
      { status: 'publicado', publicadoEm: new Date('2026-09-01T10:00:00Z') },
    );

    // já saiu no dia 1 e continua elegível no dia 2 — é o que "todos os dias de
    // setembro" quer dizer. Na fila, `publicado` tiraria o texto do caminho.
    await expect(textoParaAData(cliente(), pasta.id, '2026-09-02')).resolves.toMatchObject({
      conteudo: 'Mensagem de setembro',
    });
  });

  it('arquivado não sai, mesmo com a data casando', async () => {
    const pasta = await pastaPorData('Com arquivado');
    await texto(pasta.id, 'Arquivado de setembro', { mes: 9 }, { status: 'arquivado' });

    await expect(textoParaAData(cliente(), pasta.id, '2026-09-10')).resolves.toBeNull();
  });

  it('com vários para o mesmo dia, reveza: sai quem está há mais tempo sem sair', async () => {
    const pasta = await pastaPorData('Vários no mesmo dia');
    const nunca = await texto(pasta.id, 'Nunca saiu', { mes: 9 }, { ordem: 3 });
    await texto(
      pasta.id,
      'Saiu ontem',
      { mes: 9 },
      { ordem: 1, status: 'publicado', publicadoEm: new Date('2026-09-13T10:00:00Z') },
    );
    await texto(
      pasta.id,
      'Saiu semana passada',
      { mes: 9 },
      { ordem: 2, status: 'publicado', publicadoEm: new Date('2026-09-07T10:00:00Z') },
    );

    // quem nunca saiu vem primeiro, mesmo sendo o último da ordem
    const primeiro = await textoParaAData(cliente(), pasta.id, '2026-09-14');
    expect(primeiro?.conteudo).toBe('Nunca saiu');

    // depois que ele sai, a vez é de quem está parado há mais tempo
    await cliente().text.update({
      where: { id: nunca.id },
      data: { status: 'publicado', publicadoEm: new Date('2026-09-14T10:00:00Z') },
    });
    const segundo = await textoParaAData(cliente(), pasta.id, '2026-09-15');
    expect(segundo?.conteudo).toBe('Saiu semana passada');
  });

  it('o ano fixo impede a repetição no ano seguinte', async () => {
    const pasta = await pastaPorData('Só uma vez');
    await texto(pasta.id, 'Centenário', { dia: 1, mes: 1, ano: 2027 });

    await expect(textoParaAData(cliente(), pasta.id, '2027-01-01')).resolves.toMatchObject({
      conteudo: 'Centenário',
    });
    await expect(textoParaAData(cliente(), pasta.id, '2028-01-01')).resolves.toBeNull();
  });
});
