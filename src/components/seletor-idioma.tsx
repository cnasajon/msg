'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { trocarIdiomaDaSessao } from '@/app/acoes-idioma';
import { IDIOMAS, NOME_DO_IDIOMA } from '@/i18n/idiomas';

/**
 * Troca de idioma. Para quem está autenticado, grava a preferência no próprio
 * usuário; para quem ainda não entrou, grava um cookie — assim a tela de
 * entrada aparece no idioma certo antes de existir sessão.
 */
export function SeletorDeIdioma() {
  const idioma = useLocale();
  const t = useTranslations('comum');
  const [pendente, iniciar] = useTransition();

  return (
    <select
      aria-label={t('idioma')}
      value={idioma}
      disabled={pendente}
      onChange={(e) => {
        const escolhido = e.target.value;
        iniciar(() => {
          void trocarIdiomaDaSessao(escolhido);
        });
      }}
      style={{ width: 'auto', padding: '4px 8px', fontSize: 12.5 }}
    >
      {IDIOMAS.map((codigo) => (
        <option key={codigo} value={codigo}>
          {NOME_DO_IDIOMA[codigo]}
        </option>
      ))}
    </select>
  );
}
