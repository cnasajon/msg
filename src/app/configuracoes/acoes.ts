'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirCsrf } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { NaoAutorizado } from '@/lib/erros';
import { registrarAuditoria } from '@/lib/auditoria';
import { comAviso } from '@/lib/navegacao';
import { destinoDosAlertas } from '@/lib/alertas';
import { enviarTexto, problemaNoChatId } from '@/lib/telegram';
import { env } from '@/lib/env';

function voltar(mensagem: string, tipo: 'erro' | 'ok' = 'erro'): never {
  redirect(comAviso('/configuracoes', tipo, mensagem));
}

/**
 * Destino dos alertas. Campo vazio nao e erro: significa "cai para a variavel
 * de ambiente, e se ela tambem estiver vazia, so log e painel" — a precedencia
 * da secao 7.4.
 */
export async function salvarDestinoDosAlertas(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'alertas.configurarDestino')) throw new NaoAutorizado();

  const chatId = String(dados.get('alertsChatId') ?? '').trim();
  const webhook = String(dados.get('googleChatWebhook') ?? '').trim();

  if (chatId) {
    const problema = problemaNoChatId(chatId);
    if (problema) voltar(problema);
  }
  if (webhook && !/^https:\/\/chat\.googleapis\.com\//.test(webhook)) {
    voltar('O webhook do Google Chat comeca com https://chat.googleapis.com/ — confira o endereco copiado.');
  }

  await prisma.settings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      alertsChatId: chatId || null,
      googleChatWebhook: webhook || null,
      atualizadoPor: sessao.usuarioId,
    },
    update: {
      alertsChatId: chatId || null,
      googleChatWebhook: webhook || null,
      atualizadoPor: sessao.usuarioId,
    },
  });

  // o valor nao entra na auditoria, so o fato de ter mudado
  await registrarAuditoria(sessao, {
    acao: 'editar',
    entidade: 'settings',
    entidadeId: 'singleton',
    detalhes: { chatIdDefinido: chatId !== '', webhookDefinido: webhook !== '' },
  });
  voltar('Destino dos alertas salvo.', 'ok');
}

export async function testarCanalDeAlerta(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'alertas.configurarDestino')) throw new NaoAutorizado();

  const canal = String(dados.get('canal') ?? 'telegram');
  const destino = await destinoDosAlertas(prisma);

  if (canal === 'telegram') {
    if (!destino.chatId) {
      voltar('Sem destino no Telegram: nem o campo acima nem ALERTS_CHAT_ID estao preenchidos. Os alertas ficam no log e no painel.');
    }
    const resposta = await enviarTexto(
      env.telegramBotToken,
      destino.chatId,
      '<b>msg</b> — alerta de teste. Se voce recebeu isto, o canal esta funcionando.',
    );
    await registrarAuditoria(sessao, {
      acao: 'testar_alerta',
      entidade: 'settings',
      detalhes: { canal: 'telegram', sucesso: resposta.ok, origem: destino.origemDoChat },
    });
    if (!resposta.ok) voltar(`Falhou: ${resposta.erro}`);
    voltar(`Alerta de teste enviado ao Telegram (destino vindo de ${destino.origemDoChat}).`, 'ok');
  }

  if (!destino.webhook) {
    voltar('Sem webhook do Google Chat configurado, nem no campo acima nem em GOOGLE_CHAT_WEBHOOK.');
  }
  try {
    const resposta = await fetch(destino.webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'msg — alerta de teste. Se voce recebeu isto, o canal esta funcionando.' }),
      signal: AbortSignal.timeout(15_000),
    });
    await registrarAuditoria(sessao, {
      acao: 'testar_alerta',
      entidade: 'settings',
      detalhes: { canal: 'google_chat', sucesso: resposta.ok, origem: destino.origemDoWebhook },
    });
    if (!resposta.ok) voltar(`O Google Chat respondeu ${resposta.status}.`);
  } catch (erro) {
    voltar(`Falhou ao chamar o webhook: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`);
  }
  voltar(`Alerta de teste enviado ao Google Chat (destino vindo de ${destino.origemDoWebhook}).`, 'ok');
}
