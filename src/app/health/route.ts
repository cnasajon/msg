import { prisma } from '@/lib/db';
import { migracoesPendentes } from '@/lib/migracoes';

export const dynamic = 'force-dynamic';

/**
 * Health check do serviço `web` (Settings → Deploy no Railway).
 *
 * Responde 200 com o banco de pé e migrado, e 503 quando falta qualquer um dos
 * dois — nunca vaza detalhe do erro. As migrações entram aqui porque `SELECT 1`
 * passa num banco sem as colunas que o código espera: o serviço subiria saudável
 * e quebraria no primeiro login, sem dizer por quê.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return Response.json({ ok: false, servico: 'web', banco: 'indisponivel' }, { status: 503 });
  }

  const migracoes = await migracoesPendentes(prisma);
  if (migracoes.conhecido && migracoes.pendentes.length > 0) {
    return Response.json(
      {
        ok: false,
        servico: 'web',
        banco: 'ok',
        migracoes: 'pendentes',
        pendentes: migracoes.pendentes,
        comoResolver: 'npm run migrate:deploy',
      },
      { status: 503 },
    );
  }

  return Response.json({ ok: true, servico: 'web', banco: 'ok', migracoes: 'em dia' });
}
