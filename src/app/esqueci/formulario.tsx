'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { pedirRedefinicao, type EstadoDoPedido } from './acoes';

export function FormularioDeEsquecimento() {
  const [estado, acao, enviando] = useActionState<EstadoDoPedido, FormData>(pedirRedefinicao, {});
  const t = useTranslations('esqueci');

  // Uma vez pedido, o formulário sai da tela: repetir não adianta nada, e a
  // mensagem é a mesma exista a conta ou não.
  if (estado.enviado) {
    return (
      <>
        <div className="banner ok">
          <div>
            <div className="ttl">{t('pronto')}</div>
            {t('prontoDetalhe')}
          </div>
        </div>
        <p style={{ margin: '14px 0 0', textAlign: 'center' }}>
          <Link href="/entrar">{t('voltar')}</Link>
        </p>
      </>
    );
  }

  return (
    <form action={acao}>
      {estado.erro ? (
        <div className="banner err" style={{ marginBottom: 14 }}>
          <div>{t(estado.erro)}</div>
        </div>
      ) : null}

      <p className="faint" style={{ marginTop: 0 }}>
        {t('explicacao')}
      </p>

      <label className="field">
        <span className="lbl">{t('usuario')}</span>
        <input
          type="text"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
        />
      </label>

      <button
        className="btn primary"
        type="submit"
        disabled={enviando}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {enviando ? t('enviando') : t('pedir')}
      </button>

      <p style={{ margin: '14px 0 0', textAlign: 'center' }}>
        <Link className="faint" href="/entrar">
          {t('voltar')}
        </Link>
      </p>
    </form>
  );
}
