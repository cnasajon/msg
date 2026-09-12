/**
 * Recurso inexistente **ou** fora do escopo do usuário.
 *
 * As duas situações devolvem a mesma coisa de propósito: responder 403 para um
 * registro de outra organização confirmaria que aquele identificador existe.
 * Quem está de fora não distingue "não existe" de "não é seu".
 */
export class NaoEncontrado extends Error {
  readonly status = 404;
  constructor(entidade = 'Recurso') {
    super(`${entidade} não encontrado.`);
    this.name = 'NaoEncontrado';
  }
}

/** Ação que o perfil não pode executar de forma alguma. */
export class NaoAutorizado extends Error {
  readonly status = 403;
  constructor(mensagem = 'Você não tem permissão para esta ação.') {
    super(mensagem);
    this.name = 'NaoAutorizado';
  }
}

/** Falta sessão válida. */
export class NaoAutenticado extends Error {
  readonly status = 401;
  constructor() {
    super('Sessão expirada ou inexistente.');
    this.name = 'NaoAutenticado';
  }
}

/** Erro de validação de formulário, com a mensagem que vai à tela. */
export class DadosInvalidos extends Error {
  readonly status = 422;
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'DadosInvalidos';
  }
}
