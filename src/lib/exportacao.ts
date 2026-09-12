import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import Papa from 'papaparse';
import { formatarNoFuso } from './fuso';
import { resumir } from './textos';

/**
 * Exportacao dos textos em PDF, XLSX, CSV, JSON e XML.
 *
 * O conjunto exportado e sempre o que a consulta ja filtrou pelo escopo do
 * usuario - quem enxerga duas pastas exporta duas pastas. Esta camada so
 * formata.
 */

export type FormatoDeExportacao = 'pdf' | 'xlsx' | 'csv' | 'json' | 'xml';

export const FORMATOS: { valor: FormatoDeExportacao; rotulo: string; extensao: string; mime: string }[] = [
  { valor: 'pdf', rotulo: 'PDF', extensao: 'pdf', mime: 'application/pdf' },
  {
    valor: 'xlsx',
    rotulo: 'XLSX',
    extensao: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  { valor: 'csv', rotulo: 'CSV', extensao: 'csv', mime: 'text/csv; charset=utf-8' },
  { valor: 'json', rotulo: 'JSON', extensao: 'json', mime: 'application/json; charset=utf-8' },
  { valor: 'xml', rotulo: 'XML', extensao: 'xml', mime: 'application/xml; charset=utf-8' },
];

export type TextoExportado = {
  ordem: number | null;
  conteudo: string;
  situacao: string;
  publicadoEm: Date | null;
  arquivadoEm: Date | null;
  temImagem: boolean;
  caracteres: number;
  criadoEm: Date;
};

export type ContextoDaExportacao = {
  organizacao: string;
  pasta: string;
  timezone: string;
  gerado: Date;
  filtros: string;
};

const COLUNAS = [
  'Ordem',
  'Texto',
  'Situacao',
  'Publicado em',
  'Arquivado em',
  'Imagem',
  'Caracteres',
  'Criado em',
];

function linha(t: TextoExportado, tz: string): (string | number)[] {
  return [
    t.ordem ?? '',
    t.conteudo,
    t.situacao,
    t.publicadoEm ? formatarNoFuso(t.publicadoEm, tz) : '',
    t.arquivadoEm ? formatarNoFuso(t.arquivadoEm, tz) : '',
    t.temImagem ? 'sim' : 'nao',
    t.caracteres,
    formatarNoFuso(t.criadoEm, tz),
  ];
}

export async function exportar(
  formato: FormatoDeExportacao,
  textos: TextoExportado[],
  contexto: ContextoDaExportacao,
): Promise<Uint8Array> {
  switch (formato) {
    case 'csv':
      return comoBytes(paraCsv(textos, contexto));
    case 'json':
      return comoBytes(paraJson(textos, contexto));
    case 'xml':
      return comoBytes(paraXml(textos, contexto));
    case 'xlsx':
      return paraXlsx(textos, contexto);
    case 'pdf':
      return paraPdf(textos, contexto);
  }
}

function comoBytes(conteudo: string): Uint8Array {
  return new TextEncoder().encode(conteudo);
}

const BOM = '﻿';

function paraCsv(textos: TextoExportado[], c: ContextoDaExportacao): string {
  const corpo = Papa.unparse(
    { fields: COLUNAS, data: textos.map((t) => linha(t, c.timezone)) },
    { quotes: true },
  );
  // Sem a marca de ordem de bytes o Excel abre os acentos errados, e a planilha
  // vai para pessoas, nao para outro programa.
  return BOM + corpo;
}

function paraJson(textos: TextoExportado[], c: ContextoDaExportacao): string {
  return JSON.stringify(
    {
      organizacao: c.organizacao,
      pasta: c.pasta,
      fusoHorario: c.timezone,
      geradoEm: c.gerado.toISOString(),
      filtros: c.filtros,
      total: textos.length,
      textos: textos.map((t) => ({
        ordem: t.ordem,
        conteudo: t.conteudo,
        situacao: t.situacao,
        publicadoEm: t.publicadoEm?.toISOString() ?? null,
        arquivadoEm: t.arquivadoEm?.toISOString() ?? null,
        temImagem: t.temImagem,
        caracteres: t.caracteres,
        criadoEm: t.criadoEm.toISOString(),
      })),
    },
    null,
    2,
  );
}

// Caracteres de controle nao sao validos em XML 1.0 e quebrariam o arquivo
// inteiro num leitor rigoroso.
const CONTROLES = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]', 'g');

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(CONTROLES, '');
}

function paraXml(textos: TextoExportado[], c: ContextoDaExportacao): string {
  const itens = textos
    .map((t) =>
      [
        '  <texto>',
        `    <ordem>${t.ordem ?? ''}</ordem>`,
        `    <conteudo>${escaparXml(t.conteudo)}</conteudo>`,
        `    <situacao>${escaparXml(t.situacao)}</situacao>`,
        `    <publicadoEm>${t.publicadoEm?.toISOString() ?? ''}</publicadoEm>`,
        `    <arquivadoEm>${t.arquivadoEm?.toISOString() ?? ''}</arquivadoEm>`,
        `    <temImagem>${t.temImagem}</temImagem>`,
        `    <caracteres>${t.caracteres}</caracteres>`,
        `    <criadoEm>${t.criadoEm.toISOString()}</criadoEm>`,
        '  </texto>',
      ].join('\n'),
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<exportacao organizacao="${escaparXml(c.organizacao)}" pasta="${escaparXml(c.pasta)}" ` +
      `fusoHorario="${escaparXml(c.timezone)}" geradoEm="${c.gerado.toISOString()}" total="${textos.length}">`,
    itens,
    '</exportacao>',
    '',
  ].join('\n');
}

async function paraXlsx(textos: TextoExportado[], c: ContextoDaExportacao): Promise<Uint8Array> {
  const pasta = new ExcelJS.Workbook();
  pasta.created = c.gerado;
  const aba = pasta.addWorksheet((c.pasta || 'Textos').slice(0, 30));

  aba.addRow([`${c.organizacao} - ${c.pasta}`]);
  aba.addRow([`Gerado em ${formatarNoFuso(c.gerado, c.timezone)} - ${c.filtros}`]);
  aba.addRow([]);
  aba.addRow(COLUNAS).font = { bold: true };
  for (const t of textos) aba.addRow(linha(t, c.timezone));

  aba.getColumn(2).width = 80;
  aba.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  for (const indice of [1, 3, 4, 5, 6, 7, 8]) aba.getColumn(indice).width = 18;

  const dados = await pasta.xlsx.writeBuffer();
  return new Uint8Array(dados as ArrayBuffer);
}

function paraPdf(textos: TextoExportado[], c: ContextoDaExportacao): Promise<Uint8Array> {
  return new Promise((resolver, rejeitar) => {
    const documento = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    const pedacos: Buffer[] = [];
    documento.on('data', (p: Buffer) => pedacos.push(p));
    documento.on('error', rejeitar);
    documento.on('end', () => {
      const inteiro = Buffer.concat(pedacos);
      const saida = new Uint8Array(new ArrayBuffer(inteiro.length));
      saida.set(inteiro);
      resolver(saida);
    });

    documento.font('Helvetica-Bold').fontSize(16).text(c.pasta);
    documento
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#555555')
      .text(`${c.organizacao} - fuso ${c.timezone}`)
      .text(`Gerado em ${formatarNoFuso(c.gerado, c.timezone)} - ${c.filtros} - ${textos.length} texto(s)`);
    documento.moveDown(1);

    textos.forEach((t, indice) => {
      if (documento.y > 700) documento.addPage();

      const cabecalho =
        `${indice + 1}. ${t.situacao}` +
        (t.ordem ? ` - ordem ${t.ordem}` : '') +
        (t.temImagem ? ' - com imagem' : '');
      documento.fillColor('#000000').font('Helvetica-Bold').fontSize(10).text(cabecalho);

      const marcas = [
        t.publicadoEm ? `publicado em ${formatarNoFuso(t.publicadoEm, c.timezone)}` : null,
        t.arquivadoEm ? `arquivado em ${formatarNoFuso(t.arquivadoEm, c.timezone)}` : null,
        `${t.caracteres} caracteres`,
      ].filter(Boolean);
      documento.font('Helvetica').fontSize(8).fillColor('#777777').text(marcas.join(' - '));

      // O conteudo vai sem as tags: o PDF e para ler, nao para reenviar.
      documento.fillColor('#000000').fontSize(11).text(resumir(t.conteudo, 4096));
      documento.moveDown(0.8);
    });

    const paginas = documento.bufferedPageRange();
    for (let i = 0; i < paginas.count; i++) {
      documento.switchToPage(i);
      documento
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#999999')
        .text(`${i + 1} de ${paginas.count}`, 48, 800, { align: 'center', width: 499 });
    }

    documento.end();
  });
}

/** Nome do arquivo, sem acento nem espaco, para nao brigar com o navegador. */
export function nomeDoArquivo(pasta: string, formato: FormatoDeExportacao, quando: Date): string {
  const limpo =
    pasta
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'textos';
  const extensao = FORMATOS.find((f) => f.valor === formato)!.extensao;
  return `msg-${limpo}-${quando.toISOString().slice(0, 10)}.${extensao}`;
}
