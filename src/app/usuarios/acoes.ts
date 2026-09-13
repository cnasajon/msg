'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirSessao, encerrarSessoesDoUsuario } from '@/lib/sessao';
import { exigirCsrf } from '@/lib/csrf';
import { perfisQuePodeGerenciar, podeFazer, type Perfil } from '@/lib/autorizacao';
import { NaoAutorizado, NaoEncontrado } from '@/lib/erros';
import { comEscopo, escopoDePasta, organizacaoEmVigor, type Sessao } from '@/lib/escopo';
import { gerarHashDeSenha, gerarSenhaProvisoria } from '@/lib/senha';
import { normalizarUsername, problemaNoUsername } from '@/lib/usuario';
import { registrarAuditoria } from '@/lib/auditoria';
import { comAviso } from '@/lib/navegacao';
import { tradutorDeAvisos, type Tradutor } from '@/lib/avisos-servidor';

function voltar(mensagem: string, tipo: 'erro' | 'ok' = 'erro'): never {
  redirect(comAviso('/usuarios', tipo, mensagem));
}

const IDIOMAS = ['pt', 'es', 'en'] as const;

function normalizarTelegram(bruto: string, t: Tradutor): string | null {
  const limpo = bruto.trim().replace(/^@/, '');
  if (!limpo) return null;
  if (!/^[A-Za-z0-9_]{4,32}$/.test(limpo)) voltar(t('telegramInvalido'));
  return `@${limpo}`;
}

function normalizarTelefone(bruto: string, t: Tradutor): string | null {
  const limpo = bruto.trim();
  if (!limpo) return null;
  if (!/^[+()\d\s.-]{6,25}$/.test(limpo)) voltar(t('telefoneInvalido'));
  return limpo;
}

/**
 * Organização onde o novo usuário vai nascer.
 *
 * Nunca vem do formulário: é sempre a organização em vigor na sessão. Sem isso,
 * bastaria alterar um campo escondido para criar um admin em outra organização.
 */
function organizacaoDeDestino(sessao: Sessao, t: Tradutor): string {
  const org = organizacaoEmVigor(sessao);
  if (!org) voltar(t('escolhaOrganizacaoUsuarios'));
  return org;
}

export async function criarUsuario(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'usuarios.gerenciar')) throw new NaoAutorizado();

  const { t, frase } = await tradutorDeAvisos();
  const nome = String(dados.get('nome') ?? '').trim();
  const username = normalizarUsername(String(dados.get('username') ?? ''));
  const email = String(dados.get('email') ?? '').trim().toLowerCase() || null;
  const perfil = String(dados.get('perfil') ?? 'usuario') as Perfil;
  const telefone = normalizarTelefone(String(dados.get('telefone') ?? ''), t);
  const telegram = normalizarTelegram(String(dados.get('telegramUsername') ?? ''), t);

  if (nome.length < 2) voltar(t('informeNome'));
  if (!username) voltar(t('informeUsuario'));
  const problemaDoUsername = problemaNoUsername(username);
  if (problemaDoUsername) voltar(frase(problemaDoUsername));
  // o e-mail virou cadastral: só é conferido quando a pessoa preenche
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) voltar(t('emailInvalido'));
  if (!perfisQuePodeGerenciar(sessao.perfil).includes(perfil)) {
    voltar(t('perfilNaoPermitidoCriar'));
  }

  // Superadmin não pertence a organização; os demais nascem na organização em vigor.
  const organizationId = perfil === 'superadmin' ? null : organizacaoDeDestino(sessao, t);

  const usernameEmUso = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (usernameEmUso) voltar(t('usernameJaExiste'));
  if (email) {
    const emailEmUso = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (emailEmUso) voltar(t('emailJaExiste'));
  }

  const provisoria = gerarSenhaProvisoria();
  const criado = await prisma.user.create({
    data: {
      nome,
      username,
      email,
      telefone,
      telegramUsername: telegram,
      perfil,
      organizationId,
      senhaHash: await gerarHashDeSenha(provisoria),
      senhaProvisoria: true,
    },
  });
  await registrarAuditoria(sessao, {
    acao: 'criar',
    entidade: 'user',
    entidadeId: criado.id,
    organizationId,
    detalhes: { nome, username, perfil },
  });

  // A senha provisória aparece uma única vez, para ser repassada à pessoa.
  // Não é guardada em lugar nenhum além do hash.
  voltar(t('usuarioCriado', { nome: username, senha: provisoria }), 'ok');
}

export async function editarUsuario(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'usuarios.gerenciar')) throw new NaoAutorizado();

  const { t, frase } = await tradutorDeAvisos();
  const alvo = await comEscopo(sessao).usuario(String(dados.get('id') ?? ''));

  const nome = String(dados.get('nome') ?? '').trim();
  const username = normalizarUsername(String(dados.get('username') ?? ''));
  const email = String(dados.get('email') ?? '').trim().toLowerCase() || null;
  const telefone = normalizarTelefone(String(dados.get('telefone') ?? ''), t);
  const telegram = normalizarTelegram(String(dados.get('telegramUsername') ?? ''), t);
  const idiomaBruto = String(dados.get('idioma') ?? '');
  const idioma = IDIOMAS.includes(idiomaBruto as never) ? (idiomaBruto as 'pt' | 'es' | 'en') : null;
  const ativo = dados.get('ativo') === 'on';
  const perfilBruto = String(dados.get('perfil') ?? alvo.perfil) as Perfil;

  if (nome.length < 2) voltar(t('informeNome'));
  if (!username) voltar(t('informeUsuario'));
  const problemaDoUsername = problemaNoUsername(username);
  if (problemaDoUsername) voltar(frase(problemaDoUsername));
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) voltar(t('emailInvalido'));

  if (username !== alvo.username) {
    const emUso = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (emUso) voltar(t('usernameJaExiste'));
  }
  if (email && email !== alvo.email) {
    const emUso = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (emUso) voltar(t('emailJaExiste'));
  }
  if (perfilBruto !== alvo.perfil && !perfisQuePodeGerenciar(sessao.perfil).includes(perfilBruto)) {
    voltar(t('perfilNaoPermitidoAtribuir'));
  }
  if (alvo.id === sessao.usuarioId && !ativo) voltar(t('naoDesativeSuaConta'));

  await prisma.user.update({
    where: { id: alvo.id },
    data: { nome, username, email, telefone, telegramUsername: telegram, idioma, ativo, perfil: perfilBruto },
  });
  // Conta desativada não pode continuar navegando com a sessão que já tinha.
  if (!ativo) await encerrarSessoesDoUsuario(alvo.id);

  await registrarAuditoria(sessao, {
    acao: 'editar',
    entidade: 'user',
    entidadeId: alvo.id,
    organizationId: alvo.organizationId,
    detalhes: { nome, username, perfil: perfilBruto, ativo },
  });
  voltar(t('usuarioSalvo', { nome: username }), 'ok');
}

export async function redefinirSenha(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'usuarios.redefinirSenha')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();
  const alvo = await comEscopo(sessao).usuario(String(dados.get('id') ?? ''));
  const provisoria = gerarSenhaProvisoria();

  await prisma.user.update({
    where: { id: alvo.id },
    data: { senhaHash: await gerarHashDeSenha(provisoria), senhaProvisoria: true },
  });
  await encerrarSessoesDoUsuario(alvo.id);

  await registrarAuditoria(sessao, {
    acao: 'redefinir_senha',
    entidade: 'user',
    entidadeId: alvo.id,
    organizationId: alvo.organizationId,
  });
  voltar(t('novaSenhaProvisoria', { nome: alvo.username, senha: provisoria }), 'ok');
}

/**
 * Atribuição de pastas ao perfil `usuario`.
 *
 * As pastas recebidas do formulário são filtradas pelo escopo da sessão antes
 * de gravar: uma pasta de outra organização simplesmente não sobrevive ao
 * filtro, mesmo que alguém a injete no formulário.
 */
export async function atribuirPastas(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'usuarios.atribuirPastas')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();
  const alvo = await comEscopo(sessao).usuario(String(dados.get('id') ?? ''));
  const pedidas = dados.getAll('pastas').map(String);

  const permitidas = await prisma.folder.findMany({
    where: { AND: [{ id: { in: pedidas } }, escopoDePasta(sessao), { organizationId: alvo.organizationId ?? '' }] },
    select: { id: true },
  });
  if (permitidas.length !== pedidas.length) {
    voltar(t('pastaForaDaOrganizacao'));
  }

  await prisma.$transaction([
    prisma.userFolder.deleteMany({ where: { userId: alvo.id } }),
    prisma.userFolder.createMany({
      data: permitidas.map((p) => ({ userId: alvo.id, folderId: p.id })),
    }),
  ]);

  await registrarAuditoria(sessao, {
    acao: 'atribuir_pastas',
    entidade: 'user',
    entidadeId: alvo.id,
    organizationId: alvo.organizationId,
    detalhes: { pastas: permitidas.map((p) => p.id) },
  });
  voltar(t('pastasAtualizadas', { nome: alvo.nome }), 'ok');
}

export async function exigirUsuarioNoEscopo(sessao: Sessao, id: string) {
  try {
    return await comEscopo(sessao).usuario(id);
  } catch {
    throw new NaoEncontrado('Usuário');
  }
}
