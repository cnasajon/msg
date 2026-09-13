/** Matriz de permissões da seção 6, linha a linha. */
import { describe, it, expect } from 'vitest';
import { podeFazer, perfisQuePodeGerenciar, type Acao, type Perfil } from '@/lib/autorizacao';

/** [ação, superadmin, admin, usuário] — cópia direta da tabela da seção 6. */
const TABELA: [Acao, boolean, boolean, boolean][] = [
  ['organizacoes.gerenciar', true, false, false],
  ['organizacoes.transitar', true, false, false],
  ['admins.gerenciar', true, false, false],
  ['usuarios.gerenciar', true, true, false],
  ['usuarios.redefinirSenha', true, true, false],
  ['usuarios.atribuirPastas', true, true, false],
  ['pastas.gerenciar', true, true, false],
  ['pastas.configurarChatId', true, true, false],
  ['pastas.configurarTokenSobreposicao', true, false, false],
  ['alertas.configurarDestino', true, false, false],
  ['agendamentos.gerenciar', true, true, false],
  ['textos.gerenciar', true, true, true],
  ['textos.importar', true, true, true],
  ['textos.exportar', true, true, true],
  ['textos.reordenar', true, true, true],
  ['textos.mover', true, true, false],
  ['textos.publicarAgora', true, true, true],
  ['imagens.ver', true, true, true],
  ['painel.ver', true, true, true],
  ['auditoria.ver', true, true, false],
];

describe('matriz de permissões', () => {
  it.each(TABELA)('%s', (acao, superadmin, admin, usuario) => {
    expect(podeFazer('superadmin', acao)).toBe(superadmin);
    expect(podeFazer('admin', acao)).toBe(admin);
    expect(podeFazer('usuario', acao)).toBe(usuario);
  });

  it('o token de sobreposição da pasta é só do superadmin', () => {
    expect(podeFazer('admin', 'pastas.configurarTokenSobreposicao')).toBe(false);
    expect(podeFazer('admin', 'pastas.configurarChatId')).toBe(true);
  });

  it('admin não fabrica admin nem superadmin', () => {
    expect(perfisQuePodeGerenciar('admin')).toEqual(['usuario']);
    expect(perfisQuePodeGerenciar('superadmin')).toContain('admin');
    expect(perfisQuePodeGerenciar('usuario')).toEqual([]);
  });

  it('nenhuma ação de escrita sobra para o perfil usuário fora dos textos', () => {
    const escritaAdministrativa: Acao[] = [
      'organizacoes.gerenciar',
      'usuarios.gerenciar',
      'pastas.gerenciar',
      'agendamentos.gerenciar',
      'alertas.configurarDestino',
    ];
    for (const acao of escritaAdministrativa) {
      expect(podeFazer('usuario' as Perfil, acao)).toBe(false);
    }
  });
});
