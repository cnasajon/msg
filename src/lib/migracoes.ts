import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';

/**
 * Migrações que o repositório traz e o banco ainda não aplicou.
 *
 * Existe porque o modo como isto falha é péssimo: o serviço sobe, o health check
 * passa — `SELECT 1` não sabe de coluna nenhuma — e o primeiro login morre com
 * uma tela de erro genérica, sem dizer que faltou rodar a migração. Quem vê o
 * sintoma não tem como adivinhar a causa.
 *
 * A leitura falha silenciosa de propósito: não saber responder nunca pode
 * derrubar o health check, senão a proteção vira a própria pane.
 */
export type EstadoDasMigracoes =
  | { conhecido: true; pendentes: string[] }
  | { conhecido: false; motivo: string };

function migracoesDoRepositorio(): string[] {
  return readdirSync(join(process.cwd(), 'prisma', 'migrations'), { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .sort();
}

export async function migracoesPendentes(prisma: PrismaClient): Promise<EstadoDasMigracoes> {
  let doRepositorio: string[];
  try {
    doRepositorio = migracoesDoRepositorio();
  } catch {
    // empacotamento sem a pasta de migrações: melhor não afirmar nada
    return { conhecido: false, motivo: 'migracoes-nao-encontradas' };
  }

  try {
    const aplicadas = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
    `;
    const jaAplicadas = new Set(aplicadas.map((linha) => linha.migration_name));
    return { conhecido: true, pendentes: doRepositorio.filter((nome) => !jaAplicadas.has(nome)) };
  } catch {
    // Sem a tabela de controle, nenhuma migração rodou neste banco — é o caso do
    // banco recém-criado, e todas estão pendentes.
    return { conhecido: true, pendentes: doRepositorio };
  }
}

/**
 * O banco não tem o que este código espera.
 *
 * P2021 é tabela que não existe e P2022 é coluna que não existe: os dois
 * significam a mesma coisa na prática — o código está à frente do banco.
 */
export function bancoDesatualizado(erro: unknown): boolean {
  const codigo = (erro as { code?: string })?.code;
  return codigo === 'P2021' || codigo === 'P2022';
}
