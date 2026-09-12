/** Interpretação de datas da planilha e análise da importação. */
import { describe, it, expect } from 'vitest';
import { interpretarData } from '@/lib/planilha';

describe('datas da planilha', () => {
  it('aceita o formato brasileiro', () => {
    const data = interpretarData('31/12/2026')!;
    expect(data.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('aceita ISO e o que o Excel devolve', () => {
    expect(interpretarData('2026-03-12')!.toISOString().slice(0, 10)).toBe('2026-03-12');
    expect(interpretarData('2026-03-12T07:00:00.000Z')!.toISOString().slice(0, 10)).toBe('2026-03-12');
  });

  it('aceita data com hora, nos dois formatos', () => {
    expect(interpretarData('12/03/2026 07:30')!.toISOString()).toBe('2026-03-12T07:30:00.000Z');
    expect(interpretarData('2026-03-12 07:30')!.toISOString()).toBe('2026-03-12T07:30:00.000Z');
  });

  it('no ambíguo vale o formato brasileiro, que é de onde vêm os arquivos', () => {
    // 03/12 é 3 de dezembro, não 12 de março
    expect(interpretarData('03/12/2026')!.toISOString().slice(0, 10)).toBe('2026-12-03');
  });

  it('aceita ano com dois dígitos', () => {
    expect(interpretarData('05/01/26')!.toISOString().slice(0, 10)).toBe('2026-01-05');
  });

  it('recusa data impossível e texto qualquer', () => {
    expect(interpretarData('31/02/2026')).toBeNull();
    expect(interpretarData('32/01/2026')).toBeNull();
    expect(interpretarData('ontem')).toBeNull();
    expect(interpretarData('')).toBeNull();
  });
});
