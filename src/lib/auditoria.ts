import { prisma } from './db';
import type { Sessao } from './escopo';
import { organizacaoEmVigor } from './escopo';

/**
 * Registro de auditoria. Vale a regra da seção 11: nenhum token, senha ou
 * valor de segredo entra em `detalhes` — só o fato de terem mudado.
 */
export type EventoDeAuditoria = {
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  detalhes?: Record<string, unknown> | null;
  /** Sobrepõe a organização em vigor — usado quando o alvo é de outra. */
  organizationId?: string | null;
  ip?: string | null;
};

export async function registrarAuditoria(sessao: Sessao | null, evento: EventoDeAuditoria) {
  await prisma.auditLog.create({
    data: {
      organizationId:
        evento.organizationId !== undefined
          ? evento.organizationId
          : sessao
            ? organizacaoEmVigor(sessao)
            : null,
      userId: sessao?.usuarioId ?? null,
      acao: evento.acao,
      entidade: evento.entidade,
      entidadeId: evento.entidadeId ?? null,
      detalhes: (evento.detalhes ?? undefined) as never,
      ip: evento.ip ?? null,
    },
  });
}
