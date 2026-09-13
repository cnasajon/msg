/**
 * Calculo dos slots de publicacao no fuso da pasta.
 *
 * Este e o arquivo onde o fuso horario e resolvido, e por isso ele nao depende
 * do banco nem da hora do processo: recebe os agendamentos e o instante atual,
 * devolve os slots vencidos. Assim da para testar horario de verao sem subir
 * nada.
 *
 * Vocabulario:
 *  - **slot** e o par (data, hora) no fuso da pasta em que algo deveria sair.
 *    E a chave unica de `publications`, e e o que garante a idempotencia;
 *  - um slot esta **vencido** quando ja passou, e **dentro da janela** quando
 *    passou ha menos que a tolerancia (30 minutos por padrao);
 *  - passou disso, o slot esta **perdido**: nunca e publicado com atraso.
 */

export type Agendamento = {
  /** "HH:MM" no fuso da pasta. */
  horaLocal: string;
  /** ISO-8601: 1 = segunda ... 7 = domingo. */
  diasSemana: number[];
  ativo: boolean;
};

export type Slot = {
  /** "AAAA-MM-DD" no fuso da pasta. */
  data: string;
  /** "HH:MM" no fuso da pasta. */
  hora: string;
  /** O instante real em que esse slot aconteceu. */
  instante: Date;
};

/** Partes de uma data no fuso pedido, sem depender do fuso do processo. */
function partesNoFuso(quando: Date, timezone: string) {
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const partes = Object.fromEntries(
    formatador.formatToParts(quando).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const diasCurtos: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour === '24' ? '00' : partes.hour}:${partes.minute}`,
    diaDaSemana: diasCurtos[partes.weekday ?? 'Mon'] ?? 1,
  };
}

/** Deslocamento do fuso naquele instante, em milissegundos. */
function deslocamento(instante: Date, timezone: string): number {
  const visto = partesNoFuso(instante, timezone);
  const [ano, mes, dia] = visto.data.split('-').map(Number) as [number, number, number];
  const [hora, minuto] = visto.hora.split(':').map(Number) as [number, number];
  const segundos = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, second: '2-digit', hour12: false }).format(instante),
  );
  return Date.UTC(ano, mes - 1, dia, hora, minuto, segundos) - instante.getTime();
}

/**
 * O instante em que "AAAA-MM-DD HH:MM daquele fuso" acontece.
 *
 * O deslocamento do fuso depende da propria data que se quer descobrir, entao
 * o calculo testa os dois candidatos possiveis — um com o deslocamento antes da
 * virada, outro com o de depois — e decide entre eles:
 *
 *  - nos dias normais os dois coincidem;
 *  - na **hora repetida** do fim do horario de verao os dois sao validos, e
 *    vale a **primeira** ocorrencia: publicar mais cedo e melhor que mais tarde;
 *  - na **hora que nao existe** (a madrugada que o horario de verao pula)
 *    nenhum reproduz o horario pedido, e vale o instante logo **depois** da
 *    virada. Publicar as 03:30 um texto marcado para 02:30 e aceitavel;
 *    publicar as 01:30, uma hora antes do combinado, nao e.
 */
export function instanteDoSlot(data: string, hora: string, timezone: string): Date {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  const [h, m] = hora.split(':').map(Number) as [number, number];
  const alvo = Date.UTC(ano, mes - 1, dia, h, m);

  const primeiro = new Date(alvo - deslocamento(new Date(alvo), timezone));
  const segundo = new Date(alvo - deslocamento(primeiro, timezone));
  // O terceiro olha o deslocamento algumas horas antes: e ele que enxerga o
  // lado de la de uma virada e revela a primeira das duas ocorrencias da hora
  // repetida.
  const terceiro = new Date(alvo - deslocamento(new Date(primeiro.getTime() - 3 * 3_600_000), timezone));

  const reproduzOPedido = (candidato: Date) => {
    const visto = partesNoFuso(candidato, timezone);
    return visto.data === data && visto.hora === hora;
  };

  const validos = [primeiro, segundo, terceiro].filter(reproduzOPedido);
  if (validos.length > 0) {
    return new Date(Math.min(...validos.map((d) => d.getTime())));
  }
  return new Date(Math.max(primeiro.getTime(), segundo.getTime(), terceiro.getTime()));
}

/** Soma dias no calendario do fuso, sem cair na armadilha das 24 horas fixas. */
function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  const movido = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return movido.toISOString().slice(0, 10);
}

/**
 * Slots vencidos que ainda cabem na janela de tolerancia, do mais antigo para o
 * mais novo.
 *
 * Olha alguns dias para tras porque a janela pode atravessar a meia-noite e
 * porque o worker pode ter ficado fora do ar; o que estiver fora da tolerancia
 * sai por `perdidos`.
 */
export function slotsVencidos(
  agendamentos: Agendamento[],
  timezone: string,
  agora: Date,
  toleranciaMinutos: number,
  /** Quantos dias para tras varrer. Dois cobrem a janela e a virada do dia. */
  diasParaTras = 2,
): { dentroDaJanela: Slot[]; perdidos: Slot[] } {
  const ativos = agendamentos.filter((a) => a.ativo);
  const dentroDaJanela: Slot[] = [];
  const perdidos: Slot[] = [];

  const hojeNoFuso = partesNoFuso(agora, timezone).data;
  const limite = agora.getTime() - toleranciaMinutos * 60_000;

  for (let recuo = diasParaTras; recuo >= 0; recuo--) {
    const data = somarDias(hojeNoFuso, -recuo);

    for (const agendamento of ativos) {
      const instante = instanteDoSlot(data, agendamento.horaLocal, timezone);
      // o dia da semana e o do instante no fuso da pasta, nao o do calendario UTC
      const { diaDaSemana } = partesNoFuso(instante, timezone);
      if (!agendamento.diasSemana.includes(diaDaSemana)) continue;

      if (instante.getTime() > agora.getTime()) continue; // ainda nao venceu
      const slot = { data, hora: agendamento.horaLocal, instante };
      if (instante.getTime() >= limite) dentroDaJanela.push(slot);
      else perdidos.push(slot);
    }
  }

  const porInstante = (a: Slot, b: Slot) => a.instante.getTime() - b.instante.getTime();
  return { dentroDaJanela: dentroDaJanela.sort(porInstante), perdidos: perdidos.sort(porInstante) };
}

/** Proximo slot futuro, para o painel dizer quando sai a proxima publicacao. */
export function proximoSlot(
  agendamentos: Agendamento[],
  timezone: string,
  agora: Date,
  diasParaFrente = 8,
): Slot | null {
  const ativos = agendamentos.filter((a) => a.ativo);
  if (ativos.length === 0) return null;

  const hojeNoFuso = partesNoFuso(agora, timezone).data;
  let melhor: Slot | null = null;

  for (let avanco = 0; avanco <= diasParaFrente; avanco++) {
    const data = somarDias(hojeNoFuso, avanco);
    for (const agendamento of ativos) {
      const instante = instanteDoSlot(data, agendamento.horaLocal, timezone);
      const { diaDaSemana } = partesNoFuso(instante, timezone);
      if (!agendamento.diasSemana.includes(diaDaSemana)) continue;
      if (instante.getTime() <= agora.getTime()) continue;
      if (!melhor || instante.getTime() < melhor.instante.getTime()) {
        melhor = { data, hora: agendamento.horaLocal, instante };
      }
    }
    if (melhor) break; // o primeiro dia que rende algum slot ja tem o menor
  }
  return melhor;
}

/** "HH:MM" valido? */
export function problemaNaHora(valor: string): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) return 'Informe a hora no formato HH:MM, de 00:00 a 23:59.';
  return null;
}

/** Siglas na ordem em que a interface mostra: comeca no domingo. */
export const DIAS_DA_SEMANA = [
  { iso: 7, sigla: 'Dom' },
  { iso: 1, sigla: 'Seg' },
  { iso: 2, sigla: 'Ter' },
  { iso: 3, sigla: 'Qua' },
  { iso: 4, sigla: 'Qui' },
  { iso: 5, sigla: 'Sex' },
  { iso: 6, sigla: 'Sab' },
] as const;

export function resumirDias(diasSemana: number[]): string {
  if (diasSemana.length === 7) return 'todos os dias';
  const ordenados = [...diasSemana].sort((a, b) => a - b);
  if (ordenados.join(',') === '1,2,3,4,5') return 'Seg a Sex';
  if (ordenados.join(',') === '6,7') return 'Sab e Dom';
  return DIAS_DA_SEMANA.filter((d) => diasSemana.includes(d.iso))
    .map((d) => d.sigla)
    .join(', ');
}
