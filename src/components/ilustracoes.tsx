/** Ilustrações da tela inicial. Traço simples, cores vindas dos tokens do tema. */

export function ArtePainel() {
  return (
    <svg viewBox="0 0 200 110" aria-hidden="true">
        <rect x="14" y="16" width="172" height="78" rx="8" fill="var(--surface-2)" stroke="var(--border)"/>
        <rect x="26" y="28" width="58" height="26" rx="5" fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity=".35"/>
        <rect x="32" y="36" width="30" height="4" rx="2" fill="var(--accent)"/>
        <rect x="32" y="44" width="18" height="4" rx="2" fill="var(--accent)" fillOpacity=".45"/>
        <rect x="92" y="28" width="82" height="26" rx="5" fill="var(--surface)" stroke="var(--border)"/>
        <rect x="100" y="36" width="44" height="4" rx="2" fill="var(--text-faint)"/>
        <rect x="100" y="44" width="26" height="4" rx="2" fill="var(--text-faint)" fillOpacity=".5"/>
        <rect x="26" y="64" width="14" height="18" rx="3" fill="var(--accent)" fillOpacity=".35"/>
        <rect x="46" y="58" width="14" height="24" rx="3" fill="var(--accent)" fillOpacity=".55"/>
        <rect x="66" y="68" width="14" height="14" rx="3" fill="var(--accent)" fillOpacity=".35"/>
        <path d="M92 80 L112 68 L132 74 L152 56 L172 62" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="152" cy="56" r="3.5" fill="var(--accent)"/>
      </svg>
  );
}

export function ArteTextos() {
  return (
    <svg viewBox="0 0 200 110" aria-hidden="true">
        <rect x="34" y="14" width="90" height="82" rx="7" fill="var(--surface-2)" stroke="var(--border)"/>
        <rect x="48" y="22" width="90" height="82" rx="7" fill="var(--surface)" stroke="var(--border)"/>
        <rect x="60" y="36" width="66" height="5" rx="2.5" fill="var(--text-faint)"/>
        <rect x="60" y="48" width="54" height="5" rx="2.5" fill="var(--text-faint)" fillOpacity=".55"/>
        <rect x="60" y="60" width="62" height="5" rx="2.5" fill="var(--text-faint)" fillOpacity=".55"/>
        <rect x="60" y="72" width="34" height="5" rx="2.5" fill="var(--text-faint)" fillOpacity=".3"/>
        <rect x="126" y="28" width="48" height="34" rx="7" fill="var(--accent)"/>
        <path d="M136 60h10l-9.6 7.6a.6.6 0 0 1-1-.5V60z" fill="var(--accent)"/>
        <circle cx="140" cy="45" r="3" fill="var(--accent-text)"/>
        <circle cx="150" cy="45" r="3" fill="var(--accent-text)"/>
        <circle cx="160" cy="45" r="3" fill="var(--accent-text)"/>
      </svg>
  );
}

export function ArteConfiguracao() {
  return (
    <svg viewBox="0 0 200 110" aria-hidden="true">
        <path d="M26 34a6 6 0 0 1 6-6h26l8 9h34a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6z" fill="var(--surface-2)" stroke="var(--border)"/>
        <path d="M44 46a6 6 0 0 1 6-6h26l8 9h34a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6H50a6 6 0 0 1-6-6z" fill="var(--surface)" stroke="var(--border)"/>
        <circle cx="152" cy="60" r="24" fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity=".4"/>
        <circle cx="152" cy="60" r="8" fill="none" stroke="var(--accent)" strokeWidth="2.5"/>
        <g stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
          <path d="M152 44v-6M152 82v-6M168 60h6M130 60h6M163 49l4-4M137 71l4-4M163 71l4 4M137 49l4 4"/>
        </g>
      </svg>
  );
}

export function ArteSistema() {
  return (
    <svg viewBox="0 0 200 110" aria-hidden="true">
        <rect x="28" y="20" width="64" height="74" rx="6" fill="var(--surface-2)" stroke="var(--border)"/>
        <rect x="40" y="32" width="12" height="10" rx="2" fill="var(--accent)" fillOpacity=".5"/>
        <rect x="60" y="32" width="12" height="10" rx="2" fill="var(--accent)" fillOpacity=".3"/>
        <rect x="40" y="50" width="12" height="10" rx="2" fill="var(--accent)" fillOpacity=".3"/>
        <rect x="60" y="50" width="12" height="10" rx="2" fill="var(--accent)" fillOpacity=".5"/>
        <rect x="40" y="68" width="32" height="26" rx="3" fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity=".35"/>
        <rect x="106" y="28" width="66" height="20" rx="6" fill="var(--surface)" stroke="var(--border)"/>
        <rect x="106" y="56" width="66" height="20" rx="6" fill="var(--surface)" stroke="var(--border)"/>
        <circle cx="118" cy="38" r="5" fill="var(--accent)"/>
        <circle cx="160" cy="66" r="5" fill="var(--accent)"/>
        <rect x="128" y="35" width="34" height="5" rx="2.5" fill="var(--text-faint)" fillOpacity=".6"/>
        <rect x="116" y="63" width="34" height="5" rx="2.5" fill="var(--text-faint)" fillOpacity=".6"/>
        <path d="M106 86h66" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round"/>
      </svg>
  );
}
