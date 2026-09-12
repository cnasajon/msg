import { PrismaClient } from '@prisma/client';

/**
 * Instância única do Prisma. Em desenvolvimento o Next recarrega os módulos a
 * cada alteração, e sem o cache global cada recarga abriria um novo pool.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalParaPrisma.prisma = prisma;
