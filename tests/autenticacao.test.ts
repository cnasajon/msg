/** Senha, senha provisória e limite de tentativas. */
import { describe, it, expect, beforeEach } from 'vitest';
import { gerarHashDeSenha, senhaConfere, problemaNaSenha, gerarSenhaProvisoria } from '@/lib/senha';
import { frase } from './helpers/frase';
import { permiteTentativaDeLogin, limparTentativas, zerarContadores } from '@/lib/rate-limit';

describe('senha', () => {
  it('guarda com argon2id e confere', async () => {
    const hash = await gerarHashDeSenha('uma senha bem comprida');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await senhaConfere('uma senha bem comprida', hash)).toBe(true);
    expect(await senhaConfere('outra senha qualquer', hash)).toBe(false);
  });

  it('hash corrompido não autentica ninguém, e não explode', async () => {
    expect(await senhaConfere('qualquer coisa', 'isto-não-é-um-hash')).toBe(false);
  });

  it('exige 8 caracteres, maiúscula, número e especial', () => {
    expect(problemaNaSenha('Ab1!cdef')).toBeNull();

    expect(frase(problemaNaSenha('Ab1!cde'))).toMatch(/8 caracteres/);
    expect(frase(problemaNaSenha('ab1!cdef'))).toMatch(/maiúscula/);
    expect(frase(problemaNaSenha('Abc!defg'))).toMatch(/número/);
    expect(frase(problemaNaSenha('Abc1defg'))).toMatch(/especial/);
  });

  it('reúne tudo que falta numa mensagem só', () => {
    const problema = frase(problemaNaSenha('abc'));
    expect(problema).toMatch(/8 caracteres/);
    expect(problema).toMatch(/maiúscula/);
    expect(problema).toMatch(/número/);
    expect(problema).toMatch(/especial/);
  });

  it('senha comprida sem os requisitos continua recusada', () => {
    // a regra antiga passava só pelo tamanho; esta não passa
    expect(frase(problemaNaSenha('uma senha longa o bastante'))).toMatch(/maiúscula/);
  });

  it('acento não conta como caractere especial, e maiúscula acentuada conta', () => {
    expect(frase(problemaNaSenha('Senha123á'))).toMatch(/especial/);
    expect(problemaNaSenha('Ática123!')).toBeNull();
  });

  it('espaço nas pontas e senha longa demais são recusados', () => {
    expect(frase(problemaNaSenha(' Ab1!cdef'))).toMatch(/espaço/);
    expect(frase(problemaNaSenha('Ab1!cdef'.repeat(30)))).toMatch(/longa demais/);
  });

  it('senha provisória não usa caracteres ambíguos', () => {
    for (let i = 0; i < 50; i++) {
      expect(gerarSenhaProvisoria()).not.toMatch(/[l1IO0]/);
    }
  });

  it('senha provisória já nasce dentro da política', () => {
    for (let i = 0; i < 200; i++) {
      expect(problemaNaSenha(gerarSenhaProvisoria())).toBeNull();
    }
  });

  it('senhas provisórias não se repetem', () => {
    const geradas = new Set(Array.from({ length: 200 }, () => gerarSenhaProvisoria()));
    expect(geradas.size).toBe(200);
  });
});

describe('limite de tentativas de login', () => {
  beforeEach(() => zerarContadores());

  it('corta a conta depois de 8 tentativas na janela', () => {
    for (let i = 0; i < 8; i++) {
      expect(permiteTentativaDeLogin('10.0.0.1', 'alvo@exemplo.org')).toBe(true);
    }
    expect(permiteTentativaDeLogin('10.0.0.1', 'alvo@exemplo.org')).toBe(false);
    // trocar de IP não ressuscita a conta
    expect(permiteTentativaDeLogin('10.0.0.2', 'alvo@exemplo.org')).toBe(false);
  });

  it('conta diferente na mesma janela continua livre', () => {
    for (let i = 0; i < 9; i++) permiteTentativaDeLogin('10.0.0.1', 'alvo@exemplo.org');
    expect(permiteTentativaDeLogin('10.0.0.1', 'outra@exemplo.org')).toBe(true);
  });

  it('login bem-sucedido zera o contador daquela conta', () => {
    for (let i = 0; i < 8; i++) permiteTentativaDeLogin('10.0.0.1', 'alvo@exemplo.org');
    limparTentativas('10.0.0.1', 'alvo@exemplo.org');
    expect(permiteTentativaDeLogin('10.0.0.1', 'alvo@exemplo.org')).toBe(true);
  });

  it('o e-mail é normalizado: maiúsculas não driblam o limite', () => {
    for (let i = 0; i < 8; i++) permiteTentativaDeLogin('10.0.0.1', 'alvo@exemplo.org');
    expect(permiteTentativaDeLogin('10.0.0.1', 'ALVO@Exemplo.ORG')).toBe(false);
  });
});
