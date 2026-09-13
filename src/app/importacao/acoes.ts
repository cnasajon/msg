'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { exigirCsrf } from '@/lib/csrf';
import { podeFazer } from '@/lib/autorizacao';
import { NaoAutorizado } from '@/lib/erros';
import { comEscopo } from '@/lib/escopo';
import { registrarAuditoria } from '@/lib/auditoria';
import { comAviso } from '@/lib/navegacao';
import { tradutorDeAvisos } from '@/lib/avisos-servidor';
import { lerPlanilha, PlanilhaInvalida } from '@/lib/planilha';
import { analisar, type Mapeamento } from '@/lib/importacao';

function voltar(destino: string, mensagem: string, tipo: 'erro' | 'ok' = 'erro'): never {
  redirect(comAviso(destino, tipo, mensagem));
}

// arquivos 'use server' só exportam funções assíncronas — esta fica local
function lerMapeamento(dados: FormData): Mapeamento {
  return {
    colunaTexto: Number(dados.get('colunaTexto') ?? 0),
    colunaData: Number(dados.get('colunaData') ?? -1),
    primeiraLinhaEhCabecalho: dados.get('cabecalho') === 'on',
  };
}

export async function importar(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'textos.importar')) throw new NaoAutorizado();

  const { t, frase } = await tradutorDeAvisos();
  const pasta = await comEscopo(sessao).pasta(String(dados.get('folderId') ?? ''));
  const destino = `/importacao?pasta=${pasta.id}`;

  const arquivo = dados.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) voltar(destino, t('escolhaArquivo'));

  let analise;
  let nomeDoArquivo = arquivo.name;
  try {
    const planilha = await lerPlanilha(arquivo);
    analise = await analisar(planilha, lerMapeamento(dados), pasta.id);
  } catch (erro) {
    voltar(destino, erro instanceof PlanilhaInvalida ? frase(erro.problema) : t('arquivoIlegivel'));
  }

  if (analise.importaveis === 0) {
    voltar(destino, t('nenhumaLinha'));
  }

  const ultimo = await prisma.text.findFirst({
    where: { folderId: pasta.id },
    orderBy: { ordem: 'desc' },
    select: { ordem: true },
  });
  let ordem = (ultimo?.ordem ?? 0) + 1;

  // Tudo numa transação: metade importada seria pior que nada importado.
  const registro = await prisma.$transaction(async (tx) => {
    const importacao = await tx.import.create({
      data: {
        folderId: pasta.id,
        arquivoNome: nomeDoArquivo.slice(0, 200),
        totalLinhas: analise.total,
        importadas: analise.importaveis,
        importadasComoHistorico: analise.comoHistorico,
        duplicadasIgnoradas: analise.duplicadas,
        criadoPor: sessao.usuarioId,
      },
    });

    for (const linha of analise.linhas) {
      if (linha.situacao !== 'importar' && linha.situacao !== 'importar_como_historico') continue;
      const historico = linha.situacao === 'importar_como_historico';

      const texto = await tx.text.create({
        data: {
          folderId: pasta.id,
          conteudo: linha.conteudo,
          ordem: ordem++,
          hashConteudo: linha.hash,
          importId: importacao.id,
          criadoPor: sessao.usuarioId,
          status: historico ? 'publicado' : 'pendente',
          publicadoEm: historico ? linha.publicadaEm : null,
        },
      });

      if (historico && linha.publicadaEm) {
        // Histórico trazido de outro aplicativo: fica registrado como
        // publicação de origem `importacao`, sem hora prevista — assim não
        // disputa slot com o dispatcher, que nunca reenvia essas linhas.
        await tx.publication.create({
          data: {
            folderId: pasta.id,
            textId: texto.id,
            origem: 'importacao',
            dataPrevista: linha.publicadaEm,
            horaPrevista: null,
            status: 'enviada',
            conteudoPublicado: linha.conteudo,
            tinhaImagem: false,
            enviadaEm: linha.publicadaEm,
          },
        });
      }
    }
    return importacao;
  });

  await registrarAuditoria(sessao, {
    acao: 'importar',
    entidade: 'import',
    entidadeId: registro.id,
    detalhes: {
      pasta: pasta.nome,
      arquivo: nomeDoArquivo,
      importadas: analise.importaveis,
      historico: analise.comoHistorico,
      duplicadas: analise.duplicadas,
    },
  });

  const partes = [t('importadasParte', { quantidade: analise.importaveis })];
  if (analise.comoHistorico > 0) {
    partes.push(t('comoHistoricoParte', { quantidade: analise.comoHistorico }));
  }
  if (analise.duplicadas > 0) {
    partes.push(t('duplicadasParte', { quantidade: analise.duplicadas }));
  }
  if (analise.descartadas > 0) {
    partes.push(t('descartadasParte', { quantidade: analise.descartadas }));
  }
  voltar(destino, `${partes.join(' · ')}.`, 'ok');
}

/**
 * Desfazer: só enquanto nenhum texto do lote tiver sido publicado pelo
 * dispatcher. Histórico importado não conta — ele nasceu publicado, e desfazer
 * a importação é justamente a forma de corrigir um arquivo errado.
 */
export async function desfazerImportacao(dados: FormData) {
  const sessao = await exigirCsrf(dados);
  if (!podeFazer(sessao.perfil, 'textos.importar')) throw new NaoAutorizado();

  const { t } = await tradutorDeAvisos();
  const importacao = await comEscopo(sessao).importacao(String(dados.get('id') ?? ''));
  const destino = `/importacao?pasta=${importacao.folderId}`;
  if (importacao.desfeitoEm) voltar(destino, t('importacaoJaDesfeita'));

  const publicadosDeVerdade = await prisma.publication.count({
    where: {
      folderId: importacao.folderId,
      origem: { not: 'importacao' },
      texto: { importId: importacao.id },
    },
  });
  if (publicadosDeVerdade > 0) {
    voltar(destino, `Não dá para desfazer: ${publicadosDeVerdade} texto(s) deste lote já foram publicados.`);
  }

  const apagados = await prisma.$transaction(async (tx) => {
    const { count } = await tx.text.deleteMany({ where: { importId: importacao.id } });
    await tx.import.update({ where: { id: importacao.id }, data: { desfeitoEm: new Date() } });
    return count;
  });

  await registrarAuditoria(sessao, {
    acao: 'desfazer_importacao',
    entidade: 'import',
    entidadeId: importacao.id,
    detalhes: { textosApagados: apagados },
  });
  voltar(destino, t('importacaoDesfeita', { quantidade: apagados }), 'ok');
}
