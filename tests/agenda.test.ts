/**
 * Cálculo dos slots no fuso da pasta.
 *
 * Os serviços rodam em TZ=UTC, então tudo aqui é conversão explícita. Os casos
 * de horário de verão usam Europe/Madrid, que ainda tem a virada — o Brasil
 * aboliu a dele em 2019.
 */
import { describe, it, expect } from 'vitest';
import {
  instanteDoSlot,
  slotsVencidos,
  proximoSlot,
  problemaNaHora,
  resumirDias,
  type Agendamento,
} from '@/lib/agenda';
import pt from '../messages/pt.json';
import en from '../messages/en.json';

const mensagens = { pt, en };

const SP = 'America/Sao_Paulo';
const MADRI = 'Europe/Madrid';

const todosOsDias: Agendamento = { horaLocal: '07:00', diasSemana: [1, 2, 3, 4, 5, 6, 7], ativo: true };

describe('instante de um slot', () => {
  it('converte o fuso fixo do Brasil (UTC-3)', () => {
    expect(instanteDoSlot('2026-09-12', '07:00', SP).toISOString()).toBe('2026-09-12T10:00:00.000Z');
  });

  it('acompanha o horário de verão europeu', () => {
    // inverno: CET, UTC+1
    expect(instanteDoSlot('2026-01-15', '08:00', MADRI).toISOString()).toBe('2026-01-15T07:00:00.000Z');
    // verão: CEST, UTC+2
    expect(instanteDoSlot('2026-07-15', '08:00', MADRI).toISOString()).toBe('2026-07-15T06:00:00.000Z');
  });

  it('UTC é identidade', () => {
    expect(instanteDoSlot('2026-09-12', '07:00', 'UTC').toISOString()).toBe('2026-09-12T07:00:00.000Z');
  });

  it('a hora que o horário de verão pula não trava o cálculo', () => {
    // em 29/03/2026 Madri vai de 02:00 direto para 03:00; 02:30 não existe
    const instante = instanteDoSlot('2026-03-29', '02:30', MADRI);
    expect(Number.isNaN(instante.getTime())).toBe(false);
    // cai na hora seguinte, que é o comportamento desejado: não se perde o envio
    const local = new Intl.DateTimeFormat('pt-BR', {
      timeZone: MADRI,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(instante);
    // logo DEPOIS da virada. Publicar 02:30 às 03:30 é aceitável; publicar às
    // 01:30, uma hora antes do combinado, não é
    expect(local).toBe('03:30');
    expect(instante.getTime()).toBeGreaterThan(instanteDoSlot('2026-03-29', '01:30', MADRI).getTime());
  });

  it('a hora que acontece duas vezes resolve para a primeira ocorrência', () => {
    // em 25/10/2026 Madri repete 02:00–03:00: 00:30 UTC (CEST) e 01:30 UTC (CET)
    const instante = instanteDoSlot('2026-10-25', '02:30', MADRI);
    expect(instante.toISOString()).toBe('2026-10-25T00:30:00.000Z');

    const local = new Intl.DateTimeFormat('pt-BR', {
      timeZone: MADRI,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(instante);
    expect(local).toBe('02:30');
    // e é estável: chamar de novo dá o mesmo instante, senão a idempotência
    // dependeria da hora em que o worker acordou
    expect(instanteDoSlot('2026-10-25', '02:30', MADRI).toISOString()).toBe(instante.toISOString());
  });
});

describe('slots vencidos', () => {
  it('o que acabou de vencer entra na janela', () => {
    // 10:05 UTC = 07:05 em São Paulo, cinco minutos depois do slot das 07:00
    const agora = new Date('2026-09-14T10:05:00Z');
    const { dentroDaJanela, perdidos } = slotsVencidos([todosOsDias], SP, agora, 30);

    expect(dentroDaJanela).toHaveLength(1);
    expect(dentroDaJanela[0]).toMatchObject({ data: '2026-09-14', hora: '07:00' });
    // os slots dos dias anteriores aparecem como perdidos, e é o dispatcher que
    // descarta os que já têm publicação registrada
    expect(perdidos.every((s) => s.data < '2026-09-14')).toBe(true);
  });

  it('passada a tolerância, o slot é perdido e não volta para a janela', () => {
    // 10:45 UTC = 07:45 local, 45 minutos depois do slot
    const agora = new Date('2026-09-14T10:45:00Z');
    const { dentroDaJanela, perdidos } = slotsVencidos([todosOsDias], SP, agora, 30);

    expect(dentroDaJanela).toHaveLength(0);
    expect(perdidos.map((s) => s.data)).toContain('2026-09-14');
  });

  it('slot que ainda não chegou não aparece', () => {
    // 09:00 UTC = 06:00 local, uma hora antes
    const agora = new Date('2026-09-14T09:00:00Z');
    const { dentroDaJanela, perdidos } = slotsVencidos([todosOsDias], SP, agora, 30);
    expect(dentroDaJanela).toHaveLength(0);
    expect(perdidos.some((s) => s.data === '2026-09-14')).toBe(false);
  });

  it('respeita os dias da semana pelo calendário da pasta, não pelo de UTC', () => {
    // 22:00 em São Paulo é 01:00 UTC do dia seguinte: se o dia da semana viesse
    // de UTC, um agendamento de sexta dispararia no sábado
    const noite: Agendamento = { horaLocal: '22:00', diasSemana: [5], ativo: true }; // só sexta
    const agora = new Date('2026-09-12T01:10:00Z'); // sábado em UTC, sexta 22:10 em SP
    const { dentroDaJanela } = slotsVencidos([noite], SP, agora, 30);

    expect(dentroDaJanela).toHaveLength(1);
    expect(dentroDaJanela[0]).toMatchObject({ data: '2026-09-11', hora: '22:00' });
  });

  it('agendamento inativo não gera slot', () => {
    const inativo: Agendamento = { ...todosOsDias, ativo: false };
    const agora = new Date('2026-09-14T10:05:00Z');
    const { dentroDaJanela, perdidos } = slotsVencidos([inativo], SP, agora, 30);
    expect(dentroDaJanela).toHaveLength(0);
    expect(perdidos).toHaveLength(0);
  });

  it('vários agendamentos saem em ordem de acontecimento', () => {
    const manha: Agendamento = { horaLocal: '07:00', diasSemana: [1, 2, 3, 4, 5, 6, 7], ativo: true };
    const tarde: Agendamento = { horaLocal: '18:30', diasSemana: [1, 2, 3, 4, 5, 6, 7], ativo: true };
    // 22:00 UTC = 19:00 local: os dois do dia já venceram
    const agora = new Date('2026-09-14T22:00:00Z');
    const { dentroDaJanela } = slotsVencidos([manha, tarde], SP, agora, 24 * 60);

    const horas = dentroDaJanela.map((s) => `${s.data} ${s.hora}`);
    expect(horas[horas.length - 1]).toBe('2026-09-14 18:30');
    expect(horas.indexOf('2026-09-14 07:00')).toBeLessThan(horas.indexOf('2026-09-14 18:30'));
  });

  it('worker fora do ar: os slots antigos aparecem como perdidos, não como fila para enviar', () => {
    // dois dias sem rodar
    const agora = new Date('2026-09-14T10:05:00Z');
    const { dentroDaJanela, perdidos } = slotsVencidos([todosOsDias], SP, agora, 30);
    expect(dentroDaJanela).toHaveLength(1);
    expect(perdidos.length).toBeGreaterThanOrEqual(2);
    expect(perdidos.every((s) => s.instante.getTime() < agora.getTime() - 30 * 60_000)).toBe(true);
  });
});

describe('próximo slot', () => {
  it('encontra o próximo horário futuro', () => {
    const agora = new Date('2026-09-14T12:00:00Z'); // 09:00 em SP
    const proximo = proximoSlot([todosOsDias], SP, agora)!;
    expect(proximo.data).toBe('2026-09-15');
    expect(proximo.hora).toBe('07:00');
  });

  it('pula os dias que o agendamento não cobre', () => {
    const soSegunda: Agendamento = { horaLocal: '07:00', diasSemana: [1], ativo: true };
    const agora = new Date('2026-09-12T12:00:00Z'); // sábado
    const proximo = proximoSlot([soSegunda], SP, agora)!;
    expect(proximo.data).toBe('2026-09-14'); // segunda
  });

  it('sem agendamento ativo, não há próximo', () => {
    expect(proximoSlot([], SP, new Date())).toBeNull();
    expect(proximoSlot([{ ...todosOsDias, ativo: false }], SP, new Date())).toBeNull();
  });
});

describe('hora e dias', () => {
  it('valida o formato da hora', () => {
    expect(problemaNaHora('07:00')).toBeNull();
    expect(problemaNaHora('23:59')).toBeNull();
    expect(problemaNaHora('24:00')).not.toBeNull();
    expect(problemaNaHora('7:00')).not.toBeNull();
    expect(problemaNaHora('sete')).not.toBeNull();
  });

  it('resume os dias como a interface mostra, no idioma escolhido', () => {
    const rotulos = (idioma: 'pt' | 'en') => (chave: string) =>
      (mensagens[idioma].dias as Record<string, string>)[chave] ?? chave;
    const pt = rotulos('pt');
    const en = rotulos('en');

    expect(resumirDias([1, 2, 3, 4, 5, 6, 7], pt)).toBe('todos os dias');
    expect(resumirDias([1, 2, 3, 4, 5], pt)).toBe('Seg a Sex');
    expect(resumirDias([6, 7], pt)).toBe('Sab e Dom');
    expect(resumirDias([7, 3], pt)).toBe('Dom, Qua');

    expect(resumirDias([1, 2, 3, 4, 5], en)).toBe('Mon to Fri');
    expect(resumirDias([7, 3], en)).toBe('Sun, Wed');
  });
});
