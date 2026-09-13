import { prisma } from './db';

/**
 * A última organização que o superadmin operou, se ela ainda servir.
 *
 * A escolha é uma preferência da pessoa, não um estado da sessão: sessão morre
 * a cada logout, e também a cada troca de domínio, porque o cookie é por
 * domínio. Guardá-la no usuário é o que faz entrar de novo não recomeçar na
 * tela de escolha.
 *
 * A conferência é necessária mesmo com a chave estrangeira cuidando da
 * exclusão: uma organização pode ter sido **desativada** desde o último acesso,
 * e retomar uma organização inativa colocaria a pessoa a operar algo que está
 * fora do ar sem nenhum sinal na tela.
 */
export async function ultimaOrganizacaoValida(
  id: string | null,
  /** Organizações de que a pessoa participa; `null` para superadmin, que alcança todas. */
  participa: string[] | null = null,
): Promise<string | null> {
  if (!id) return null;
  // Participação pode ter sido retirada desde o último acesso.
  if (participa !== null && !participa.includes(id)) return null;
  const organizacao = await prisma.organization.findFirst({
    where: { id, ativa: true },
    select: { id: true },
  });
  return organizacao?.id ?? null;
}
