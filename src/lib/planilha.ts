import Papa from 'papaparse';
import ExcelJS from 'exceljs';

/**
 * Leitura de CSV e XLSX para a importação.
 *
 * Sobre a escolha da biblioteca de XLSX: a especificação cita SheetJS, mas a
 * versão publicada no npm está parada em 0.18.5, com vulnerabilidades
 * conhecidas — as versões novas saíram do registro público. `exceljs` é mantido
 * no npm, lê e escreve o que precisamos, e é o que está em uso aqui.
 */

export type Planilha = { colunas: string[]; linhas: string[][] };

export class PlanilhaInvalida extends Error {}

const LIMITE_DE_LINHAS = 5000;

export async function lerPlanilha(arquivo: File): Promise<Planilha> {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith('.csv') || nome.endsWith('.txt')) return lerCsv(await arquivo.text());
  if (nome.endsWith('.xlsx') || nome.endsWith('.xlsm')) return lerXlsx(await arquivo.arrayBuffer());
  throw new PlanilhaInvalida('Formato não reconhecido. Envie um arquivo .csv ou .xlsx.');
}

function lerCsv(texto: string): Planilha {
  // o delimitador vem da detecção do Papa: planilha brasileira costuma sair
  // com ponto e vírgula, e obrigar a pessoa a saber disso seria hostil
  const resultado = Papa.parse<string[]>(texto.replace(/^﻿/, ''), {
    skipEmptyLines: 'greedy',
  });
  if (resultado.data.length === 0) throw new PlanilhaInvalida('O arquivo está vazio.');

  const linhas = resultado.data.slice(0, LIMITE_DE_LINHAS).map((l) => l.map((c) => String(c ?? '')));
  const largura = Math.max(...linhas.map((l) => l.length));
  return {
    colunas: rotulosDeColuna(largura),
    linhas: linhas.map((l) => preencher(l, largura)),
  };
}

async function lerXlsx(dados: ArrayBuffer): Promise<Planilha> {
  const pasta = new ExcelJS.Workbook();
  try {
    await pasta.xlsx.load(dados);
  } catch {
    throw new PlanilhaInvalida('Não foi possível ler o arquivo .xlsx.');
  }
  const aba = pasta.worksheets[0];
  if (!aba) throw new PlanilhaInvalida('A planilha não tem nenhuma aba.');

  const linhas: string[][] = [];
  aba.eachRow({ includeEmpty: false }, (linha) => {
    if (linhas.length >= LIMITE_DE_LINHAS) return;
    const valores: string[] = [];
    linha.eachCell({ includeEmpty: true }, (celula, indice) => {
      valores[indice - 1] = celulaComoTexto(celula.value);
    });
    linhas.push([...valores].map((v) => v ?? ''));
  });
  if (linhas.length === 0) throw new PlanilhaInvalida('A planilha está vazia.');

  const largura = Math.max(...linhas.map((l) => l.length));
  return { colunas: rotulosDeColuna(largura), linhas: linhas.map((l) => preencher(l, largura)) };
}

function celulaComoTexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') {
    if ('text' in valor && typeof valor.text === 'string') return valor.text;
    if ('richText' in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((p) => p.text).join('');
    }
    if ('result' in valor) return String(valor.result ?? '');
    if ('hyperlink' in valor) return String(valor.hyperlink ?? '');
  }
  return String(valor);
}

function preencher(linha: string[], largura: number): string[] {
  return Array.from({ length: largura }, (_, i) => (linha[i] ?? '').trim());
}

/** A, B, C … como no cabeçalho de uma planilha. */
function rotulosDeColuna(quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, i) => {
    let n = i;
    let rotulo = '';
    do {
      rotulo = String.fromCharCode(65 + (n % 26)) + rotulo;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return rotulo;
  });
}

/**
 * Datas da planilha, aceitando o que as pessoas realmente digitam:
 * `31/12/2026`, `2026-12-31`, `31/12/2026 07:00` e o ISO que o Excel devolve.
 * Ambíguo entre dia e mês, vale o formato brasileiro — é de onde vêm os
 * arquivos.
 */
export function interpretarData(valor: string): Date | null {
  const texto = valor.trim();
  if (!texto) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(texto);
  if (iso) {
    const [, ano, mes, dia, hora = '12', minuto = '00'] = iso;
    return montar(+ano!, +mes!, +dia!, +hora, +minuto);
  }

  const brasileiro = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ ](\d{1,2}):(\d{2}))?$/.exec(texto);
  if (brasileiro) {
    const [, dia, mes, anoBruto, hora = '12', minuto = '00'] = brasileiro;
    const ano = anoBruto!.length === 2 ? 2000 + Number(anoBruto) : Number(anoBruto);
    return montar(ano, +mes!, +dia!, +hora, +minuto);
  }
  return null;
}

function montar(ano: number, mes: number, dia: number, hora: number, minuto: number): Date | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const data = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto));
  if (Number.isNaN(data.getTime())) return null;
  if (data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  return data;
}
