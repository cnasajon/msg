import { problema, type Problema } from './avisos';

/**
 * Padrão de data das listas por data.
 *
 * Escrito como `dd/mm/aaaa`, com `*` em qualquer uma das três partes valendo
 * para "todos". `*` sozinho, ou campo vazio, é o mesmo que `*​/*​/*`: qualquer
 * data. No banco cada parte vira uma coluna, e o curinga vira nulo — é o que
 * permite filtrar pelo índice em vez de ler a pasta inteira.
 *
 * O dia da semana continua vindo do agendamento da pasta: o padrão diz em quais
 * datas o texto PODE sair, e o agendamento diz em quais dias há slot. Sem dia
 * marcado não existe slot, e nada é publicado.
 */
export type PadraoDeData = {
  dia: number | null;
  mes: number | null;
  ano: number | null;
};

export const QUALQUER_DATA: PadraoDeData = { dia: null, mes: null, ano: null };

const CURINGA = '*';
const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function parteValida(valor: string): boolean {
  return valor === CURINGA || /^\d{1,4}$/.test(valor);
}

/** Texto para as três colunas. Devolve o problema em vez de lançar. */
export function analisarPadraoDeData(
  bruto: string,
): { padrao: PadraoDeData } | { problema: Problema } {
  const limpo = bruto.trim();
  if (!limpo || limpo === CURINGA) return { padrao: QUALQUER_DATA };

  const partes = limpo.split('/');
  if (partes.length !== 3 || !partes.every((p) => parteValida(p.trim()))) {
    return { problema: problema('dataFormato') };
  }

  const [dia, mes, ano] = partes.map((p) => {
    const valor = p.trim();
    return valor === CURINGA ? null : Number(valor);
  }) as [number | null, number | null, number | null];

  if (mes !== null && (mes < 1 || mes > 12)) return { problema: problema('dataMesInvalido') };
  if (dia !== null && (dia < 1 || dia > 31)) return { problema: problema('dataDiaInvalido') };
  if (ano !== null && (ano < 2000 || ano > 2100)) return { problema: problema('dataAnoInvalido') };

  // 31/02 nunca aconteceria: vale avisar na hora de escrever, e não deixar o
  // texto esperando por uma data que não existe.
  if (dia !== null && mes !== null && dia > DIAS_NO_MES[mes - 1]!) {
    return { problema: problema('dataDiaNaoExisteNoMes', { dia, mes }) };
  }

  return { padrao: { dia, mes, ano } };
}

/** De volta para a tela, no mesmo formato que se digita. */
export function formatarPadraoDeData(padrao: PadraoDeData): string {
  const parte = (valor: number | null, casas: number) =>
    valor === null ? CURINGA : String(valor).padStart(casas, '0');
  return `${parte(padrao.dia, 2)}/${parte(padrao.mes, 2)}/${parte(padrao.ano, 4)}`;
}

/** O padrão cobre esta data? `data` vem como `aaaa-mm-dd` no fuso da pasta. */
export function padraoCasaComAData(padrao: PadraoDeData, data: string): boolean {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  return (
    (padrao.dia === null || padrao.dia === dia) &&
    (padrao.mes === null || padrao.mes === mes) &&
    (padrao.ano === null || padrao.ano === ano)
  );
}
