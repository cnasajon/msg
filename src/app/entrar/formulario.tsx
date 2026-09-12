'use client';

import { useActionState } from 'react';
import { entrar, type EstadoDoLogin } from './acoes';

export function FormularioDeLogin() {
  const [estado, acao, enviando] = useActionState<EstadoDoLogin, FormData>(entrar, {});

  return (
    <form action={acao}>
      {estado.erro ? (
        <div className="banner err" style={{ marginBottom: 14 }}>
          <div>{estado.erro}</div>
        </div>
      ) : null}

      <label className="field">
        <span className="lbl">E-mail</span>
        <input type="email" name="email" autoComplete="username" required autoFocus />
      </label>
      <label className="field">
        <span className="lbl">Senha</span>
        <input type="password" name="senha" autoComplete="current-password" required />
      </label>

      <button
        className="btn primary"
        type="submit"
        disabled={enviando}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
