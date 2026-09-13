'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LIMITE_COM_IMAGEM, LIMITE_SEM_IMAGEM } from '@/lib/textos';

/**
 * Campo de texto com contador e o limite mudando conforme a imagem.
 *
 * A regra dos dois limites tem de ser visível enquanto se digita, não só no
 * servidor — descobrir que passou de 1024 depois de salvar é péssimo. O
 * servidor valida de novo, porque isto aqui é conveniência, não garantia.
 */
export function EditorDeTexto({
  nome = 'conteudo',
  valorInicial = '',
  temImagemInicial = false,
  urlDaImagem,
}: {
  nome?: string;
  valorInicial?: string;
  temImagemInicial?: boolean;
  urlDaImagem?: string | null;
}) {
  const t = useTranslations('editor');
  const [conteudo, setConteudo] = useState(valorInicial);
  const [temImagem, setTemImagem] = useState(temImagemInicial);
  const [removendo, setRemovendo] = useState(false);
  const [nomeDoArquivo, setNomeDoArquivo] = useState<string | null>(null);

  const comImagem = removendo ? false : temImagem;
  const limite = comImagem ? LIMITE_COM_IMAGEM : LIMITE_SEM_IMAGEM;
  const usados = [...conteudo].length;
  const excedeu = usados > limite;

  return (
    <>
      <label className="field">
        <span className="lbl">
          {t('campoTexto')} · <code>parse_mode: HTML</code>
        </span>
        <textarea
          name={nome}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          rows={10}
          required
        />
        <span className="hint">
          {t('tagsAceitas')} <code>&lt;b&gt;</code> <code>&lt;i&gt;</code> <code>&lt;u&gt;</code>{' '}
          <code>&lt;s&gt;</code> <code>&lt;a href&gt;</code> <code>&lt;code&gt;</code>{' '}
          <code>&lt;pre&gt;</code> <code>&lt;blockquote&gt;</code> <code>&lt;tg-spoiler&gt;</code>
        </span>
      </label>

      <div className={excedeu ? 'counter over' : 'counter'}>
        <div className="bar">
          <i style={{ width: `${Math.min(100, (usados / limite) * 100)}%` }} />
        </div>
        <span className="n">{t('contador', { usados, limite })}</span>
      </div>

      {excedeu && comImagem ? (
        <div className="banner err" style={{ marginTop: 12 }}>
          <div>
            <div className="ttl">{t('acimaDoLimiteTitulo')}</div>
            {t('acimaDoLimiteTexto')}
          </div>
        </div>
      ) : null}

      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />

      {temImagemInicial && !removendo ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {urlDaImagem ? <img className="thumb lg" src={urlDaImagem} alt="" /> : null}
          <div>
            <p className="faint" style={{ marginTop: 0 }}>
              {t('imagemGuardada')}
            </p>
            <button
              type="button"
              className="btn sm danger"
              onClick={() => {
                setRemovendo(true);
                setTemImagem(false);
              }}
            >
              {t('removerImagem')}
            </button>
            <input type="hidden" name="removerImagem" value={removendo ? 'on' : ''} />
          </div>
        </div>
      ) : (
        <>
          {removendo ? (
            <div className="banner warn" style={{ marginBottom: 12 }}>
              <div>
                {t('marcadaParaRemocao')}{' '}
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setRemovendo(false);
                    setTemImagem(true);
                  }}
                >
                  {t('desfazer')}
                </button>
              </div>
              <input type="hidden" name="removerImagem" value="on" />
            </div>
          ) : null}

          <label className="field">
            <span className="lbl">{t('imagemOpcional')}</span>
            <input
              type="file"
              name="imagem"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const arquivo = e.target.files?.[0] ?? null;
                setNomeDoArquivo(arquivo?.name ?? null);
                setTemImagem(!!arquivo);
                if (arquivo) setRemovendo(false);
              }}
            />
            <span className="hint">
              {t('regraDaImagem')}{' '}
              {nomeDoArquivo ? <b>{t('selecionado', { arquivo: nomeDoArquivo })}</b> : null}
            </span>
          </label>
        </>
      )}
    </>
  );
}
