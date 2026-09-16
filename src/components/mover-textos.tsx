'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

type Pasta = { id: string; nome: string };

/** O formulário da barra; as caixas se ligam a ele pelo atributo `form`. */
const FORMULARIO = 'mover-textos';

/**
 * Escolha de textos e o que se faz a partir dela: mover, incluir, arquivar,
 * excluir e exportar.
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
 *
 * Guardar os identificadores escolhidos, e não só quantos são, é o que permite
 * exportar e incluir: exportar é um download por GET, que precisa da lista na
 * URL, e não passa pelo `action` do formulário.
 */
export function MoverTextos({
  ativo,
  podeMover,
  folderId,
  destinos,
  acao,
  arquivarEmLote,
  excluirEmLote,
  csrf,
  children,
}: {
  /** Falso quando o perfil não gerencia textos: a tabela sai como está. */
  ativo: boolean;
  /**
   * Mover é a única das ações restrita a admin para cima. Sem esta separação, o
   * perfil `usuario` ficaria sem barra nenhuma — e sem arquivar, excluir ou
   * exportar em lote, que ele pode fazer.
   */
  podeMover: boolean;
  folderId: string;
  destinos: Pasta[];
  acao: (dados: FormData) => void;
  arquivarEmLote: (dados: FormData) => void;
  excluirEmLote: (dados: FormData) => void;
  csrf: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations('textos');
  const comum = useTranslations('comum');
  const area = useRef<HTMLDivElement>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);

  function aoMudar(evento: React.ChangeEvent<HTMLDivElement>) {
    const caixas = area.current?.querySelectorAll<HTMLInputElement>('input[name="textos"]');
    if (!caixas) return;

    const alvo = evento.target as HTMLInputElement;
    if (alvo.dataset.todos !== undefined) {
      caixas.forEach((caixa) => {
        caixa.checked = alvo.checked;
      });
    }
    // A ordem é a da tabela, não a dos cliques: "abaixo da linha atual" precisa
    // ser a última linha escolhida *na tela*, senão o texto novo entra num lugar
    // que não é o que a pessoa está vendo.
    setEscolhidos([...caixas].filter((caixa) => caixa.checked).map((caixa) => caixa.value));
  }

  if (!ativo) return <>{children}</>;

  const quantidade = escolhidos.length;
  const ultimo = escolhidos[quantidade - 1];
  const paraExportar = new URLSearchParams({ pasta: folderId });
  for (const id of escolhidos) paraExportar.append('textos', id);

  return (
    <>
      <div ref={area} onChange={aoMudar}>
        {children}
      </div>

      <form id={FORMULARIO} action={acao}>
        {csrf}
        <input type="hidden" name="folderId" value={folderId} />

        {quantidade > 0 ? (
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
            <b>{t('escolhidos', { quantidade })}</b>

            <Link
              className="btn"
              href={`/textos/novo?pasta=${folderId}&depoisDe=${ultimo}`}
              title={t('incluirAquiTitulo')}
            >
              {t('incluirAqui')}
            </Link>

            <Link className="btn" href={`/exportacao?${paraExportar.toString()}`}>
              {t('exportarEscolhidos')}
            </Link>

            <button className="btn" type="submit" formAction={arquivarEmLote}>
              {t('arquivar')}
            </button>

            <button
              className="btn danger"
              type="submit"
              formAction={excluirEmLote}
              // Excluir apaga a linha; arquivar, ao lado, não. A confirmação diz
              // quantos são porque o erro caro aqui é ter escolhido demais sem
              // perceber — "todos" de uma tela cheia é um clique só.
              onClick={(evento) => {
                if (!confirm(t('confirmarExclusao', { quantidade }))) evento.preventDefault();
              }}
            >
              {comum('excluir')}
            </button>

            {!podeMover ? null : destinos.length === 0 ? (
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
