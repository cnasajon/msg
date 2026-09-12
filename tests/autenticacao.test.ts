/** Senha, senha provisória e limite de tentativas. */
import { describe, it, expect, beforeEach } from 'vitest';
import { gerarHashDeSenha, senhaConfere, problemaNaSenha, gerarSenhaProvisoria } from '@/lib/senha';
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

  it('exige pelo menos 12 caracteres', () => {
    expect(problemaNaSenha('curta')).toMatch(/12 caracteres/);
    expect(problemaNaSenha('uma senha longa o bastante')).toBeNull();
  });

  it('senha provisória não usa caracteres ambíguos', () => {
    for (let i = 0; i < 50; i++) {
      expect(gerarSenhaProvisoria()).not.toMatch(/[l1IO0]/);
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
