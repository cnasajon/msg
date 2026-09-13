'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirSessao } from '@/lib/sessao';
import { exigirCsrf } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { NaoAutorizado } from '@/lib/erros';
import { comEscopo, organizacaoEmVigor, type Sessao } from '@/lib/escopo';
import { registrarAuditoria } from '@/lib/auditoria';
import { comAviso } from '@/lib/navegacao';
import { tradutorDeAvisos, type Tradutor } from '@/lib/avisos-servidor';
import type { Problema } from '@/lib/avisos';
import { fusoValido } from '@/lib/fuso';
import { cifrar } from '@/lib/cifra';
import { conferirBot, enviarTexto, problemaNoChatId, tokenDaPasta } from '@/lib/telegram';

function voltar(destino: string, mensagem: string, tipo: 'erro' | 'ok' = 'erro'): never {
  redirect(comAviso(destino, tipo, mensagem));
}

function organizacaoDeDestino(sessao: Sessao, t: Tradutor): string {
  const org = organizacaoEmVigor(sessao);
  if (!org) voltar('/pastas', t('escolhaOrganizacaoPastas'));
  return org;
}

const AO_ESGOTAR = ['parar_notificar', 'reiniciar'] as const;
type AoEsgotar = (typeof AO_ESGOTAR)[number];

function lerCampos(dados: FormData) {
  const nome = String(dados.get('nome') ?? '').trim();
  const descricao = String(dados.get('descricao') ?? '').trim() || null;
  const timezone = String(dados.get('timezone') ?? '').trim();
  const chatIdBruto = String(dados.get('telegramChatId') ?? '').trim();
  const aoEsgotar = String(dados.get('aoEsgotar') ?? 'parar_notificar') as AoEsgotar;
  const ativa = dados.get('ativa') === 'on';
  return { nome, descricao, timezone, chatIdBruto, aoEsgotar, ativa };
}

function validar(
  campos: ReturnType<typeof lerCampos>,
  destino: string,
  t: Tradutor,
  frase: (problema: Problema) => string,
) {
  if (campos.nome.length < 2) voltar(destino, t('informeNomePasta'));
  if (!fusoValido(campos.timezone)) voltar(destino, t('fusoDesconhecido', { fuso: campos.timezone }));
  if (!AO_ESGOTAR.includes(campos.aoEsgotar)) voltar(destino, t('aoEsgotarInvalido'));
  if (campos.chatIdBruto) {
    const problema = problemaNoChatId(campos.chatIdBruto);
    if (problema) voltar(destino, frase(problema));
  }
}

export async function criarPasta(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'pastas.gerenciar')) throw new NaoAutorizado();

  const { t, frase } = await tradutorDeAvisos();
  const campos = lerCampos(dados);
  validar(campos, '/pastas', t, frase);
  const organizationId = organizacaoDeDestino(sessao, t);

  const repetida = await prisma.folder.findFirst({
    where: { organizationId, nome: campos.nome },
    select: { id: true },
  });
  if (repetida) voltar('/pastas', t('pastaRepetida', { nome: campos.nome }));

  const criada = await prisma.folder.create({
    data: {
      organizationId,
      nome: campos.nome,
      descricao: campos.descricao,
      timezone: campos.timezone,
      telegramChatId: campos.chatIdBruto || null,
      aoEsgotar: campos.aoEsgotar,
      ativa: true,
    },
  });
  await registrarAuditoria(sessao, {
    acao: 'criar',
    entidade: 'folder',
    entidadeId: criada.id,
    detalhes: { nome: campos.nome, timezone: campos.timezone, aoEsgotar: campos.aoEsgotar },
  });
  voltar(`/pastas/${criada.id}`, t('pastaCriada', { nome: campos.nome }), 'ok');
}

export async function editarPasta(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'pastas.gerenciar')) throw new NaoAutorizado();

  const { t, frase } = await tradutorDeAvisos();
  const pasta = await comEscopo(sessao).pasta(String(dados.get('id') ?? ''));
  const destino = `/pastas/${pasta.id}`;
  const campos = lerCampos(dados);
  validar(campos, destino, t, frase);

  await prisma.folder.update({
    where: { id: pasta.id },
    data: {
      nome: campos.nome,
      descricao: campos.descricao,
      timezone: campos.timezone,
      telegramChatId: campos.chatIdBruto || null,
      aoEsgotar: campos.aoEsgotar,
      ativa: campos.ativa,
    },
  });
  await registrarAuditoria(sessao, {
    acao: 'editar',
    entidade: 'folder',
    entidadeId: pasta.id,
    detalhes: {
      nome: campos.nome,
      timezone: campos.timezone,
      aoEsgotar: campos.aoEsgotar,
      ativa: campos.ativa,
      chatIdAlterado: campos.chatIdBruto !== (pasta.telegramChatId ?? ''),
    },
  });
  voltar(destino, t('pastaSalva'), 'ok');
}

export async function excluirPasta(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'pastas.gerenciar')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();
  const pasta = await comEscopo(sessao).pasta(String(dados.get('id') ?? ''));
  const publicadas = await prisma.text.count({
    where: { folderId: pasta.id, status: { in: ['publicado', 'erro'] } },
  });
  if (publicadas > 0) {
    voltar(`/pastas/${pasta.id}`, t('pastaComPublicados', { quantidade: publicadas }));
  }

  await prisma.folder.delete({ where: { id: pasta.id } });
  await registrarAuditoria(sessao, {
    acao: 'excluir',
    entidade: 'folder',
    entidadeId: pasta.id,
    detalhes: { nome: pasta.nome },
  });
  voltar('/pastas', t('pastaExcluida', { nome: pasta.nome }), 'ok');
}

/**
 * Token de sobreposição: só o superadmin mexe, o valor é cifrado antes de
 * tocar o banco e nunca volta à tela por inteiro. Campo vazio remove a
 * sobreposição e devolve a pasta ao bot global.
 */
export async function salvarTokenDeSobreposicao(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'pastas.configurarTokenSobreposicao')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();
  const pasta = await comEscopo(sessao).pasta(String(dados.get('id') ?? ''));
  const destino = `/pastas/${pasta.id}`;
  const token = String(dados.get('token') ?? '').trim();

  if (!token) {
    await prisma.folder.update({ where: { id: pasta.id }, data: { telegramBotTokenCifrado: null } });
    await registrarAuditoria(sessao, {
      acao: 'remover_token_sobreposicao',
      entidade: 'folder',
      entidadeId: pasta.id,
    });
    voltar(destino, t('sobreposicaoRemovida'), 'ok');
  }

  if (!/^\d{6,}:[\w-]{30,}$/.test(token)) {
    voltar(destino, t('tokenFormatoInvalido'));
  }
  const conferencia = await conferirBot(token);
  if (!conferencia.ok) {
    voltar(destino, t('tokenRecusado', { erro: conferencia.erro ?? t('erroDesconhecido') }));
  }

  await prisma.folder.update({
    where: { id: pasta.id },
    data: { telegramBotTokenCifrado: cifrar(token) },
  });
  // o token não entra na auditoria, só o fato de ter mudado
  await registrarAuditoria(sessao, {
    acao: 'definir_token_sobreposicao',
    entidade: 'folder',
    entidadeId: pasta.id,
    detalhes: { bot: conferencia.username ?? null },
  });
  voltar(destino, t('sobreposicaoSalva', { bot: conferencia.username ?? '' }), 'ok');
}

/** Envia uma mensagem de teste e mostra o erro exato devolvido pela API. */
export async function testarConexao(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'pastas.configurarChatId')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();
  const pasta = await comEscopo(sessao).pasta(String(dados.get('id') ?? ''));
  const destino = `/pastas/${pasta.id}`;
  if (!pasta.telegramChatId) voltar(destino, t('cadastreChatIdAntesDeTestar'));

  const resultado = await enviarTexto(
    tokenDaPasta(pasta),
    pasta.telegramChatId,
    `<b>msg</b> — teste de conexão da pasta <i>${pasta.nome}</i>.`,
  );

  await registrarAuditoria(sessao, {
    acao: 'testar_conexao',
    entidade: 'folder',
    entidadeId: pasta.id,
    detalhes: { sucesso: resultado.ok },
  });

  // o chat_id vai na mensagem: quando o erro é "chat not found", ver o número
  // que foi tentado costuma ser o bastante para achar o engano
  if (!resultado.ok) {
    voltar(
      destino,
      t('testeFalhou', {
        chatId: pasta.telegramChatId,
        erro: resultado.erro ?? t('erroDesconhecido'),
      }),
    );
  }
  voltar(destino, t('testeEnviado', { chatId: pasta.telegramChatId }), 'ok');
}
