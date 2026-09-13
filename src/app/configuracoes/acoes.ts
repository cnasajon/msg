'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirCsrf } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { NaoAutorizado } from '@/lib/erros';
import { registrarAuditoria } from '@/lib/auditoria';
import { comAviso } from '@/lib/navegacao';
import { tradutorDeAvisos } from '@/lib/avisos-servidor';
import { destinoDosAlertas } from '@/lib/alertas';
import { enviarTexto, problemaNoChatId } from '@/lib/telegram';
import { env } from '@/lib/env';

/** As três origens da precedência da seção 7.4, como chave de tradução. */
const CHAVE_DA_ORIGEM = {
  settings: 'origemSettings',
  ambiente: 'origemAmbiente',
  nenhum: 'origemNenhum',
} as const;

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

  const { t, frase } = await tradutorDeAvisos();
  const chatId = String(dados.get('alertsChatId') ?? '').trim();
  const webhook = String(dados.get('googleChatWebhook') ?? '').trim();

  if (chatId) {
    const problema = problemaNoChatId(chatId);
    if (problema) voltar(frase(problema));
  }
  if (webhook && !/^https:\/\/chat\.googleapis\.com\//.test(webhook)) {
    voltar(t('webhookInvalido'));
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
  voltar(t('destinoSalvo'), 'ok');
}

export async function testarCanalDeAlerta(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'alertas.configurarDestino')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();
  const canal = String(dados.get('canal') ?? 'telegram');
  const destino = await destinoDosAlertas(prisma);
  const origemDoChat = t(CHAVE_DA_ORIGEM[destino.origemDoChat]);
  const origemDoWebhook = t(CHAVE_DA_ORIGEM[destino.origemDoWebhook]);

  if (canal === 'telegram') {
    if (!destino.chatId) {
      voltar(t('semDestinoTelegram'));
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
    if (!resposta.ok) voltar(t('publicacaoFalhou', { erro: resposta.erro ?? t('erroDesconhecido') }));
    voltar(t('testeTelegramEnviado', { origem: origemDoChat }), 'ok');
  }

  if (!destino.webhook) {
    voltar(t('semWebhook'));
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
    if (!resposta.ok) voltar(t('googleChatRespondeu', { status: resposta.status }));
  } catch (erro) {
    voltar(
      t('webhookFalhou', { erro: erro instanceof Error ? erro.message : t('erroDesconhecido') }),
    );
  }
  voltar(t('testeGoogleChatEnviado', { origem: origemDoWebhook }), 'ok');
}
