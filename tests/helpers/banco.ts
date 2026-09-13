import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import type { Sessao } from '@/lib/escopo';

/**
 * Banco para os testes de integração.
 *
 * Sem `TEST_DATABASE_URL` os testes de integração são pulados e só os de
 * unidade rodam — assim `npm test` funciona numa máquina sem Postgres, e a
 * cobertura completa roda no CI e no ambiente de desenvolvimento.
 */
export const urlDoBanco = process.env.TEST_DATABASE_URL ?? null;
export const temBanco = urlDoBanco !== null;

/**
 * O mesmo cliente que a aplicação usa — de propósito. Testar o isolamento por
 * uma conexão paralela provaria menos: o que precisa ser verdade é que as
 * consultas da aplicação, com o Prisma da aplicação, não atravessam a fronteira.
 */
export function cliente() {
  if (!urlDoBanco) throw new Error('TEST_DATABASE_URL não definida.');
  return prisma;
}

/** Aplica as migrações e limpa as tabelas antes de cada arquivo de teste. */
export async function prepararBanco() {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: urlDoBanco! },
    stdio: 'ignore',
  });
  await limpar();
}

export async function limpar() {
  const db = cliente();
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE audit_log, sessions, user_folders, user_organizations, publications, texts,
                   imports, schedules, folders, users, organizations, settings RESTART IDENTITY CASCADE
  `);
}

/** Uma imagem PNG mínima e válida, para os testes da rota de imagem. */
export function pngDeTeste(): Uint8Array<ArrayBuffer> {
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  // O campo `bytea` do Prisma pede Uint8Array sobre ArrayBuffer, não sobre o
  // buffer compartilhado que `Buffer.from` devolve.
  const saida = new Uint8Array(new ArrayBuffer(bytes.length));
  saida.set(bytes);
  return saida;
}

export type Cenario = Awaited<ReturnType<typeof criarCenario>>;

/**
 * Duas organizações completas e independentes — é sobre elas que os testes de
 * isolamento perguntam "o admin de A alcança algo de B?".
 */
export async function criarCenario() {
  const db = cliente();

  async function montarOrganizacao(nome: string, timezone: string) {
    const organizacao = await db.organization.create({
      data: { nome, idiomaPadrao: 'pt', timezonePadrao: timezone },
    });
    const admin = await db.user.create({
      data: {
        nome: `Admin ${nome}`,
        username: `admin-${randomUUID().slice(0, 8)}`,
        email: `admin-${randomUUID()}@exemplo.org`,
        senhaHash: 'x',
        perfil: 'admin',
        organizacoes: { create: { organizationId: organizacao.id } },
        senhaProvisoria: false,
      },
    });
    const usuario = await db.user.create({
      data: {
        nome: `Usuário ${nome}`,
        username: `usuario-${randomUUID().slice(0, 8)}`,
        email: `usuario-${randomUUID()}@exemplo.org`,
        senhaHash: 'x',
        perfil: 'usuario',
        organizacoes: { create: { organizationId: organizacao.id } },
        senhaProvisoria: false,
      },
    });
    const pasta = await db.folder.create({
      data: { organizationId: organizacao.id, nome: `Pasta de ${nome}`, timezone },
    });
    const pastaSemAtribuicao = await db.folder.create({
      data: { organizationId: organizacao.id, nome: `Reservada de ${nome}`, timezone },
    });
    await db.userFolder.create({ data: { userId: usuario.id, folderId: pasta.id } });

    const texto = await db.text.create({
      data: {
        folderId: pasta.id,
        conteudo: `Texto de ${nome}`,
        ordem: 1,
        hashConteudo: randomUUID(),
        imagem: pngDeTeste(),
        imagemMime: 'image/png',
        imagemBytes: pngDeTeste().length,
        imagemNomeOriginal: 'teste.png',
      },
    });
    const publicacao = await db.publication.create({
      data: {
        folderId: pasta.id,
        textId: texto.id,
        dataPrevista: new Date('2026-09-10T00:00:00Z'),
        horaPrevista: new Date('1970-01-01T07:00:00Z'),
        status: 'enviada',
        conteudoPublicado: `Texto de ${nome}`,
      },
    });

    return {
      organizacao,
      admin: { ...admin, organizacoes: [organizacao.id] },
      usuario: { ...usuario, organizacoes: [organizacao.id] },
      pasta,
      pastaSemAtribuicao,
      texto,
      publicacao,
    };
  }

  const a = await montarOrganizacao('Organização A', 'America/Sao_Paulo');
  const b = await montarOrganizacao('Organização B', 'Europe/Madrid');

  const superadmin = await db.user.create({
    data: {
      nome: 'Superadmin',
      username: `super-${randomUUID().slice(0, 8)}`,
      email: `super-${randomUUID()}@exemplo.org`,
      senhaHash: 'x',
      perfil: 'superadmin',
      senhaProvisoria: false,
    },
  });

  return { a, b, superadmin };
}

/** Monta a sessão como a aplicação montaria, a partir do usuário. */
export function sessaoDe(
  usuario: { id: string; perfil: string; organizacoes?: string[] },
  extras: { organizationAtivaId?: string | null; pastasAtribuidas?: string[] } = {},
): Sessao {
  const organizacoes = usuario.organizacoes ?? [];
  return {
    usuarioId: usuario.id,
    perfil: usuario.perfil as Sessao['perfil'],
    organizacoes,
    // Sem escolha explícita, opera a primeira — é o que a aplicação faz.
    organizationAtivaId: extras.organizationAtivaId ?? organizacoes[0] ?? null,
    pastasAtribuidas: extras.pastasAtribuidas ?? [],
  };
}
