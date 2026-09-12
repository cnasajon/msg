/**
 * Matriz de permissões da seção 6 da especificação, em um só lugar.
 *
 * Aqui mora só a pergunta "este perfil pode, em tese, executar esta ação?".
 * A pergunta "pode executar sobre *este* registro?" é do escopo de dados
 * (`escopo.ts`) — as duas juntas formam a autorização.
 */

export type Perfil = 'superadmin' | 'admin' | 'usuario';

export type Acao =
  | 'organizacoes.gerenciar'
  | 'organizacoes.transitar'
  | 'admins.gerenciar'
  | 'usuarios.gerenciar'
  | 'usuarios.redefinirSenha'
  | 'usuarios.atribuirPastas'
  | 'pastas.gerenciar'
  | 'pastas.configurarChatId'
  | 'pastas.configurarTokenSobreposicao'
  | 'alertas.configurarDestino'
  | 'agendamentos.gerenciar'
  | 'textos.gerenciar'
  | 'textos.importar'
  | 'textos.exportar'
  | 'textos.reordenar'
  | 'textos.publicarAgora'
  | 'imagens.ver'
  | 'painel.ver'
  | 'auditoria.ver';

/**
 * `true`  — pode, dentro do escopo de dados do perfil;
 * `false` — não pode, em hipótese alguma.
 *
 * Note que "usuário" aparece com `true` em várias linhas: o que o limita às
 * pastas atribuídas não é esta tabela, é o escopo de dados.
 */
const MATRIZ: Record<Acao, Record<Perfil, boolean>> = {
  'organizacoes.gerenciar': { superadmin: true, admin: false, usuario: false },
  'organizacoes.transitar': { superadmin: true, admin: false, usuario: false },
  'admins.gerenciar': { superadmin: true, admin: false, usuario: false },
  'usuarios.gerenciar': { superadmin: true, admin: true, usuario: false },
  'usuarios.redefinirSenha': { superadmin: true, admin: true, usuario: false },
  'usuarios.atribuirPastas': { superadmin: true, admin: true, usuario: false },
  'pastas.gerenciar': { superadmin: true, admin: true, usuario: false },
  'pastas.configurarChatId': { superadmin: true, admin: true, usuario: false },
  'pastas.configurarTokenSobreposicao': { superadmin: true, admin: false, usuario: false },
  'alertas.configurarDestino': { superadmin: true, admin: false, usuario: false },
  'agendamentos.gerenciar': { superadmin: true, admin: true, usuario: false },
  'textos.gerenciar': { superadmin: true, admin: true, usuario: true },
  'textos.importar': { superadmin: true, admin: true, usuario: true },
  'textos.exportar': { superadmin: true, admin: true, usuario: true },
  'textos.reordenar': { superadmin: true, admin: true, usuario: true },
  'textos.publicarAgora': { superadmin: true, admin: true, usuario: true },
  'imagens.ver': { superadmin: true, admin: true, usuario: true },
  'painel.ver': { superadmin: true, admin: true, usuario: true },
  'auditoria.ver': { superadmin: true, admin: true, usuario: false },
};

export function podeFazer(perfil: Perfil, acao: Acao): boolean {
  return MATRIZ[acao][perfil];
}

/** Perfis que um perfil pode criar ou editar. Admin não fabrica admin. */
export function perfisQuePodeGerenciar(perfil: Perfil): Perfil[] {
  if (perfil === 'superadmin') return ['superadmin', 'admin', 'usuario'];
  if (perfil === 'admin') return ['usuario'];
  return [];
}
