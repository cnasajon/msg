'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirSessao, encerrarSessoesDoUsuario, criarSessao } from '@/lib/sessao';
import { exigirCsrf } from '@/lib/csrf';
import { gerarHashDeSenha, problemaNaSenha, senhaConfere } from '@/lib/senha';
import { registrarAuditoria } from '@/lib/auditoria';
import { comAviso } from '@/lib/navegacao';
import { organizacaoEmVigor } from '@/lib/escopo';
import { tradutorDeAvisos, type Tradutor } from '@/lib/avisos-servidor';

function voltar(mensagem: string, tipo: 'erro' | 'ok' = 'erro'): never {
  redirect(comAviso('/perfil', tipo, mensagem));
}

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
 * Dados cadastrais que a própria pessoa mantém.
 *
 * Nome, perfil, situação e pastas ficam de fora de propósito: quem define o que
 * alguém **é** no sistema é quem administra, não a própria pessoa. Aqui ficam os
 * dados de contato, que são dela.
 *
 * O alvo nunca vem do formulário — é sempre `sessao.usuarioId`. Sem isso, um
 * campo escondido editaria o cadastro de qualquer um.
 */
export async function salvarMeuCadastro(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  const { t } = await tradutorDeAvisos();

  const email = String(dados.get('email') ?? '').trim().toLowerCase() || null;
  const telefone = normalizarTelefone(String(dados.get('telefone') ?? ''), t);
  const telegram = normalizarTelegram(String(dados.get('telegramUsername') ?? ''), t);

  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) voltar(t('emailInvalido'));

  if (email) {
    const emUso = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (emUso && emUso.id !== sessao.usuarioId) voltar(t('emailJaExiste'));
  }

  await prisma.user.update({
    where: { id: sessao.usuarioId },
    data: { email, telefone, telegramUsername: telegram },
  });

  await registrarAuditoria(sessao, {
    acao: 'editar',
    entidade: 'user',
    entidadeId: sessao.usuarioId,
    detalhes: { proprioCadastro: true, email, telefone, telegram },
  });
  voltar(t('cadastroSalvo'), 'ok');
}

/**
 * Troca da própria senha.
 *
 * Exige a senha atual mesmo com a sessão já aberta: uma tela deixada aberta não
 * pode virar troca de senha por quem passar pelo computador.
 *
 * Ao final todas as sessões caem e uma nova nasce — inclusive a de quem está
 * trocando, que continua navegando. Quem estiver com a senha antiga em outro
 * dispositivo perde o acesso, que é justamente o motivo de alguém trocar.
 */
export async function trocarMinhaSenha(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  const { t, frase } = await tradutorDeAvisos();

  const atual = String(dados.get('atual') ?? '');
  const nova = String(dados.get('nova') ?? '');
  const repetida = String(dados.get('repetida') ?? '');

  const usuario = await prisma.user.findUniqueOrThrow({ where: { id: sessao.usuarioId } });

  if (!(await senhaConfere(atual, usuario.senhaHash))) voltar(t('senhaAtualNaoConfere'));
  if (nova !== repetida) voltar(t('confirmacaoNaoBate'));
  const problema = problemaNaSenha(nova);
  if (problema) voltar(frase(problema));
  if (await senhaConfere(nova, usuario.senhaHash)) voltar(t('senhaIgualAAtual'));

  await prisma.user.update({
    where: { id: usuario.id },
    data: { senhaHash: await gerarHashDeSenha(nova), senhaProvisoria: false },
  });
  await registrarAuditoria(sessao, {
    acao: 'trocar_senha',
    entidade: 'user',
    entidadeId: usuario.id,
    organizationId: organizacaoEmVigor(sessao),
  });

  await encerrarSessoesDoUsuario(usuario.id);
  // A nova sessão nasce operando a mesma organização de antes.
  await criarSessao(usuario.id, sessao.organizationAtivaId);

  voltar(t('senhaTrocada'), 'ok');
}
