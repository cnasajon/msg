/**
 * Serviço `worker` — dispatcher das publicações.
 *
 * Roda separado do `web` e **fixo em uma réplica**. O ciclo de publicação, a
 * reivindicação transacional do slot e os alertas entram na fase 3; por ora o
 * processo sobe, confirma o acesso ao banco e mantém o ciclo batendo, para que
 * o serviço já possa ser criado e observado no Railway.
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../lib/env';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function ciclo() {
  const inicio = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    // Fase 3: calcular os slots vencidos de cada pasta ativa, reivindicar cada
    // um em transação (índice único folder_id + data_prevista + hora_prevista)
    // e só então falar com o Telegram.
    registrar('ciclo concluído', { duracaoMs: Date.now() - inicio });
  } catch (erro) {
    registrar('ciclo falhou', { erro: erro instanceof Error ? erro.message : String(erro) });
  }
}

function registrar(mensagem: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ servico: 'worker', em: new Date().toISOString(), mensagem, ...extra }));
}

async function principal() {
  const intervaloMs = env.dispatchIntervalMinutes * 60_000;
  registrar('worker iniciado', {
    intervaloMinutos: env.dispatchIntervalMinutes,
    toleranciaMinutos: env.dispatchGraceMinutes,
    tz: process.env.TZ ?? '(não definido)',
  });

  await ciclo();
  const timer = setInterval(() => void ciclo(), intervaloMs);

  for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sinal, () => {
      registrar('encerrando', { sinal });
      clearInterval(timer);
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  }
}

void principal();
