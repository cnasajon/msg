'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { senhaConfere } from '@/lib/senha';
import { criarSessao, ipDaRequisicao } from '@/lib/sessao';
import { permiteTentativaDeLogin, limparTentativas } from '@/lib/rate-limit';
import { registrarAuditoria } from '@/lib/auditoria';

/**
 * O erro volta como **chave** de tradução, não como texto: a ação roda no
 * servidor e não sabe em que idioma a tela está.
 */
export type EstadoDoLogin = { erro?: string };

/**
 * Entrada no sistema.
 *
 * A mensagem de erro é sempre a mesma, dê no que der: e-mail inexistente,
 * senha errada ou conta desativada. Diferenciar entregaria a quem tenta de fora
 * a informação de quais e-mails existem.
 */
export async function entrar(_estado: EstadoDoLogin, dados: FormData): Promise<EstadoDoLogin> {
  const email = String(dados.get('email') ?? '').trim().toLowerCase();
  const senha = String(dados.get('senha') ?? '');
  const ip = ipDaRequisicao(await headers());

  if (!email || !senha) return { erro: 'informeOsDois' };

  if (!permiteTentativaDeLogin(ip, email)) {
    return { erro: 'tentativasDemais' };
  }

  const usuario = await prisma.user.findUnique({ where: { email } });
  const generico = { erro: 'credenciaisInvalidas' };

  if (!usuario || !usuario.ativo) {
    // Gasta o mesmo tempo de um hash real, para não denunciar pelo relógio
    // quais e-mails existem.
    await senhaConfere(senha, '$argon2id$v=19$m=19456,t=2,p=1$c2FsZ2Fkb2Rlbm9uY2E$0000000000000000000000000000000000000000000');
    return generico;
  }
  if (!(await senhaConfere(senha, usuario.senhaHash))) return generico;

  limparTentativas(ip, email);

  // O superadmin entra sem organização ativa e escolhe uma; os demais já vêm
  // presos à sua.
  const organizacaoAtiva = usuario.perfil === 'superadmin' ? null : usuario.organizationId;

  await criarSessao(usuario.id, organizacaoAtiva);
  await prisma.user.update({ where: { id: usuario.id }, data: { ultimoLoginEm: new Date() } });
  await registrarAuditoria(null, {
    acao: 'login',
    entidade: 'user',
    entidadeId: usuario.id,
    organizationId: usuario.organizationId,
    ip,
  });

  redirect(usuario.senhaProvisoria ? '/primeiro-acesso' : '/inicio');
}
