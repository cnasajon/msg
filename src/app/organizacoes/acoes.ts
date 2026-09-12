'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { exigirSessao, definirOrganizacaoAtiva } from '@/lib/sessao';
import { exigirCsrf } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { NaoAutorizado } from '@/lib/erros';
import { comEscopo } from '@/lib/escopo';
import { registrarAuditoria } from '@/lib/auditoria';
import { fusoValido } from '@/lib/fuso';

const IDIOMAS = ['pt', 'es', 'en'] as const;
type Idioma = (typeof IDIOMAS)[number];

function voltar(mensagem: string, tipo: 'erro' | 'ok' = 'erro'): never {
  redirect(`/organizacoes?${tipo}=${encodeURIComponent(mensagem)}`);
}

/** Troca a organização que o superadmin está operando. Fica na auditoria. */
export async function trocarOrganizacaoAtiva(organizationId: string | null) {
  const sessao = await exigirSessao();
  if (!podeFazer(sessao.perfil, 'organizacoes.transitar')) throw new NaoAutorizado();

  // Passa pelo escopo: um identificador qualquer não vira organização ativa.
  const destino = organizationId ? await comEscopo(sessao).organizacao(organizationId) : null;

  await definirOrganizacaoAtiva(sessao.sessaoId, destino?.id ?? null);
  await registrarAuditoria(sessao, {
    acao: 'trocar_organizacao',
    entidade: 'organization',
    entidadeId: destino?.id ?? null,
    organizationId: destino?.id ?? null,
    detalhes: { de: sessao.organizationAtivaId, para: destino?.id ?? null },
  });
  revalidatePath('/', 'layout');
}

export async function criarOrganizacao(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'organizacoes.gerenciar')) throw new NaoAutorizado();

  const nome = String(dados.get('nome') ?? '').trim();
  const idioma = String(dados.get('idiomaPadrao') ?? 'pt') as Idioma;
  const timezone = String(dados.get('timezonePadrao') ?? '').trim();

  if (nome.length < 2) voltar('Informe o nome da organização.');
  if (!IDIOMAS.includes(idioma)) voltar('Idioma inválido.');
  if (!fusoValido(timezone)) voltar(`Fuso horário desconhecido: ${timezone}`);

  const criada = await prisma.organization.create({
    data: { nome, idiomaPadrao: idioma, timezonePadrao: timezone },
  });
  await registrarAuditoria(sessao, {
    acao: 'criar',
    entidade: 'organization',
    entidadeId: criada.id,
    organizationId: criada.id,
    detalhes: { nome, idiomaPadrao: idioma, timezonePadrao: timezone },
  });
  voltar(`Organização "${nome}" criada.`, 'ok');
}

export async function editarOrganizacao(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'organizacoes.gerenciar')) throw new NaoAutorizado();

  const id = String(dados.get('id') ?? '');
  const alvo = await comEscopo(sessao).organizacao(id);

  const nome = String(dados.get('nome') ?? '').trim();
  const idioma = String(dados.get('idiomaPadrao') ?? 'pt') as Idioma;
  const timezone = String(dados.get('timezonePadrao') ?? '').trim();
  const ativa = dados.get('ativa') === 'on';

  if (nome.length < 2) voltar('Informe o nome da organização.');
  if (!IDIOMAS.includes(idioma)) voltar('Idioma inválido.');
  if (!fusoValido(timezone)) voltar(`Fuso horário desconhecido: ${timezone}`);

  await prisma.organization.update({
    where: { id: alvo.id },
    data: { nome, idiomaPadrao: idioma, timezonePadrao: timezone, ativa },
  });
  await registrarAuditoria(sessao, {
    acao: 'editar',
    entidade: 'organization',
    entidadeId: alvo.id,
    organizationId: alvo.id,
    detalhes: { nome, idiomaPadrao: idioma, timezonePadrao: timezone, ativa },
  });
  voltar(`Organização "${nome}" salva.`, 'ok');
}
