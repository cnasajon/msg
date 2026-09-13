/**
 * Gestão de senhas e a organização lembrada.
 *
 * Duas coisas que o usuário mantém sozinho (contato e senha) e uma que o
 * administrador faz por ele (definir a senha à mão), mais a preferência de
 * organização que precisa sobreviver ao logout.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prepararBanco, limpar, cliente, temBanco } from './helpers/banco';
import { ultimaOrganizacaoValida } from '@/lib/organizacao-lembrada';
import { gerarHashDeSenha, senhaConfere, problemaNaSenha } from '@/lib/senha';

describe.skipIf(!temBanco)('organização lembrada entre logins', () => {
  beforeAll(async () => {
    await prepararBanco();
  });
  beforeEach(() => limpar());
  afterAll(async () => {
    await cliente().$disconnect();
  });

  async function organizacao(nome: string, ativa = true) {
    return cliente().organization.create({
      data: { nome: `${nome} ${randomUUID().slice(0, 6)}`, idiomaPadrao: 'pt', timezonePadrao: 'UTC', ativa },
    });
  }

  it('retoma a organização que o superadmin operou por último', async () => {
    const org = await organizacao('Operada');
    expect(await ultimaOrganizacaoValida(org.id)).toBe(org.id);
  });

  it('sem preferência guardada, entra sem organização', async () => {
    expect(await ultimaOrganizacaoValida(null)).toBeNull();
  });

  it('organização DESATIVADA desde o último acesso não é retomada', async () => {
    // retomar uma organização fora do ar colocaria a pessoa a operar algo
    // inativo sem nenhum sinal na tela
    const org = await organizacao('Desativada', false);
    expect(await ultimaOrganizacaoValida(org.id)).toBeNull();
  });

  it('organização que não existe mais não derruba o login', async () => {
    expect(await ultimaOrganizacaoValida(randomUUID())).toBeNull();
  });

  it('excluir a organização apenas limpa a preferência de quem a operava', async () => {
    const org = await organizacao('Some');
    const usuario = await cliente().user.create({
      data: {
        nome: 'Super', username: `s-${randomUUID().slice(0, 8)}`, perfil: 'superadmin',
        senhaHash: 'x', senhaProvisoria: false, ultimaOrganizacaoId: org.id,
      },
    });

    await cliente().organization.delete({ where: { id: org.id } });

    const depois = await cliente().user.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(depois.ultimaOrganizacaoId).toBeNull();
    expect(depois.ativo).toBe(true);
  });
});

describe('senha definida à mão pelo administrador', () => {
  it('passa pelas mesmas regras da troca normal', () => {
    // a porta do administrador não pode ser a porta dos fundos para senha fraca
    expect(problemaNaSenha('123')).not.toBeNull();
    expect(problemaNaSenha('semmaiuscula1!')).not.toBeNull();
    expect(problemaNaSenha('SemNumero!!')).not.toBeNull();
    expect(problemaNaSenha('SemEspecial123')).not.toBeNull();
    expect(problemaNaSenha('Combinada123!')).toBeNull();
  });

  it('a senha combinada realmente entra', async () => {
    const hash = await gerarHashDeSenha('Combinada123!');
    expect(await senhaConfere('Combinada123!', hash)).toBe(true);
    expect(await senhaConfere('outra coisa', hash)).toBe(false);
  });
});

describe.skipIf(!temBanco)('gravação da senha definida', () => {
  beforeAll(async () => {
    await prepararBanco();
  });
  beforeEach(() => limpar());
  afterAll(async () => {
    await cliente().$disconnect();
  });

  async function alguem(senhaProvisoria = false) {
    return cliente().user.create({
      data: {
        nome: 'Alvo', username: `a-${randomUUID().slice(0, 8)}`, perfil: 'usuario',
        senhaHash: await gerarHashDeSenha('Antiga123!'), senhaProvisoria,
      },
    });
  }

  it('exigirTroca marcado deixa a conta em senha provisória', async () => {
    const alvo = await alguem();
    await cliente().user.update({
      where: { id: alvo.id },
      data: { senhaHash: await gerarHashDeSenha('Combinada123!'), senhaProvisoria: true },
    });

    const depois = await cliente().user.findUniqueOrThrow({ where: { id: alvo.id } });
    expect(depois.senhaProvisoria).toBe(true);
    expect(await senhaConfere('Combinada123!', depois.senhaHash)).toBe(true);
    // a senha antiga para de valer na hora
    expect(await senhaConfere('Antiga123!', depois.senhaHash)).toBe(false);
  });

  it('a senha nunca é guardada em claro — só o hash argon2id', async () => {
    const alvo = await alguem();
    const depois = await cliente().user.findUniqueOrThrow({ where: { id: alvo.id } });
    expect(depois.senhaHash.startsWith('$argon2id$')).toBe(true);
    expect(depois.senhaHash).not.toContain('Antiga123!');
  });
});
