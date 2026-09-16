/**
 * Ícones da lista de textos.
 *
 * Desenhados aqui, em SVG embutido, e não trazidos de uma biblioteca: são seis
 * traços, e uma dependência de ícones custaria quilobytes e uma superfície de
 * atualização para isso. Herdam `currentColor`, então acompanham o tema claro e
 * o escuro sem nada a mais.
 *
 * Nenhum deles carrega rótulo próprio: são `aria-hidden` de propósito, porque
 * quem dá nome ao botão é o `title`/`aria-label` de quem os usa. Um ícone com
 * nome dentro de um botão com nome faz o leitor de tela anunciar duas vezes.
 */

const TRACO = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** Abrir o texto. */
export function IconeAbrir() {
  return (
    <svg {...TRACO}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Publicar agora — o avião de papel do envio. */
export function IconePublicar() {
  return (
    <svg {...TRACO}>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

/** Reenviar depois de um erro. */
export function IconeReenviar() {
  return (
    <svg {...TRACO}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

/** Arquivar: a caixa que se fecha. */
export function IconeArquivar() {
  return (
    <svg {...TRACO}>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

/** Desarquivar: a mesma caixa, com o texto saindo dela. */
export function IconeDesarquivar() {
  return (
    <svg {...TRACO}>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8" />
      <path d="M12 18v-6" />
      <path d="m9 15 3-3 3 3" />
    </svg>
  );
}

/** Pendente: o relógio de quem ainda espera a vez. */
export function IconePendente() {
  return (
    <svg {...TRACO}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Publicado. */
export function IconePublicado() {
  return (
    <svg {...TRACO}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

/** Erro na publicação. */
export function IconeErro() {
  return (
    <svg {...TRACO}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6" />
      <path d="M12 16.5v.5" />
    </svg>
  );
}

/** O ícone da situação do texto, pelo nome da situação. */
export function IconeDaSituacao({ situacao }: { situacao: string }) {
  if (situacao === 'publicado') return <IconePublicado />;
  if (situacao === 'erro') return <IconeErro />;
  if (situacao === 'arquivado') return <IconeArquivar />;
  return <IconePendente />;
}
