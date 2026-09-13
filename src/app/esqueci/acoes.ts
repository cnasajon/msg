'use server';

import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { ipDaRequisicao } from '@/lib/sessao';
import { permitePedidoDeSenha } from '@/lib/rate-limit';
import { normalizarUsername } from '@/lib/usuario';
import { alertar } from '@/lib/alertas';
import { fraseNoIdioma } from '@/lib/mensagens';
import { problema } from '@/lib/avisos';

/** Como no login, o erro volta como chave de tradução, não como texto. */
export type EstadoDoPedido = { erro?: string; enviado?: boolean };

/**
 * Pedido de redefinição de senha.
 *
 * Não existe envio de e-mail neste sistema, então o pedido não entrega nada a
 * quem o fez: ele avisa os administradores pelo grupo de alertas do Telegram e
 * pelo painel, e o admin redefine a senha pela tela de usuários.
 *
 * A resposta é sempre a mesma, exista a conta ou não. Um formulário público que
 * responde "este usuário não existe" é um descobridor de contas cadastradas.
 */
export async function pedirRedefinicao(
  _estado: EstadoDoPedido,
  dados: FormData,
): Promise<EstadoDoPedido> {
  const username = normalizarUsername(String(dados.get('username') ?? ''));
  const ip = ipDaRequisicao(await headers());

  if (!username) return { erro: 'informeOUsuario' };
  if (!permitePedidoDeSenha(ip, username)) return { erro: 'tentativasDemais' };

  const usuario = await prisma.user.findUnique({
    where: { username },
    select: { id: true, nome: true, username: true, ativo: true, organizationId: true },
  });

  // Conta inexistente ou desativada sai por aqui, com a mesma resposta de
  // sucesso: quem pediu não fica sabendo a diferença.
  if (usuario?.ativo) {
    const organizacao = usuario.organizationId
      ? await prisma.organization.findUnique({
          where: { id: usuario.organizationId },
          select: { nome: true, idiomaPadrao: true },
        })
      : null;

    await alertar(prisma, {
      tipo: 'senha_esquecida',
      organizationId: usuario.organizationId,
      chave: usuario.username,
      // uma vez por hora por conta: o pedido repetido não vira enxurrada no grupo
      repetirAposHoras: 1,
      mensagem: fraseNoIdioma(
        problema('alertaSenhaEsquecida', {
          nome: usuario.nome,
          usuario: usuario.username,
          organizacao: organizacao?.nome ?? '—',
        }),
        organizacao?.idiomaPadrao,
      ),
    });
  }

  return { enviado: true };
}
