'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type ItemDaFila = { id: string; resumo: string; miniatura: string | null; caracteres: number };

/**
 * Reordenação da fila por arrastar, com setas como alternativa — arrastar não
 * funciona bem em telefone nem com teclado, e a fila é justamente o que mais se
 * mexe em campo.
 *
 * A ordem só é gravada quando se clica em salvar: arrastar cinco itens não
 * deveria gerar cinco escritas no banco.
 */
export function FilaOrdenavel({ itens, acao, csrf, folderId }: {
  itens: ItemDaFila[];
  acao: (dados: FormData) => void;
  csrf: React.ReactNode;
  folderId: string;
}) {
  const t = useTranslations('textos');
  const [lista, setLista] = useState(itens);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [mudou, setMudou] = useState(false);

  function mover(de: number, para: number) {
    if (para < 0 || para >= lista.length || de === para) return;
    const nova = [...lista];
    const [item] = nova.splice(de, 1);
    nova.splice(para, 0, item!);
    setLista(nova);
    setMudou(true);
  }

  return (
    <form action={acao}>
      {csrf}
      <input type="hidden" name="folderId" value={folderId} />
      <input type="hidden" name="ordem" value={lista.map((i) => i.id).join(',')} />

      <table>
        <thead>
          <tr>
            <th style={{ width: 90 }}>{t('ordem')}</th>
            <th>{t('texto')}</th>
            <th style={{ width: 110 }} />
          </tr>
        </thead>
        <tbody>
          {lista.map((item, posicao) => (
            <tr
              key={item.id}
              draggable
              onDragStart={() => setArrastando(posicao)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (arrastando !== null) mover(arrastando, posicao);
                setArrastando(null);
              }}
              style={arrastando === posicao ? { opacity: 0.5 } : undefined}
            >
              <td>
                <span className="drag" title={t('arrasteParaReordenar')}>
                  ⠿
                </span>{' '}
                <span className="num">{posicao + 1}</span>
              </td>
              <td className="textcell">
                {/* Sem imagem, nada ocupa o lugar dela — como na lista de
                    textos, logo acima, na mesma tela. */}
                {item.miniatura ? (
                  <img className="thumb" src={item.miniatura} alt="" />
                ) : null}
                <div className="t">
                  <p>{item.resumo}</p>
                  <div className="meta">{t('caracteres', { quantidade: item.caracteres })}</div>
                </div>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => mover(posicao, posicao - 1)}
                  disabled={posicao === 0}
                  aria-label={t('moverParaCima')}
                >
                  ↑
                </button>{' '}
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => mover(posicao, posicao + 1)}
                  disabled={posicao === lista.length - 1}
                  aria-label={t('moverParaBaixo')}
                >
                  ↓
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="body" style={{ borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn primary" type="submit" disabled={!mudou}>
          {t('salvarOrdem')}
        </button>
        <span className="faint">
          {mudou ? t('mudancasNaoSalvas') : t('arrasteOuSetas')}
        </span>
      </div>
    </form>
  );
}
