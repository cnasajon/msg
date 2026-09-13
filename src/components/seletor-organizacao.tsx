'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { trocarOrganizacaoAtiva } from '@/app/organizacoes/acoes';

/**
 * Troca da organização ativa do superadmin. Fica no topo da tela, sempre
 * visível, e cada troca é registrada na auditoria pela server action.
 */
export function SeletorDeOrganizacao({
  organizacoes,
  ativa,
  /**
   * Só o superadmin pode ficar sem organização nenhuma — e antes de escolher
   * ele não alcança dado algum. Quem participa de organizações sempre está
   * operando uma delas, então para essas pessoas a opção vazia não existe.
   */
  permiteNenhuma = false,
}: {
  organizacoes: { id: string; nome: string; ativa: boolean }[];
  ativa: string | null;
  permiteNenhuma?: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const t = useTranslations('comum');

  return (
    <div className="orgpicker" title={t('organizacaoAtiva')}>
      <span className="dot" />
      <span className="faint">{t('organizacaoAtiva')}</span>
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
        {permiteNenhuma ? <option value="">{t('escolher')}</option> : null}
        {organizacoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
            {o.ativa ? '' : ` (${t('inativa')})`}
          </option>
        ))}
      </select>
    </div>
  );
}
