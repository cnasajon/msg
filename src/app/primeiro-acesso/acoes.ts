'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirSessao, encerrarSessoesDoUsuario, criarSessao } from '@/lib/sessao';
import { exigirCsrf } from '@/lib/csrf';
import { gerarHashDeSenha, problemaNaSenha, senhaConfere } from '@/lib/senha';
import { registrarAuditoria } from '@/lib/auditoria';

/**
 * Troca obrigatória da senha provisória.
 *
 * Ao final, todas as sessões daquele usuário caem e uma nova é criada: se a
 * senha provisória tiver circulado por aí, quem a tiver deixa de ter acesso.
 */
export async function trocarSenha(dados: FormData) {
  await exigirCsrf(dados);
  const sessao = await exigirSessao();

  const atual = String(dados.get('atual') ?? '');
  const nova = String(dados.get('nova') ?? '');
  const repetida = String(dados.get('repetida') ?? '');

  const usuario = await prisma.user.findUniqueOrThrow({ where: { id: sessao.usuarioId } });

  if (!(await senhaConfere(atual, usuario.senhaHash))) {
    redirect('/primeiro-acesso?erro=' + encodeURIComponent('A senha atual não confere.'));
  }
  if (nova !== repetida) {
    redirect('/primeiro-acesso?erro=' + encodeURIComponent('A confirmação não bate com a nova senha.'));
  }
  const problema = problemaNaSenha(nova);
  if (problema) redirect('/primeiro-acesso?erro=' + encodeURIComponent(problema));
  if (await senhaConfere(nova, usuario.senhaHash)) {
    redirect('/primeiro-acesso?erro=' + encodeURIComponent('A nova senha precisa ser diferente da atual.'));
  }

  await prisma.user.update({
    where: { id: usuario.id },
    data: { senhaHash: await gerarHashDeSenha(nova), senhaProvisoria: false },
  });
  await registrarAuditoria(sessao, {
    acao: 'trocar_senha',
    entidade: 'user',
    entidadeId: usuario.id,
    organizationId: usuario.organizationId,
  });

  await encerrarSessoesDoUsuario(usuario.id);
  await criarSessao(usuario.id, usuario.perfil === 'superadmin' ? null : usuario.organizationId);

  redirect('/inicio');
}
