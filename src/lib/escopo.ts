/**
 * Isolamento entre organizações — **a camada onde a regra é imposta**.
 *
 * Nenhuma consulta da aplicação parte de um identificador vindo da URL sem
 * passar por aqui. O padrão é sempre o mesmo:
 *
 *   const pasta = await comEscopo(sessao).pasta(idDaUrl);   // 404 se não for sua
 *
 * As funções `escopoDe*` são puras: recebem a sessão e devolvem o `where` do
 * Prisma já restrito. Isso permite testá-las sem banco e, principalmente,
 * garante que o filtro não dependa de nada que o navegador possa mandar.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { NaoEncontrado } from './erros';
import type { Perfil } from './autorizacao';

export type Sessao = {
  usuarioId: string;
  perfil: Perfil;
  /**
   * Organizações de que a pessoa participa. Vazia para o superadmin, que
   * alcança todas por perfil e não participa de nenhuma.
   */
  organizacoes: string[];
  /** Qual delas está sendo operada agora. */
  organizationAtivaId: string | null;
  /** Pastas atribuídas — só tem efeito para o perfil `usuario`. */
  pastasAtribuidas: string[];
};

/**
 * A organização cujos dados esta sessão pode tocar agora.
 *
 * Para admin e usuário é a própria. Para o superadmin é a que ele selecionou —
 * e, enquanto não selecionar nenhuma, ele não alcança dado de organização
 * alguma. Isso é deliberado: é melhor não ver nada do que ver tudo misturado.
 */
export function organizacaoEmVigor(sessao: Sessao): string | null {
  // O superadmin escolhe livremente entre todas; enquanto não escolher, não
  // alcança dado de organização nenhuma — melhor não ver nada do que ver tudo
  // misturado.
  if (sessao.perfil === 'superadmin') return sessao.organizationAtivaId;

  // Para os demais, a escolha só vale se for de uma organização de que a pessoa
  // participa: o identificador vem da sessão, e sessão é coisa que se tenta
  // forjar. Sem escolha válida, cai na primeira — quem participa de uma só
  // nunca vê seletor nem precisa escolher nada.
  if (sessao.organizationAtivaId && sessao.organizacoes.includes(sessao.organizationAtivaId)) {
    return sessao.organizationAtivaId;
  }
  return sessao.organizacoes[0] ?? null;
}

/**
 * `where` que nunca casa com nada. Usado quando não há organização em vigor:
 * devolver `{}` aqui seria abrir o banco inteiro por engano.
 */
const NADA = { id: '00000000-0000-0000-0000-000000000000' } as const;

export function escopoDeOrganizacao(sessao: Sessao): Prisma.OrganizationWhereInput {
  // O superadmin enxerga todas as organizações — é ele quem as administra.
  if (sessao.perfil === 'superadmin') return {};
  // Os demais enxergam aquelas de que participam: é a lista do seletor do
  // cabeçalho, e o que limita para onde podem transitar.
  return sessao.organizacoes.length > 0 ? { id: { in: sessao.organizacoes } } : NADA;
}

export function escopoDeUsuario(sessao: Sessao): Prisma.UserWhereInput {
  const org = organizacaoEmVigor(sessao);
  if (sessao.perfil === 'superadmin') {
    // Sem organização ativa, o superadmin ainda precisa alcançar os outros
    // superadmins (que não pertencem a organização nenhuma).
    return org
      ? { OR: [{ organizacoes: { some: { organizationId: org } } }, { perfil: 'superadmin' }] }
      : { perfil: 'superadmin' };
  }
  if (!org) return NADA;
  // Admin gerencia quem participa da organização em vigor; ninguém alcança
  // superadmin. Quem participa de várias é alcançado por qualquer admin de
  // qualquer uma delas — é o que significa participar.
  return { organizacoes: { some: { organizationId: org } }, perfil: { not: 'superadmin' } };
}

export function escopoDePasta(sessao: Sessao): Prisma.FolderWhereInput {
  const org = organizacaoEmVigor(sessao);
  if (!org) return NADA;
  if (sessao.perfil === 'usuario') {
    // Duas condições, não uma: a pasta tem de ser da organização **e** estar
    // atribuída. Só a atribuição não bastaria — uma atribuição herdada de outra
    // organização, se existisse, não pode virar porta de entrada.
    return { organizationId: org, id: { in: sessao.pastasAtribuidas } };
  }
  return { organizationId: org };
}

export function escopoDeTexto(sessao: Sessao): Prisma.TextWhereInput {
  return { folder: escopoDePasta(sessao) };
}

export function escopoDePublicacao(sessao: Sessao): Prisma.PublicationWhereInput {
  return { folder: escopoDePasta(sessao) };
}

export function escopoDeAgendamento(sessao: Sessao): Prisma.ScheduleWhereInput {
  return { folder: escopoDePasta(sessao) };
}

export function escopoDeImportacao(sessao: Sessao): Prisma.ImportWhereInput {
  return { folder: escopoDePasta(sessao) };
}

export function escopoDeAuditoria(sessao: Sessao): Prisma.AuditLogWhereInput {
  if (sessao.perfil === 'superadmin') return {};
  const org = organizacaoEmVigor(sessao);
  return org ? { organizationId: org } : NADA;
}

/**
 * Buscas por identificador. Todas devolvem o registro **ou** lançam
 * `NaoEncontrado` — nunca devolvem algo de fora do escopo, e nunca revelam que
 * o identificador existe em outra organização.
 */
export function comEscopo(sessao: Sessao) {
  return {
    async organizacao(id: string) {
      const registro = await prisma.organization.findFirst({
        where: { AND: [{ id }, escopoDeOrganizacao(sessao)] },
      });
      if (!registro) throw new NaoEncontrado('Organização');
      return registro;
    },

    async usuario(id: string) {
      const registro = await prisma.user.findFirst({
        where: { AND: [{ id }, escopoDeUsuario(sessao)] },
      });
      if (!registro) throw new NaoEncontrado('Usuário');
      return registro;
    },

    async pasta(id: string) {
      const registro = await prisma.folder.findFirst({
        where: { AND: [{ id }, escopoDePasta(sessao)] },
      });
      if (!registro) throw new NaoEncontrado('Pasta');
      return registro;
    },

    async texto(id: string) {
      const registro = await prisma.text.findFirst({
        where: { AND: [{ id }, escopoDeTexto(sessao)] },
      });
      if (!registro) throw new NaoEncontrado('Texto');
      return registro;
    },

    /**
     * Imagem de um texto. Mesmo caminho de verificação dos demais registros —
     * a rota que serve o binário não tem atalho próprio.
     */
    async imagemDoTexto(id: string) {
      const registro = await prisma.text.findFirst({
        where: { AND: [{ id }, escopoDeTexto(sessao)] },
        select: { id: true, imagem: true, imagemMime: true, imagemNomeOriginal: true },
      });
      if (!registro || !registro.imagem) throw new NaoEncontrado('Imagem');
      return registro as {
        id: string;
        imagem: Uint8Array;
        imagemMime: string | null;
        imagemNomeOriginal: string | null;
      };
    },

    async publicacao(id: string) {
      const registro = await prisma.publication.findFirst({
        where: { AND: [{ id }, escopoDePublicacao(sessao)] },
      });
      if (!registro) throw new NaoEncontrado('Publicação');
      return registro;
    },

    async importacao(id: string) {
      const registro = await prisma.import.findFirst({
        where: { AND: [{ id }, escopoDeImportacao(sessao)] },
      });
      if (!registro) throw new NaoEncontrado('Importação');
      return registro;
    },
  };
}
