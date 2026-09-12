/**
 * Fusos horários. Toda a aplicação roda em `TZ=UTC`; o fuso de exibição e de
 * agendamento é sempre o da pasta, convertido aqui.
 */

/** `Intl` já conhece a lista de fusos — não há por que manter uma cópia nossa. */
export function fusoValido(timezone: string): boolean {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Sigla do fuso naquele instante (BRT, CEST…), para mostrar ao lado da hora. */
export function siglaDoFuso(timezone: string, quando = new Date()): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(quando);
  return partes.find((p) => p.type === 'timeZoneName')?.value ?? timezone;
}

/** Data e hora no fuso da pasta, com o fuso dito explicitamente. */
export function formatarNoFuso(quando: Date, timezone: string): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(quando);
  return `${texto} ${siglaDoFuso(timezone, quando)}`;
}
