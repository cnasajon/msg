'use client';

import { useState } from 'react';
import { DIAS_DA_SEMANA } from '@/lib/agenda';

/**
 * Escolha dos dias da semana. O banco guarda ISO (1 = segunda … 7 = domingo);
 * a interface mostra as siglas começando no domingo, que é como se lê um
 * calendário em português.
 */
export function SeletorDeDias({ iniciais = [1, 2, 3, 4, 5] }: { iniciais?: number[] }) {
  const [escolhidos, setEscolhidos] = useState<number[]>(iniciais);

  function alternar(iso: number) {
    setEscolhidos((atuais) =>
      atuais.includes(iso) ? atuais.filter((d) => d !== iso) : [...atuais, iso],
    );
  }

  return (
    <div>
      <span className="lbl" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
        Dias da semana
      </span>
      <div className="days">
        {DIAS_DA_SEMANA.map((dia) => (
          <span
            key={dia.iso}
            className={escolhidos.includes(dia.iso) ? 'on' : undefined}
            onClick={() => alternar(dia.iso)}
            role="checkbox"
            aria-checked={escolhidos.includes(dia.iso)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                alternar(dia.iso);
              }
            }}
          >
            {dia.sigla}
          </span>
        ))}
      </div>
      {escolhidos.map((iso) => (
        <input key={iso} type="hidden" name="diasSemana" value={iso} />
      ))}
    </div>
  );
}
