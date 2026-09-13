'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ajuda } from './ajuda';
import { normalizarPadraoDigitado } from '@/lib/data-da-publicacao';

/**
 * O padrão de data de um texto, em lista por data.
 *
 * Normaliza ao sair do campo: `1/9/*` vira `01/09/*`. O servidor já entendia as
 * duas grafias, mas ver o que foi entendido **antes** de salvar é o que tira a
 * dúvida de quem digitou — ninguém deveria precisar salvar para descobrir se o
 * sistema leu "1 de setembro" ou "9 de janeiro".
 *
 * A normalização acontece no `blur`, não a cada tecla: corrigir no meio da
 * digitação empurraria o cursor e atrapalharia quem ainda está escrevendo.
 */
export function CampoDeData({ valorInicial }: { valorInicial: string }) {
  const t = useTranslations('editor');
  const comum = useTranslations('comum');
  const [valor, setValor] = useState(valorInicial);

  return (
    <label className="field" style={{ marginTop: 14 }}>
      <span className="lbl">
        {t('dataDaPublicacao')}
        <Ajuda texto={t('dataHint')} rotulo={comum('ajudaSobre', { campo: t('dataDaPublicacao') })} />
      </span>
      <input
        type="text"
        name="dataDaPublicacao"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={(e) => setValor(normalizarPadraoDigitado(e.target.value))}
        placeholder="*/*/*"
        autoCapitalize="none"
        spellCheck={false}
        style={{ maxWidth: 200 }}
      />
      <span className="hint">{t('duasCondicoes')}</span>
    </label>
  );
}
