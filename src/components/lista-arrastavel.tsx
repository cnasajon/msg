'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export type LinhaDaLista = {
  id: string;
  /** Posição na fila, ou `null` para quem não está pendente. */
  posicao: number | null;
  /** Células que vêm **antes** da alça — hoje, a caixa de seleção. */
  prefixo?: React.ReactNode;
  /** As demais células da linha, montadas no servidor. */
  celulas: React.ReactNode;
};

/**
 * O corpo da lista de textos, com as linhas pendentes arrastáveis.
 *
 * Havia duas tabelas na tela: a lista e, embaixo, um cartão só para reordenar a
 * fila. Quem queria mover um texto tinha de achá-lo duas vezes. Agora a alça
 * fica na própria linha, e a coluna que só mostrava o número da posição passa a
 * ser por onde se arrasta.
 *
 * As células vêm prontas do servidor e entram aqui como `celulas`. Só a `<tr>`
 * em volta é de cliente, porque é nela que moram os eventos de arrastar — assim
 * os formulários de publicar e arquivar, que são ações de servidor, continuam
 * renderizados no servidor, sem virar código de navegador.
 *
 * A ordem só vai para o banco quando se clica em salvar: arrastar cinco textos
 * não deveria gerar cinco escritas. Enquanto não se salva, a barra avisa que há
 * mudança pendente — e sair da tela sem salvar perde a mudança, que é o
 * comportamento de sempre de quem não confirmou nada.
 */
export function ListaArrastavel({
  linhas,
  comPosicao,
  arrastavel,
  colunas,
  acao,
  csrf,
  folderId,
}: {
  linhas: LinhaDaLista[];
  /** Falso na lista por data, que não tem fila e traz a própria coluna de data. */
  comPosicao: boolean;
  /**
   * Falso quando a lista está ordenada por outra coluna ou filtrada. A posição
   * continua à mostra — é dela que se precisa justamente aí —, só a alça some.
   */
  arrastavel: boolean;
  /** Quantas colunas a tabela tem, para a linha da barra de salvar. */
  colunas: number;
  acao: (dados: FormData) => void;
  csrf: React.ReactNode;
  folderId: string;
}) {
  const t = useTranslations('textos');
  const comum = useTranslations('comum');
  const [ordem, setOrdem] = useState<string[]>(() => linhas.map((l) => l.id));
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [mudou, setMudou] = useState(false);

  // Quando o servidor manda outra ordem — clicaram num cabeçalho para ordenar,
  // um filtro mudou, alguém arquivou um texto —, o que está guardado aqui fica
  // velho e precisa ceder. Sem isto, ordenar por outra coluna trocava a seta do
  // cabeçalho e deixava as linhas exatamente onde estavam: o `useState` só lê o
  // valor inicial na montagem, e a lista já estava montada.
  const doServidor = linhas.map((l) => l.id).join(',');
  const [ultimaDoServidor, setUltimaDoServidor] = useState(doServidor);
  if (ultimaDoServidor !== doServidor) {
    setUltimaDoServidor(doServidor);
    setOrdem(linhas.map((l) => l.id));
    setMudou(false);
  }

  const porId = new Map(linhas.map((l) => [l.id, l]));
  const atual = ordem.length === linhas.length && ordem.every((id) => porId.has(id))
    ? ordem
    : linhas.map((l) => l.id);

  /** Só as pendentes entram na reordenação; as demais não têm posição na fila. */
  const pendente = (id: string) => porId.get(id)?.posicao !== null;

  function mover(de: string, para: string) {
    if (de === para || !pendente(de) || !pendente(para)) return;
    const nova = [...atual];
    const origem = nova.indexOf(de);
    const destino = nova.indexOf(para);
    if (origem < 0 || destino < 0) return;
    nova.splice(destino, 0, ...nova.splice(origem, 1));
    setOrdem(nova);
    setMudou(true);
  }

  /** Alternativa ao arrastar, que não funciona bem em telefone nem com teclado. */
  function passo(id: string, direcao: -1 | 1) {
    const pendentes = atual.filter(pendente);
    const onde = pendentes.indexOf(id);
    const vizinho = pendentes[onde + direcao];
    if (vizinho) mover(id, vizinho);
  }

  const pendentes = atual.filter(pendente);

  return (
    <>
      {atual.map((id) => {
        const linha = porId.get(id)!;
        const arrasta = arrastavel && linha.posicao !== null;
        const posicao = linha.posicao === null ? null : pendentes.indexOf(id) + 1;

        return (
          <tr
            key={id}
            draggable={arrasta}
            className={arrastando === id ? 'arrastando' : undefined}
            onDragStart={arrasta ? () => setArrastando(id) : undefined}
            onDragEnd={arrasta ? () => setArrastando(null) : undefined}
            onDragOver={arrasta ? (e) => e.preventDefault() : undefined}
            onDrop={
              arrasta
                ? (e) => {
                    e.preventDefault();
                    if (arrastando) mover(arrastando, id);
                    setArrastando(null);
                  }
                : undefined
            }
          >
            {linha.prefixo}
            {comPosicao ? (
              <td className="alca">
                {linha.posicao === null ? (
                  <span className="faint">—</span>
                ) : (
                  <>
                    {arrasta ? (
                      <span className="drag" title={t('arrasteParaReordenar')} aria-hidden="true">
                        ⠿
                      </span>
                    ) : null}
                    <span className="num">{posicao}</span>
                    <span className="setas" hidden={!arrasta}>
                      <button
                        type="button"
                        className="btn sm icone"
                        onClick={() => passo(id, -1)}
                        title={t('moverParaCima')}
                        aria-label={t('moverParaCima')}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn sm icone"
                        onClick={() => passo(id, 1)}
                        title={t('moverParaBaixo')}
                        aria-label={t('moverParaBaixo')}
                      >
                        ↓
                      </button>
                    </span>
                  </>
                )}
              </td>
            ) : null}
            {linha.celulas}
          </tr>
        );
      })}

      {mudou ? (
        <tr>
          <td colSpan={colunas}>
            <form action={acao} className="salvar-ordem">
              {csrf}
              <input type="hidden" name="folderId" value={folderId} />
              <input type="hidden" name="ordem" value={pendentes.join(',')} />
              <b>{t('mudancasNaoSalvas')}</b>
              <button className="btn primary sm" type="submit">
                {t('salvarOrdem')}
              </button>
              <button
                className="btn sm"
                type="button"
                onClick={() => {
                  setOrdem(linhas.map((l) => l.id));
                  setMudou(false);
                }}
              >
                {comum('cancelar')}
              </button>
            </form>
          </td>
        </tr>
      ) : null}
    </>
  );
}
