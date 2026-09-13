'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Detalhes de um registro de auditoria, num diálogo.
 *
 * Na coluna eles não cabiam: um JSON de importação tem dezenas de campos, e
 * espremê-los entre a entidade e o IP esticava a linha inteira e empurrava as
 * outras colunas. Aqui a tabela fica com um botão de largura fixa, e quem
 * quiser ver abre.
 *
 * `<dialog>` nativo em vez de um painel próprio: já traz o modal, o fechar com
 * Escape, o foco preso dentro e a devolução do foco ao botão que o abriu.
 */
export function DetalhesDaAuditoria({
  detalhes,
  resumo,
}: {
  detalhes: unknown;
  /** Linha de identificação no topo do diálogo: quando, quem, ação. */
  resumo: string;
}) {
  const t = useTranslations('auditoria');
  const comum = useTranslations('comum');
  const dialogo = useRef<HTMLDialogElement>(null);

  // Clique no fundo escuro fecha. O alvo é o próprio dialog só quando o clique
  // cai fora da caixa — o conteúdo interno é filho, e não dispara isto.
  useEffect(() => {
    const atual = dialogo.current;
    if (!atual) return;
    function aoClicar(evento: MouseEvent) {
      if (evento.target === atual) atual?.close();
    }
    atual.addEventListener('click', aoClicar);
    return () => atual.removeEventListener('click', aoClicar);
  }, []);

  return (
    <>
      <button
        type="button"
        className="btn sm"
        onClick={() => dialogo.current?.showModal()}
      >
        {t('verDetalhes')}
      </button>

      <dialog ref={dialogo} className="dlg">
        <div className="dlg-cabeca">
          <b>{t('detalhes')}</b>
          <span className="spacer" />
          <button
            type="button"
            className="btn sm"
            onClick={() => dialogo.current?.close()}
            aria-label={comum('fechar')}
          >
            ✕
          </button>
        </div>
        <div className="dlg-corpo">
          <p className="faint" style={{ margin: '0 0 10px' }}>
            {resumo}
          </p>
          <pre className="mono dlg-json">{JSON.stringify(detalhes, null, 2)}</pre>
        </div>
      </dialog>
    </>
  );
}
