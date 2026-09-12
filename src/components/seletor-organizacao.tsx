'use client';

import { useTransition } from 'react';
import { trocarOrganizacaoAtiva } from '@/app/organizacoes/acoes';

/**
 * Troca da organização ativa do superadmin. Fica no topo da tela, sempre
 * visível, e cada troca é registrada na auditoria pela server action.
 */
export function SeletorDeOrganizacao({
  organizacoes,
  ativa,
}: {
  organizacoes: { id: string; nome: string; ativa: boolean }[];
  ativa: string | null;
}) {
  const [pendente, iniciar] = useTransition();

  return (
    <div className="orgpicker" title="Organização que você está operando">
      <span className="dot" />
      <span className="faint">Organização ativa</span>
      <select
        value={ativa ?? ''}
        disabled={pendente}
        onChange={(e) => {
          const valor = e.target.value;
          iniciar(() => {
            void trocarOrganizacaoAtiva(valor === '' ? null : valor);
          });
        }}
      >
        <option value="">— escolher —</option>
        {organizacoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
            {o.ativa ? '' : ' (inativa)'}
          </option>
        ))}
      </select>
    </div>
  );
}
