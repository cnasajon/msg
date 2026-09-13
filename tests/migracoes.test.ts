/**
 * Diagnóstico de banco desatualizado.
 *
 * O modo como isto falha é o problema: o serviço sobe, o health check passa —
 * `SELECT 1` não sabe de coluna nenhuma — e o primeiro login morre com uma tela
 * genérica, sem dizer que faltou rodar a migração.
 */
import { describe, it, expect } from 'vitest';
import { bancoDesatualizado, migracoesPendentes } from '@/lib/migracoes';
import { temBanco, cliente, prepararBanco } from './helpers/banco';

describe('erro de banco atrás do código', () => {
  it('reconhece coluna e tabela que não existem', () => {
    expect(bancoDesatualizado({ code: 'P2022' })).toBe(true); // coluna
    expect(bancoDesatualizado({ code: 'P2021' })).toBe(true); // tabela
  });

  it('não confunde com os outros erros do Prisma', () => {
    expect(bancoDesatualizado({ code: 'P2002' })).toBe(false); // unicidade
    expect(bancoDesatualizado({ code: 'P1001' })).toBe(false); // banco fora do ar
    expect(bancoDesatualizado(new Error('qualquer coisa'))).toBe(false);
    expect(bancoDesatualizado(null)).toBe(false);
    expect(bancoDesatualizado(undefined)).toBe(false);
  });
});

describe.skipIf(!temBanco)('migrações pendentes', () => {
  it('não acusa pendência num banco em dia', async () => {
    await prepararBanco();
    const estado = await migracoesPendentes(cliente());

    expect(estado.conhecido).toBe(true);
    if (estado.conhecido) expect(estado.pendentes).toEqual([]);
  });
});
