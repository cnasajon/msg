'use client';

import { useState } from 'react';
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
          Texto · <code>parse_mode: HTML</code>
        </span>
        <textarea
          name={nome}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          rows={10}
          required
        />
        <span className="hint">
          Tags aceitas: <code>&lt;b&gt;</code> <code>&lt;i&gt;</code> <code>&lt;u&gt;</code>{' '}
          <code>&lt;s&gt;</code> <code>&lt;a href&gt;</code> <code>&lt;code&gt;</code>{' '}
          <code>&lt;pre&gt;</code> <code>&lt;blockquote&gt;</code> <code>&lt;tg-spoiler&gt;</code>
        </span>
      </label>

      <div className={excedeu ? 'counter over' : 'counter'}>
        <div className="bar">
          <i style={{ width: `${Math.min(100, (usados / limite) * 100)}%` }} />
        </div>
        <span className="n">
          {usados} / {limite} caracteres
        </span>
      </div>

      {excedeu && comImagem ? (
        <div className="banner err" style={{ marginTop: 12 }}>
          <div>
            <div className="ttl">Acima do limite de legenda</div>
            Com imagem anexada o limite é {LIMITE_COM_IMAGEM} caracteres, porque o texto vai como
            legenda da foto. Reduza o texto ou remova a imagem para voltar ao limite de{' '}
            {LIMITE_SEM_IMAGEM}.
          </div>
        </div>
      ) : null}

      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />

      {temImagemInicial && !removendo ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {urlDaImagem ? <img className="thumb lg" src={urlDaImagem} alt="" /> : null}
          <div>
            <p className="faint" style={{ marginTop: 0 }}>
              Imagem guardada no banco e servida por rota autenticada.
            </p>
            <button
              type="button"
              className="btn sm danger"
              onClick={() => {
                setRemovendo(true);
                setTemImagem(false);
              }}
            >
              Remover imagem
            </button>
            <input type="hidden" name="removerImagem" value={removendo ? 'on' : ''} />
          </div>
        </div>
      ) : (
        <>
          {removendo ? (
            <div className="banner warn" style={{ marginBottom: 12 }}>
              <div>
                Imagem marcada para remoção — o limite volta a ser {LIMITE_SEM_IMAGEM} caracteres.{' '}
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setRemovendo(false);
                    setTemImagem(true);
                  }}
                >
                  Desfazer
                </button>
              </div>
              <input type="hidden" name="removerImagem" value="on" />
            </div>
          ) : null}

          <label className="field">
            <span className="lbl">Imagem (opcional)</span>
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
              JPEG, PNG ou WebP. A imagem é reduzida para no máximo 1600 px no lado maior,
              recomprimida e tem os metadados EXIF removidos.{' '}
              {nomeDoArquivo ? <b>Selecionado: {nomeDoArquivo}</b> : null}
            </span>
          </label>
        </>
      )}
    </>
  );
}
