/**
 * Servico `worker` — dispatcher das publicacoes.
 *
 * Roda separado do `web` e **fixo em uma replica**. O ciclo acorda a cada
 * `DISPATCH_INTERVAL_MINUTES`, calcula os slots vencidos de cada pasta no fuso
 * dela, reivindica cada slot no banco e so entao fala com o Telegram.
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../lib/env';
import { rodarCiclo } from '../lib/dispatcher';
import { destinoDosAlertas } from '../lib/alertas';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

function registrar(mensagem: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ servico: 'worker', em: new Date().toISOString(), mensagem, ...extra }));
}

let ciclando = false;

async function ciclo() {
  // O ciclo anterior pode ter passado dos cinco minutos — uma pasta com muitos
  // slots atrasados, por exemplo. Dois ciclos ao mesmo tempo nao gerariam
  // publicacao dupla, porque a restricao unica cuida disso, mas gerariam
  // trabalho jogado fora.
  if (ciclando) {
    registrar('ciclo anterior ainda rodando; este foi pulado');
    return;
  }
  ciclando = true;

  const inicio = Date.now();
  try {
    const resultado = await rodarCiclo(prisma, new Date(), registrar);
    registrar('ciclo concluido', { ...resultado, duracaoMs: Date.now() - inicio });
  } catch (erro) {
    registrar('ciclo falhou', { erro: erro instanceof Error ? erro.message : String(erro) });
  } finally {
    ciclando = false;
  }
}

async function principal() {
  const intervaloMs = env.dispatchIntervalMinutes * 60_000;
  const destino = await destinoDosAlertas(prisma);

  registrar('worker iniciado', {
    intervaloMinutos: env.dispatchIntervalMinutes,
    toleranciaMinutos: env.dispatchGraceMinutes,
    tz: process.env.TZ ?? '(nao definido)',
    destinoDosAlertas: destino.origemDoChat,
    googleChat: destino.origemDoWebhook,
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
