'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { entrar, type EstadoDoLogin } from './acoes';

export function FormularioDeLogin() {
  const [estado, acao, enviando] = useActionState<EstadoDoLogin, FormData>(entrar, {});
  const t = useTranslations('entrada');
  const comum = useTranslations('comum');

  return (
    <form action={acao}>
      {estado.erro ? (
        <div className="banner err" style={{ marginBottom: 14 }}>
          <div>{t(estado.erro)}</div>
        </div>
      ) : null}

      <label className="field">
        <span className="lbl">{t('email')}</span>
        <input type="email" name="email" autoComplete="username" required autoFocus />
      </label>
      <label className="field">
        <span className="lbl">{t('senha')}</span>
        <input type="password" name="senha" autoComplete="current-password" required />
      </label>

      <button
        className="btn primary"
        type="submit"
        disabled={enviando}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {enviando ? t('entrando') : comum('entrar')}
      </button>
    </form>
  );
}
