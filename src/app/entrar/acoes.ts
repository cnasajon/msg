'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { senhaConfere } from '@/lib/senha';
import { criarSessao, ipDaRequisicao } from '@/lib/sessao';
import { permiteTentativaDeLogin, limparTentativas } from '@/lib/rate-limit';
import { normalizarUsername } from '@/lib/usuario';
import { bancoDesatualizado } from '@/lib/migracoes';
import { ultimaOrganizacaoValida } from '@/lib/organizacao-lembrada';
import { registrarAuditoria } from '@/lib/auditoria';

/**
 * O erro volta como **chave** de tradução, não como texto: a ação roda no
 * servidor e não sabe em que idioma a tela está.
 */
export type EstadoDoLogin = { erro?: string };

/**
 * Entrada no sistema.
 *
 * A mensagem de erro é sempre a mesma, dê no que der: usuário inexistente,
 * senha errada ou conta desativada. Diferenciar entregaria a quem tenta de fora
 * a informação de quais usuários existem.
 */
export async function entrar(_estado: EstadoDoLogin, dados: FormData): Promise<EstadoDoLogin> {
  const username = normalizarUsername(String(dados.get('username') ?? ''));
  const senha = String(dados.get('senha') ?? '');
  const ip = ipDaRequisicao(await headers());

  if (!username || !senha) return { erro: 'informeOsDois' };

  if (!permiteTentativaDeLogin(ip, username)) {
    return { erro: 'tentativasDemais' };
  }

  // O banco pode estar atrás do código quando a migração não rodou no deploy.
  // Sem este tratamento, o Prisma sobe um erro cru e a pessoa vê a tela genérica
  // de falha — sem nenhuma pista de que faltou `npm run migrate:deploy`.
  let usuario;
  try {
    usuario = await prisma.user.findUnique({
      where: { username },
      include: { organizacoes: { select: { organizationId: true } } },
    });
  } catch (erro) {
    if (bancoDesatualizado(erro)) return { erro: 'bancoDesatualizado' };
    throw erro;
  }
  const generico = { erro: 'credenciaisInvalidas' };

  if (!usuario || !usuario.ativo) {
    // Gasta o mesmo tempo de um hash real, para não denunciar pelo relógio
    // quais usuários existem.
    await senhaConfere(senha, '$argon2id$v=19$m=19456,t=2,p=1$c2FsZ2Fkb2Rlbm9uY2E$0000000000000000000000000000000000000000000');
    return generico;
  }
  if (!(await senhaConfere(senha, usuario.senhaHash))) return generico;

  limparTentativas(ip, username);

  // Retoma a última organização operada, se ela ainda servir. Para quem
  // participa de várias isso evita recomeçar na escolha; para quem participa de
  // uma só, `organizacaoEmVigor` cai nela de qualquer jeito.
  const organizacaoAtiva = await ultimaOrganizacaoValida(
    usuario.ultimaOrganizacaoId,
    usuario.perfil === 'superadmin' ? null : usuario.organizacoes.map((o) => o.organizationId),
  );

  await criarSessao(usuario.id, organizacaoAtiva);
  await prisma.user.update({ where: { id: usuario.id }, data: { ultimoLoginEm: new Date() } });
  await registrarAuditoria(null, {
    acao: 'login',
    entidade: 'user',
    entidadeId: usuario.id,
    organizationId: organizacaoAtiva,
    ip,
  });

  redirect(usuario.senhaProvisoria ? '/primeiro-acesso' : '/inicio');
}
