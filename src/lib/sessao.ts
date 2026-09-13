import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { prisma } from './db';
import { env } from './env';
import { NaoAutenticado } from './erros';
import type { Sessao } from './escopo';
import type { Perfil } from './autorizacao';

const COOKIE = 'msg_sessao';
/** Validade real da sessão, controlada pelo banco. */
const DURACAO_HORAS = 12;
/** Renova a validade quando falta menos que isto. */
const RENOVAR_COM_MENOS_DE_HORAS = 4;
/**
 * O cookie vive mais que a sessão de propósito: quem manda é o registro no
 * banco. Renovar a validade a cada uso não pode depender de reescrever o
 * cookie, porque só server action e route handler podem mexer em cookies — no
 * meio de um render, a tentativa derruba a página inteira.
 */
const DURACAO_COOKIE_DIAS = 30;

/**
 * O cookie carrega um token aleatório; o banco guarda apenas o HMAC dele.
 * Vazamento do dump do banco não devolve nenhuma sessão utilizável.
 */
function hashDoToken(token: string): string {
  return createHmac('sha256', env.sessionSecret).update(token).digest('hex');
}

export async function criarSessao(usuarioId: string, organizationAtivaId: string | null) {
  const token = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + DURACAO_HORAS * 3_600_000);

  const cabecalhos = await headers();
  await prisma.session.create({
    data: {
      userId: usuarioId,
      tokenHash: hashDoToken(token),
      organizationAtivaId,
      ip: ipDaRequisicao(cabecalhos),
      userAgent: cabecalhos.get('user-agent')?.slice(0, 300) ?? null,
      expiraEm,
    },
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSeguro,
    sameSite: 'lax',
    path: '/',
    expires: new Date(Date.now() + DURACAO_COOKIE_DIAS * 86_400_000),
  });
  return token;
}

export async function encerrarSessaoAtual() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashDoToken(token) } });
  }
  jar.delete(COOKIE);
}

/** Derruba todas as sessões de um usuário — desativação, troca de senha. */
export async function encerrarSessoesDoUsuario(usuarioId: string) {
  await prisma.session.deleteMany({ where: { userId: usuarioId } });
}

export type SessaoAtual = Sessao & {
  sessaoId: string;
  nome: string;
  username: string;
  senhaProvisoria: boolean;
  idioma: string | null;
};

/** Sessão do pedido em curso, ou `null` se não houver nenhuma válida. */
export async function sessaoAtual(): Promise<SessaoAtual | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const registro = await prisma.session.findUnique({
    where: { tokenHash: hashDoToken(token) },
    include: { user: { include: { folders: { select: { folderId: true } } } } },
  });
  if (!registro) return null;

  if (registro.expiraEm.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: registro.id } }).catch(() => {});
    return null;
  }
  // Usuário desativado perde a sessão na hora, sem esperar a expiração.
  if (!registro.user.ativo) {
    await prisma.session.deleteMany({ where: { userId: registro.userId } });
    return null;
  }

  await renovarSeNecessario(registro.id, registro.expiraEm);

  const perfil = registro.user.perfil as Perfil;
  return {
    sessaoId: registro.id,
    usuarioId: registro.userId,
    perfil,
    organizationId: registro.user.organizationId,
    organizationAtivaId: perfil === 'superadmin' ? registro.organizationAtivaId : null,
    pastasAtribuidas: registro.user.folders.map((f) => f.folderId),
    nome: registro.user.nome,
    username: registro.user.username,
    senhaProvisoria: registro.user.senhaProvisoria,
    idioma: registro.user.idioma,
  };
}

/** Igual a `sessaoAtual`, mas exige sessão — usada por tudo que altera dados. */
export async function exigirSessao(): Promise<SessaoAtual> {
  const sessao = await sessaoAtual();
  if (!sessao) throw new NaoAutenticado();
  return sessao;
}

/** Troca a organização ativa do superadmin, dentro da própria sessão. */
export async function definirOrganizacaoAtiva(sessaoId: string, organizationId: string | null) {
  await prisma.session.update({
    where: { id: sessaoId },
    data: { organizationAtivaId: organizationId },
  });
}

async function renovarSeNecessario(sessaoId: string, expiraEm: Date) {
  const faltando = expiraEm.getTime() - Date.now();
  if (faltando > RENOVAR_COM_MENOS_DE_HORAS * 3_600_000) return;

  // Só o banco: o cookie continua o mesmo e já tem prazo mais longo.
  const nova = new Date(Date.now() + DURACAO_HORAS * 3_600_000);
  await prisma.session.update({ where: { id: sessaoId }, data: { expiraEm: nova } });
}

export function ipDaRequisicao(cabecalhos: Headers): string | null {
  const encaminhado = cabecalhos.get('x-forwarded-for');
  if (encaminhado) return encaminhado.split(',')[0]?.trim() ?? null;
  return cabecalhos.get('x-real-ip');
}

/** Comparação de strings em tempo constante, para segredos curtos. */
export function comparaSegredos(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
