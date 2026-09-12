'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirCsrf } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { NaoAutorizado } from '@/lib/erros';
import { comEscopo, escopoDeTexto } from '@/lib/escopo';
import { registrarAuditoria } from '@/lib/auditoria';
import { comAviso } from '@/lib/navegacao';
import { hashDoConteudo, problemaNoHtml, problemaNoTamanho } from '@/lib/textos';
import { ImagemInvalida, processarImagem } from '@/lib/imagem';

function voltar(destino: string, mensagem: string, tipo: 'erro' | 'ok' = 'erro'): never {
  redirect(comAviso(destino, tipo, mensagem));
}

/** Próxima posição da fila: depois do último texto da pasta. */
async function proximaOrdem(folderId: string): Promise<number> {
  const ultimo = await prisma.text.findFirst({
    where: { folderId },
    orderBy: { ordem: 'desc' },
    select: { ordem: true },
  });
  return (ultimo?.ordem ?? 0) + 1;
}

type ImagemDoFormulario =
  | { tipo: 'manter' }
  | { tipo: 'remover' }
  | { tipo: 'nova'; arquivo: File };

function lerImagem(dados: FormData): ImagemDoFormulario {
  if (dados.get('removerImagem') === 'on') return { tipo: 'remover' };
  const arquivo = dados.get('imagem');
  if (arquivo instanceof File && arquivo.size > 0) return { tipo: 'nova', arquivo };
  return { tipo: 'manter' };
}

export async function criarTexto(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'textos.gerenciar')) throw new NaoAutorizado();

  const pasta = await comEscopo(sessao).pasta(String(dados.get('folderId') ?? ''));
  const destino = `/textos?pasta=${pasta.id}`;
  const conteudo = String(dados.get('conteudo') ?? '').trim();
  const imagem = lerImagem(dados);

  const problemaTamanho = problemaNoTamanho(conteudo, imagem.tipo === 'nova');
  if (problemaTamanho) voltar(destino, problemaTamanho);
  const problemaHtml = problemaNoHtml(conteudo);
  if (problemaHtml) voltar(destino, problemaHtml);

  const hash = hashDoConteudo(conteudo);
  const duplicado = await prisma.text.findFirst({
    where: { folderId: pasta.id, hashConteudo: hash },
    select: { id: true },
  });
  if (duplicado) voltar(destino, 'Esta pasta já tem um texto com exatamente este conteúdo.');

  let processada = null;
  if (imagem.tipo === 'nova') {
    try {
      processada = await processarImagem(imagem.arquivo);
    } catch (erro) {
      voltar(destino, erro instanceof ImagemInvalida ? erro.message : 'Não foi possível processar a imagem.');
    }
  }

  const criado = await prisma.text.create({
    data: {
      folderId: pasta.id,
      conteudo,
      ordem: await proximaOrdem(pasta.id),
      hashConteudo: hash,
      criadoPor: sessao.usuarioId,
      ...(processada
        ? {
            imagem: processada.dados,
            imagemMime: processada.mime,
            imagemBytes: processada.bytes,
            imagemNomeOriginal: imagem.tipo === 'nova' ? imagem.arquivo.name.slice(0, 200) : null,
          }
        : {}),
    },
  });

  await registrarAuditoria(sessao, {
    acao: 'criar',
    entidade: 'text',
    entidadeId: criado.id,
    detalhes: { pasta: pasta.nome, comImagem: !!processada },
  });
  voltar(destino, 'Texto criado.', 'ok');
}

export async function editarTexto(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'textos.gerenciar')) throw new NaoAutorizado();

  const texto = await comEscopo(sessao).texto(String(dados.get('id') ?? ''));
  const destino = `/textos/${texto.id}`;
  const conteudo = String(dados.get('conteudo') ?? '').trim();
  const imagem = lerImagem(dados);

  const ficaComImagem =
    imagem.tipo === 'nova' ? true : imagem.tipo === 'remover' ? false : texto.imagem !== null;

  const problemaTamanho = problemaNoTamanho(conteudo, ficaComImagem);
  if (problemaTamanho) voltar(destino, problemaTamanho);
  const problemaHtml = problemaNoHtml(conteudo);
  if (problemaHtml) voltar(destino, problemaHtml);

  const hash = hashDoConteudo(conteudo);
  if (hash !== texto.hashConteudo) {
    const duplicado = await prisma.text.findFirst({
      where: { folderId: texto.folderId, hashConteudo: hash, id: { not: texto.id } },
      select: { id: true },
    });
    if (duplicado) voltar(destino, 'Esta pasta já tem outro texto com exatamente este conteúdo.');
  }

  let camposDaImagem = {};
  if (imagem.tipo === 'remover') {
    camposDaImagem = { imagem: null, imagemMime: null, imagemBytes: null, imagemNomeOriginal: null };
  } else if (imagem.tipo === 'nova') {
    try {
      const processada = await processarImagem(imagem.arquivo);
      camposDaImagem = {
        imagem: processada.dados,
        imagemMime: processada.mime,
        imagemBytes: processada.bytes,
        imagemNomeOriginal: imagem.arquivo.name.slice(0, 200),
      };
    } catch (erro) {
      voltar(destino, erro instanceof ImagemInvalida ? erro.message : 'Não foi possível processar a imagem.');
    }
  }

  await prisma.text.update({
    where: { id: texto.id },
    data: { conteudo, hashConteudo: hash, ...camposDaImagem },
  });
  await registrarAuditoria(sessao, {
    acao: 'editar',
    entidade: 'text',
    entidadeId: texto.id,
    detalhes: { imagem: imagem.tipo },
  });
  voltar(destino, 'Texto salvo.', 'ok');
}

export async function arquivarTexto(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'textos.gerenciar')) throw new NaoAutorizado();

  const texto = await comEscopo(sessao).texto(String(dados.get('id') ?? ''));
  const destino = String(dados.get('destino') ?? `/textos?pasta=${texto.folderId}`);

  await prisma.text.update({
    where: { id: texto.id },
    data: { status: 'arquivado', arquivadoEm: new Date() },
  });
  await registrarAuditoria(sessao, { acao: 'arquivar', entidade: 'text', entidadeId: texto.id });
  voltar(destino, 'Texto arquivado.', 'ok');
}

export async function desarquivarTexto(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'textos.gerenciar')) throw new NaoAutorizado();

  const texto = await comEscopo(sessao).texto(String(dados.get('id') ?? ''));
  const destino = String(dados.get('destino') ?? `/textos?pasta=${texto.folderId}`);

  // Texto que já foi ao ar volta para `publicado`, não para a fila: republicar
  // é uma decisão consciente, não efeito colateral de desarquivar.
  const status = texto.publicadoEm ? 'publicado' : 'pendente';
  await prisma.text.update({
    where: { id: texto.id },
    data: { status, arquivadoEm: null, ordem: status === 'pendente' ? await proximaOrdem(texto.folderId) : texto.ordem },
  });
  await registrarAuditoria(sessao, {
    acao: 'desarquivar',
    entidade: 'text',
    entidadeId: texto.id,
    detalhes: { voltouPara: status },
  });
  voltar(destino, status === 'pendente' ? 'Texto devolvido ao fim da fila.' : 'Texto desarquivado.', 'ok');
}

export async function excluirTexto(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'textos.gerenciar')) throw new NaoAutorizado();

  const texto = await comEscopo(sessao).texto(String(dados.get('id') ?? ''));
  const destino = `/textos?pasta=${texto.folderId}`;

  // A publicação guarda o que foi ao ar, então o histórico sobrevive.
  await prisma.text.delete({ where: { id: texto.id } });
  await registrarAuditoria(sessao, {
    acao: 'excluir',
    entidade: 'text',
    entidadeId: texto.id,
    detalhes: { status: texto.status },
  });
  voltar(destino, 'Texto excluído. O histórico das publicações foi preservado.', 'ok');
}

/**
 * Reordenação da fila.
 *
 * Recebe a ordem inteira dos pendentes e grava numa transação. Os
 * identificadores passam pelo escopo antes: a lista vem do navegador, e um id
 * de outra pasta ali dentro não pode virar uma escrita.
 */
export async function reordenarFila(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'textos.reordenar')) throw new NaoAutorizado();

  const pasta = await comEscopo(sessao).pasta(String(dados.get('folderId') ?? ''));
  const destino = `/textos?pasta=${pasta.id}`;
  const ids = String(dados.get('ordem') ?? '')
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);
  if (ids.length === 0) voltar(destino, 'Nenhuma ordem recebida.');

  const permitidos = await prisma.text.findMany({
    where: { AND: [{ id: { in: ids } }, { folderId: pasta.id }, { status: 'pendente' }, escopoDeTexto(sessao)] },
    select: { id: true },
  });
  if (permitidos.length !== ids.length) {
    voltar(destino, 'A lista de ordenação não bate com os textos pendentes desta pasta.');
  }

  await prisma.$transaction(
    ids.map((id, posicao) =>
      prisma.text.update({ where: { id }, data: { ordem: posicao + 1 } }),
    ),
  );
  await registrarAuditoria(sessao, {
    acao: 'reordenar',
    entidade: 'folder',
    entidadeId: pasta.id,
    detalhes: { textos: ids.length },
  });
  voltar(destino, 'Ordem da fila salva.', 'ok');
}
