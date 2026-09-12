/**
 * Testes de unidade do escopo: o `where` devolvido, sem banco.
 *
 * Importa porque é aqui que se vê que o filtro não depende de nada vindo do
 * navegador — a mesma sessão sempre produz o mesmo recorte.
 */
import { describe, it, expect } from 'vitest';
import {
  organizacaoEmVigor,
  escopoDeOrganizacao,
  escopoDePasta,
  escopoDeUsuario,
  escopoDeAuditoria,
  type Sessao,
} from '@/lib/escopo';

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';
const PASTA = '33333333-3333-3333-3333-333333333333';
const NINGUEM = '00000000-0000-0000-0000-000000000000';

function sessao(parcial: Partial<Sessao>): Sessao {
  return {
    usuarioId: 'u',
    perfil: 'admin',
    organizationId: ORG_A,
    organizationAtivaId: null,
    pastasAtribuidas: [],
    ...parcial,
  };
}

describe('organização em vigor', () => {
  it('admin e usuário operam a própria organização', () => {
    expect(organizacaoEmVigor(sessao({ perfil: 'admin' }))).toBe(ORG_A);
    expect(organizacaoEmVigor(sessao({ perfil: 'usuario' }))).toBe(ORG_A);
  });

  it('superadmin opera a que escolheu, e nenhuma antes de escolher', () => {
    expect(
      organizacaoEmVigor(sessao({ perfil: 'superadmin', organizationId: null, organizationAtivaId: ORG_B })),
    ).toBe(ORG_B);
    expect(
      organizacaoEmVigor(sessao({ perfil: 'superadmin', organizationId: null, organizationAtivaId: null })),
    ).toBeNull();
  });

  it('organização ativa forjada não vale para admin', () => {
    // mesmo que alguém grave outra organização ativa na sessão de um admin,
    // o que vale é a organização dele
    expect(organizacaoEmVigor(sessao({ perfil: 'admin', organizationAtivaId: ORG_B }))).toBe(ORG_A);
  });
});

describe('escopos', () => {
  it('pasta: admin vê a organização inteira', () => {
    expect(escopoDePasta(sessao({ perfil: 'admin' }))).toEqual({ organizationId: ORG_A });
  });

  it('pasta: usuário precisa de organização E atribuição', () => {
    const escopo = escopoDePasta(sessao({ perfil: 'usuario', pastasAtribuidas: [PASTA] }));
    expect(escopo).toEqual({ organizationId: ORG_A, id: { in: [PASTA] } });
  });

  it('pasta: usuário sem atribuição nenhuma não alcança nada', () => {
    const escopo = escopoDePasta(sessao({ perfil: 'usuario', pastasAtribuidas: [] }));
    expect(escopo).toEqual({ organizationId: ORG_A, id: { in: [] } });
  });

  it('sem organização em vigor, o escopo não casa com nada — nunca com tudo', () => {
    const orfa = sessao({ perfil: 'admin', organizationId: null });
    expect(escopoDePasta(orfa)).toEqual({ id: NINGUEM });
    expect(escopoDeUsuario(orfa)).toEqual({ id: NINGUEM });
    expect(escopoDeAuditoria(orfa)).toEqual({ id: NINGUEM });
    // o erro clássico seria devolver {} aqui, abrindo o banco inteiro
    expect(escopoDePasta(orfa)).not.toEqual({});
  });

  it('organização: só o superadmin enxerga todas', () => {
    expect(escopoDeOrganizacao(sessao({ perfil: 'superadmin', organizationId: null }))).toEqual({});
    expect(escopoDeOrganizacao(sessao({ perfil: 'admin' }))).toEqual({ id: ORG_A });
  });

  it('usuário: admin nunca alcança superadmin', () => {
    expect(escopoDeUsuario(sessao({ perfil: 'admin' }))).toEqual({
      organizationId: ORG_A,
      perfil: { not: 'superadmin' },
    });
  });
});
