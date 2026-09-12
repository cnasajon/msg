import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    // Sem TEST_DATABASE_URL os testes de integração se pulam sozinhos. A URL
    // inócua existe só para o Prisma poder ser importado sem explodir.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? 'postgresql://ninguem@localhost:5432/sem-banco',
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'segredo-de-teste-apenas',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '000000:token-de-teste',
      TZ: 'UTC',
    },
    include: ['tests/**/*.test.ts'],
    // os testes de integração sobem um schema próprio no Postgres
    hookTimeout: 120_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
