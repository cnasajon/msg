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
  // a sigla é a mesma em qualquer idioma; o formato em volta é que muda
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(quando);
  return partes.find((p) => p.type === 'timeZoneName')?.value ?? timezone;
}

/**
 * Data e hora no fuso da pasta, com o fuso dito explicitamente.
 *
 * A ordem dos campos segue o idioma de quem está olhando — 14/09 em português
 * e espanhol, 9/14 em inglês —, porque uma data como 09/14 lida na ordem errada
 * não parece errada, só parece outra data.
 */
export function formatarNoFuso(quando: Date, timezone: string, idioma = 'pt'): string {
  const texto = new Intl.DateTimeFormat(idioma, {
    timeZone: timezone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(quando);
  return `${texto} ${siglaDoFuso(timezone, quando)}`;
}
