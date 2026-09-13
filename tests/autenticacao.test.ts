/** Senha, senha provisória e limite de tentativas. */
import { describe, it, expect, beforeEach } from 'vitest';
import { gerarHashDeSenha, senhaConfere, problemaNaSenha, gerarSenhaProvisoria } from '@/lib/senha';
import { frase } from './helpers/frase';
import { normalizarUsername, problemaNoUsername } from '@/lib/usuario';
import {
  permiteTentativaDeLogin,
  permitePedidoDeSenha,
  limparTentativas,
  zerarContadores,
} from '@/lib/rate-limit';

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

describe('nome de usuário', () => {
  it('aceita o que se digita sem pensar', () => {
    for (const bom of ['ana', 'ana.silva', 'joao_2', 'maria-jose', 'oa12', 'a1b']) {
      expect(problemaNoUsername(bom), bom).toBeNull();
    }
  });

  it('recusa espaço, acento e maiúscula — duas contas para o banco, uma pessoa para quem olha', () => {
    expect(frase(problemaNoUsername('ana silva'))).toMatch(/sem espaço|Sem espaço/);
    expect(problemaNoUsername('josé')).not.toBeNull();
    expect(problemaNoUsername('Ana')).not.toBeNull();
    expect(problemaNoUsername('ana@oa12.org')).not.toBeNull();
  });

  it('exige começar e terminar em letra ou número', () => {
    expect(problemaNoUsername('.ana')).not.toBeNull();
    expect(problemaNoUsername('ana.')).not.toBeNull();
    expect(problemaNoUsername('-ana-')).not.toBeNull();
  });

  it('recusa o curto demais e o longo demais', () => {
    expect(frase(problemaNoUsername('ab'))).toMatch(/3 a 32/);
    expect(frase(problemaNoUsername('a'.repeat(33)))).toMatch(/3 a 32/);
    expect(problemaNoUsername('a'.repeat(32))).toBeNull();
  });

  it('normaliza caixa e espaço das pontas antes de comparar', () => {
    expect(normalizarUsername('  Ana.Silva ')).toBe('ana.silva');
    expect(problemaNoUsername(normalizarUsername('  Ana.Silva '))).toBeNull();
  });
});

describe('limite dos pedidos de redefinição', () => {
  beforeEach(() => zerarContadores());

  it('é mais apertado que o do login e não interfere nele', () => {
    // três pedidos passam; o quarto, não
    for (let i = 0; i < 3; i++) {
      expect(permitePedidoDeSenha('10.0.0.9', 'ana')).toBe(true);
    }
    expect(permitePedidoDeSenha('10.0.0.9', 'ana')).toBe(false);

    // O ponto: pedir a senha de alguém repetidamente NÃO pode trancar essa
    // pessoa do lado de fora. Os contadores são separados.
    expect(permiteTentativaDeLogin('10.0.0.9', 'ana')).toBe(true);
  });

  it('o login esgotado também não bloqueia o pedido de redefinição', () => {
    for (let i = 0; i < 8; i++) permiteTentativaDeLogin('10.0.0.8', 'joao');
    expect(permiteTentativaDeLogin('10.0.0.8', 'joao')).toBe(false);

    expect(permitePedidoDeSenha('10.0.0.8', 'joao')).toBe(true);
  });
});
