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
export async function ultimaOrganizacaoValida(id: string | null): Promise<string | null> {
  if (!id) return null;
  const organizacao = await prisma.organization.findFirst({
    where: { id, ativa: true },
    select: { id: true },
  });
  return organizacao?.id ?? null;
}
