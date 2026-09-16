import Link from 'next/link';
import { proximoSentido, type Coluna, type Ordenacao } from '@/lib/ordenacao-da-lista';

/**
 * Cabeçalho de coluna que ordena ao ser clicado.
 *
 * É um link, e não um botão: a ordenação vive na URL junto dos filtros, então a
 * tela ordenada é marcável nos favoritos, compartilhável e reversível pelo botão
 * de voltar. Um botão de formulário daria o mesmo resultado na tela e perderia
 * as três coisas.
 *
 * Os parâmetros que já estavam na URL são preservados: sem isso, ordenar
 * limparia o filtro de situação e a busca que a pessoa acabou de aplicar.
 */
export function CabecalhoOrdenavel({
  coluna,
  rotulo,
  ordenacao,
  parametros,
  largura,
  /** Para a coluna da situação, que não tem rótulo escrito. */
  soIndicador = false,
}: {
  coluna: Coluna;
  rotulo: string;
  ordenacao: Ordenacao;
  /** Os filtros em vigor, que a ordenação não pode apagar. */
  parametros: URLSearchParams;
  largura?: number;
  soIndicador?: boolean;
}) {
  const alvo = new URLSearchParams(parametros);
  alvo.set('ordenar', coluna);
  alvo.set('sentido', proximoSentido(ordenacao, coluna));

  const ativa = ordenacao.coluna === coluna;
  // A seta aponta para onde a lista está, não para onde o clique vai levar: é a
  // leitura que todo mundo espera de uma tabela ordenada.
  const seta = ativa ? (ordenacao.descendente ? '▼' : '▲') : '';

  return (
    <th style={largura ? { width: largura } : undefined} aria-sort={
      ativa ? (ordenacao.descendente ? 'descending' : 'ascending') : 'none'
    }>
      <Link className="ordenar" href={`/textos?${alvo.toString()}`} title={rotulo}>
        {soIndicador ? <span className="sr">{rotulo}</span> : rotulo}
        <span className="seta" aria-hidden="true">
          {seta}
        </span>
      </Link>
    </th>
  );
}
