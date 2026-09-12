/** Logomarca: balão de fala com três pontos. Acompanha o tema pelos tokens. */
export function Marca({ tamanho = 30 }: { tamanho?: number }) {
  return (
    <svg className="mark" viewBox="0 0 32 32" width={tamanho} height={tamanho} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M11.2 19.6h5.3l-5.1 4.05a.55.55 0 0 1-.9-.43V19.6z" fill="var(--accent-text)" />
      <rect x="7.4" y="8.4" width="17.2" height="11.8" rx="3.6" fill="var(--accent-text)" />
      <circle cx="11.6" cy="14.3" r="1.45" fill="var(--accent)" />
      <circle cx="16" cy="14.3" r="1.45" fill="var(--accent)" />
      <circle cx="20.4" cy="14.3" r="1.45" fill="var(--accent)" />
    </svg>
  );
}
