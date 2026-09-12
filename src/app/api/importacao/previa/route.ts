import { sessaoAtual } from '@/lib/sessao';
import { comEscopo } from '@/lib/escopo';
import { podeFazer } from '@/lib/autorizacao';
import { NaoEncontrado } from '@/lib/erros';
import { lerPlanilha, PlanilhaInvalida } from '@/lib/planilha';
import { analisar, EXPLICACAO_DA_SITUACAO } from '@/lib/importacao';

export const dynamic = 'force-dynamic';

/**
 * Pré-visualização da importação: o arquivo é analisado no servidor e devolvido
 * como resumo, sem gravar nada. É o que permite ver o mapeamento de colunas
 * funcionando antes de confirmar.
 *
 * Passa pelas mesmas verificações das demais rotas: sessão, permissão e escopo
 * da pasta.
 */
export async function POST(pedido: Request) {
  const sessao = await sessaoAtual();
  if (!sessao) return new Response('Não autenticado.', { status: 401 });
  if (!podeFazer(sessao.perfil, 'textos.importar')) return new Response('Sem permissão.', { status: 403 });

  const dados = await pedido.formData();
  const arquivo = dados.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return Response.json({ erro: 'Escolha um arquivo.' }, { status: 400 });
  }

  try {
    const pasta = await comEscopo(sessao).pasta(String(dados.get('folderId') ?? ''));
    const planilha = await lerPlanilha(arquivo);
    const analise = await analisar(
      planilha,
      {
        colunaTexto: Number(dados.get('colunaTexto') ?? 0),
        colunaData: Number(dados.get('colunaData') ?? -1),
        primeiraLinhaEhCabecalho: dados.get('cabecalho') === 'on',
      },
      pasta.id,
    );

    return Response.json({
      colunas: planilha.colunas,
      cabecalho: planilha.linhas[0] ?? [],
      total: analise.total,
      importaveis: analise.importaveis,
      comoHistorico: analise.comoHistorico,
      duplicadas: analise.duplicadas,
      descartadas: analise.descartadas,
      // amostra suficiente para conferir o mapeamento sem despejar o arquivo
      amostra: analise.linhas.slice(0, 30).map((l) => ({
        numero: l.numero,
        resumo: l.resumo,
        caracteres: l.caracteres,
        publicadaEm: l.publicadaEm ? l.publicadaEm.toISOString().slice(0, 10) : null,
        situacao: l.situacao,
        explicacao: EXPLICACAO_DA_SITUACAO[l.situacao],
      })),
    });
  } catch (erro) {
    if (erro instanceof NaoEncontrado) return new Response('Não encontrado.', { status: 404 });
    if (erro instanceof PlanilhaInvalida) return Response.json({ erro: erro.message }, { status: 400 });
    throw erro;
  }
}
