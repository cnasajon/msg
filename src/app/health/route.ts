import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Health check do serviço `web` (Settings → Deploy no Railway).
 * Responde 200 com o banco de pé e 503 sem ele — nunca vaza detalhe do erro.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, servico: 'web', banco: 'ok' });
  } catch {
    return Response.json({ ok: false, servico: 'web', banco: 'indisponivel' }, { status: 503 });
  }
}
