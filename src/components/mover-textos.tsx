'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

type Pasta = { id: string; nome: string };

/** O formulário da barra; as caixas se ligam a ele pelo atributo `form`. */
const FORMULARIO = 'mover-textos';

/**
 * Escolha de textos e envio para outra pasta.
 *
 * As linhas da tabela já têm formulários próprios — publicar agora, pular,
 * arquivar. Envolver a tabela num formulário aninharia um dentro do outro, o
 * que o HTML não permite: o navegador descarta o de dentro e os botões param de
 * funcionar. Por isso o formulário da barra fica ao lado da tabela, e cada
 * caixa de seleção se liga a ele por `form="mover-textos"` — o HTML permite que
 * um controle pertença a um formulário que não é seu ancestral.
 *
 * A contagem escuta o `change` na div que embrulha a tabela: o evento sobe pela
 * árvore do documento, que é onde as caixas estão, não pela do formulário.
 */
export function MoverTextos({
  ativo,
  folderId,
  destinos,
  acao,
  csrf,
  children,
}: {
  /** Falso para o perfil `usuario`: a tabela sai como está, sem nada em volta. */
  ativo: boolean;
  folderId: string;
  destinos: Pasta[];
  acao: (dados: FormData) => void;
  csrf: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations('textos');
  const area = useRef<HTMLDivElement>(null);
  const [escolhidos, setEscolhidos] = useState(0);

  function aoMudar(evento: React.ChangeEvent<HTMLDivElement>) {
    const caixas = area.current?.querySelectorAll<HTMLInputElement>('input[name="textos"]');
    if (!caixas) return;

    const alvo = evento.target as HTMLInputElement;
    if (alvo.dataset.todos !== undefined) {
      caixas.forEach((caixa) => {
        caixa.checked = alvo.checked;
      });
    }
    setEscolhidos([...caixas].filter((caixa) => caixa.checked).length);
  }

  if (!ativo) return <>{children}</>;

  return (
    <>
      <div ref={area} onChange={aoMudar}>
        {children}
      </div>

      <form id={FORMULARIO} action={acao}>
        {csrf}
        <input type="hidden" name="folderId" value={folderId} />

        {escolhidos > 0 ? (
          <div
            className="body"
            style={{
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <b>{t('escolhidos', { quantidade: escolhidos })}</b>
            {destinos.length === 0 ? (
              <span className="faint">{t('semOutraPasta')}</span>
            ) : (
              <>
                <span>{t('moverPara')}</span>
                <select name="destinoId" defaultValue={destinos[0]?.id} required>
                  {destinos.map((pasta) => (
                    <option key={pasta.id} value={pasta.id}>
                      {pasta.nome}
                    </option>
                  ))}
                </select>
                <button className="btn primary" type="submit">
                  {t('mover')}
                </button>
              </>
            )}
          </div>
        ) : null}
      </form>
    </>
  );
}

/** Caixa de uma linha. Fica na tabela, mas pertence ao formulário da barra. */
export function CaixaDeTexto({ id }: { id: string }) {
  return <input type="checkbox" name="textos" value={id} form={FORMULARIO} />;
}

/** Caixa do cabeçalho: marca e desmarca todas as linhas de uma vez. */
export function CaixaDeTodos({ rotulo }: { rotulo: string }) {
  return <input type="checkbox" data-todos="" aria-label={rotulo} />;
}
