'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirSessao, encerrarSessoesDoUsuario } from '@/lib/sessao';
import { exigirCsrf } from '@/lib/csrf';
import { perfisQuePodeGerenciar, podeFazer, type Perfil } from '@/lib/autorizacao';
import { NaoAutorizado, NaoEncontrado } from '@/lib/erros';
import { comEscopo, escopoDePasta, organizacaoEmVigor, type Sessao } from '@/lib/escopo';
import { gerarHashDeSenha, gerarSenhaProvisoria } from '@/lib/senha';
import { registrarAuditoria } from '@/lib/auditoria';
import { comAviso } from '@/lib/navegacao';

function voltar(mensagem: string, tipo: 'erro' | 'ok' = 'erro'): never {
  redirect(comAviso('/usuarios', tipo, mensagem));
}

const IDIOMAS = ['pt', 'es', 'en'] as const;

function normalizarTelegram(bruto: string): string | null {
  const limpo = bruto.trim().replace(/^@/, '');
  if (!limpo) return null;
  if (!/^[A-Za-z0-9_]{4,32}$/.test(limpo)) {
    voltar('Usuário do Telegram inválido: use de 4 a 32 letras, números ou _ (com ou sem @).');
  }
  return `@${limpo}`;
}

function normalizarTelefone(bruto: string): string | null {
  const limpo = bruto.trim();
  if (!limpo) return null;
  if (!/^[+()\d\s.-]{6,25}$/.test(limpo)) voltar('Telefone inválido.');
  return limpo;
}

/**
 * Organização onde o novo usuário vai nascer.
 *
 * Nunca vem do formulário: é sempre a organização em vigor na sessão. Sem isso,
 * bastaria alterar um campo escondido para criar um admin em outra organização.
 */
function organizacaoDeDestino(sessao: Sessao): string {
  const org = organizacaoEmVigor(sessao);
  if (!org) voltar('Escolha uma organização ativa antes de gerenciar usuários.');
  return org;
}

export async function criarUsuario(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'usuarios.gerenciar')) throw new NaoAutorizado();

  const nome = String(dados.get('nome') ?? '').trim();
  const email = String(dados.get('email') ?? '').trim().toLowerCase();
  const perfil = String(dados.get('perfil') ?? 'usuario') as Perfil;
  const telefone = normalizarTelefone(String(dados.get('telefone') ?? ''));
  const telegram = normalizarTelegram(String(dados.get('telegramUsername') ?? ''));

  if (nome.length < 2) voltar('Informe o nome.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) voltar('E-mail inválido.');
  if (!perfisQuePodeGerenciar(sessao.perfil).includes(perfil)) {
    voltar('Você não pode criar um usuário com este perfil.');
  }

  // Superadmin não pertence a organização; os demais nascem na organização em vigor.
  const organizationId = perfil === 'superadmin' ? null : organizacaoDeDestino(sessao);

  const jaExiste = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (jaExiste) voltar('Já existe um usuário com este e-mail.');

  const provisoria = gerarSenhaProvisoria();
  const criado = await prisma.user.create({
    data: {
      nome,
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
    detalhes: { nome, email, perfil },
  });

  // A senha provisória aparece uma única vez, para ser repassada à pessoa.
  // Não é guardada em lugar nenhum além do hash.
  voltar(`Usuário "${nome}" criado. Senha provisória: ${provisoria} — anote agora, ela não será mostrada de novo.`, 'ok');
}

export async function editarUsuario(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'usuarios.gerenciar')) throw new NaoAutorizado();

  const alvo = await comEscopo(sessao).usuario(String(dados.get('id') ?? ''));

  const nome = String(dados.get('nome') ?? '').trim();
  const telefone = normalizarTelefone(String(dados.get('telefone') ?? ''));
  const telegram = normalizarTelegram(String(dados.get('telegramUsername') ?? ''));
  const idiomaBruto = String(dados.get('idioma') ?? '');
  const idioma = IDIOMAS.includes(idiomaBruto as never) ? (idiomaBruto as 'pt' | 'es' | 'en') : null;
  const ativo = dados.get('ativo') === 'on';
  const perfilBruto = String(dados.get('perfil') ?? alvo.perfil) as Perfil;

  if (nome.length < 2) voltar('Informe o nome.');
  if (perfilBruto !== alvo.perfil && !perfisQuePodeGerenciar(sessao.perfil).includes(perfilBruto)) {
    voltar('Você não pode atribuir este perfil.');
  }
  if (alvo.id === sessao.usuarioId && !ativo) voltar('Você não pode desativar a própria conta.');

  await prisma.user.update({
    where: { id: alvo.id },
    data: { nome, telefone, telegramUsername: telegram, idioma, ativo, perfil: perfilBruto },
  });
  // Conta desativada não pode continuar navegando com a sessão que já tinha.
  if (!ativo) await encerrarSessoesDoUsuario(alvo.id);

  await registrarAuditoria(sessao, {
    acao: 'editar',
    entidade: 'user',
    entidadeId: alvo.id,
    organizationId: alvo.organizationId,
    detalhes: { nome, perfil: perfilBruto, ativo },
  });
  voltar(`Usuário "${nome}" salvo.`, 'ok');
}

export async function redefinirSenha(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'usuarios.redefinirSenha')) throw new NaoAutorizado();

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
  voltar(`Nova senha provisória de ${alvo.nome}: ${provisoria} — anote agora, ela não será mostrada de novo.`, 'ok');
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

  const alvo = await comEscopo(sessao).usuario(String(dados.get('id') ?? ''));
  const pedidas = dados.getAll('pastas').map(String);

  const permitidas = await prisma.folder.findMany({
    where: { AND: [{ id: { in: pedidas } }, escopoDePasta(sessao), { organizationId: alvo.organizationId ?? '' }] },
    select: { id: true },
  });
  if (permitidas.length !== pedidas.length) {
    voltar('Uma das pastas escolhidas não pertence à organização deste usuário.');
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
  voltar(`Pastas de ${alvo.nome} atualizadas.`, 'ok');
}

export async function exigirUsuarioNoEscopo(sessao: Sessao, id: string) {
  try {
    return await comEscopo(sessao).usuario(id);
  } catch {
    throw new NaoEncontrado('Usuário');
  }
}
