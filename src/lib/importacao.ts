import { prisma } from './db';
import { interpretarData, type Planilha } from './planilha';
import { hashDoConteudo, problemaNoTamanho, resumir, tamanhoDoTexto } from './textos';

/**
 * Análise de uma planilha antes e durante a importação.
 *
 * A mesma função serve à pré-visualização e à gravação: o que a pessoa vê antes
 * de confirmar é exatamente o que vai acontecer, não uma estimativa parecida.
 */

export type Mapeamento = {
  colunaTexto: number;
  /** -1 quando nenhuma coluna de data foi escolhida. */
  colunaData: number;
  primeiraLinhaEhCabecalho: boolean;
};

export type SituacaoDaLinha =
  | 'importar'
  | 'importar_como_historico'
  | 'duplicada'
  | 'vazia'
  | 'acima_do_limite'
  | 'data_invalida';

export type LinhaAnalisada = {
  numero: number;
  resumo: string;
  caracteres: number;
  publicadaEm: Date | null;
  situacao: SituacaoDaLinha;
  conteudo: string;
  hash: string;
};

export type AnaliseDaImportacao = {
  linhas: LinhaAnalisada[];
  total: number;
  importaveis: number;
  comoHistorico: number;
  duplicadas: number;
  descartadas: number;
};

export async function analisar(
  planilha: Planilha,
  mapeamento: Mapeamento,
  folderId: string,
): Promise<AnaliseDaImportacao> {
  const corpo = mapeamento.primeiraLinhaEhCabecalho ? planilha.linhas.slice(1) : planilha.linhas;
  const deslocamento = mapeamento.primeiraLinhaEhCabecalho ? 2 : 1;

  const existentes = new Set(
    (
      await prisma.text.findMany({ where: { folderId }, select: { hashConteudo: true } })
    ).map((t) => t.hashConteudo),
  );
  // duplicata também vale dentro do próprio arquivo
  const vistosNoArquivo = new Set<string>();

  const linhas = corpo.map((linha, indice): LinhaAnalisada => {
    const conteudo = (linha[mapeamento.colunaTexto] ?? '').trim();
    const numero = indice + deslocamento;
    const hash = hashDoConteudo(conteudo);

    const base = { numero, conteudo, hash, resumo: resumir(conteudo, 90), caracteres: tamanhoDoTexto(conteudo) };

    if (!conteudo) return { ...base, publicadaEm: null, situacao: 'vazia' };

    // Sem imagem na importação, então o limite é sempre o de 4096.
    if (problemaNoTamanho(conteudo, false)) {
      return { ...base, publicadaEm: null, situacao: 'acima_do_limite' };
    }

    let publicadaEm: Date | null = null;
    if (mapeamento.colunaData >= 0) {
      const bruta = (linha[mapeamento.colunaData] ?? '').trim();
      if (bruta) {
        publicadaEm = interpretarData(bruta);
        if (!publicadaEm) return { ...base, publicadaEm: null, situacao: 'data_invalida' };
      }
    }

    if (existentes.has(hash) || vistosNoArquivo.has(hash)) {
      return { ...base, publicadaEm, situacao: 'duplicada' };
    }
    vistosNoArquivo.add(hash);

    return {
      ...base,
      publicadaEm,
      situacao: publicadaEm ? 'importar_como_historico' : 'importar',
    };
  });

  return {
    linhas,
    total: linhas.length,
    importaveis: linhas.filter((l) => l.situacao === 'importar' || l.situacao === 'importar_como_historico').length,
    comoHistorico: linhas.filter((l) => l.situacao === 'importar_como_historico').length,
    duplicadas: linhas.filter((l) => l.situacao === 'duplicada').length,
    descartadas: linhas.filter((l) =>
      ['vazia', 'acima_do_limite', 'data_invalida'].includes(l.situacao),
    ).length,
  };
}

export const EXPLICACAO_DA_SITUACAO: Record<SituacaoDaLinha, string> = {
  importar: 'entra como pendente',
  importar_como_historico: 'entra como publicado (histórico)',
  duplicada: 'duplicada — já existe nesta pasta',
  vazia: 'ignorada — linha vazia',
  acima_do_limite: 'acima de 4096 caracteres',
  data_invalida: 'data de publicação não reconhecida',
};
