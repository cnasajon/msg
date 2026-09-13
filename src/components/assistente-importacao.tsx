'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ajuda } from './ajuda';

type Amostra = {
  numero: number;
  resumo: string;
  caracteres: number;
  publicadaEm: string | null;
  situacao: string;
  explicacao: string;
};

type Previa = {
  colunas: string[];
  cabecalho: string[];
  total: number;
  importaveis: number;
  comoHistorico: number;
  duplicadas: number;
  descartadas: number;
  amostra: Amostra[];
};

const CLASSE_DA_SITUACAO: Record<string, string> = {
  importar: 'pill ok',
  importar_como_historico: 'pill info',
  duplicada: 'pill warn',
  vazia: 'pill warn',
  acima_do_limite: 'pill err',
  data_invalida: 'pill err',
};

/**
 * Importação em duas etapas sem armazenamento intermediário: o arquivo fica na
 * memória do navegador entre a pré-visualização e a confirmação, e é enviado de
 * novo na hora de gravar. Evita guardar arquivo do usuário em disco ou no banco
 * só para sobreviver entre dois cliques.
 */
export function AssistenteDeImportacao({
  folderId,
  csrf,
  acao,
}: {
  folderId: string;
  csrf: React.ReactNode;
  acao: (dados: FormData) => void;
}) {
  const t = useTranslations('importacao');
  const situacoes = useTranslations('situacoesDaLinha');
  const rotulos = useTranslations('textos');
  const comum = useTranslations('comum');
  const entradaDeArquivo = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [colunaTexto, setColunaTexto] = useState(0);
  const [colunaData, setColunaData] = useState(-1);
  const [cabecalho, setCabecalho] = useState(true);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function analisar(
    proximo: { arquivo?: File | null; colunaTexto?: number; colunaData?: number; cabecalho?: boolean } = {},
  ) {
    const alvo = proximo.arquivo ?? arquivo;
    if (!alvo) return;

    setCarregando(true);
    setErro(null);
    const dados = new FormData();
    dados.set('arquivo', alvo);
    dados.set('folderId', folderId);
    dados.set('colunaTexto', String(proximo.colunaTexto ?? colunaTexto));
    dados.set('colunaData', String(proximo.colunaData ?? colunaData));
    if (proximo.cabecalho ?? cabecalho) dados.set('cabecalho', 'on');

    try {
      const resposta = await fetch('/api/importacao/previa', { method: 'POST', body: dados });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo.erro ?? t('erroLerArquivo'));
        setPrevia(null);
      } else {
        setPrevia(corpo as Previa);
      }
    } catch {
      setErro(t('erroServidor'));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <div className="card">
        <header>
          <h2>{t('passoArquivo')}</h2>
          {carregando ? <span className="sub">{t('analisando')}</span> : null}
        </header>
        <div className="body">
          <div className="row">
            <label className="field" style={{ margin: 0 }}>
              <span className="lbl">
                {t('arquivo')}
                <Ajuda texto={t('somenteTexto')} rotulo={comum('ajudaSobre', { campo: t('arquivo') })} />
              </span>
              <input
                ref={entradaDeArquivo}
                type="file"
                accept=".csv,.txt,.xlsx,.xlsm"
                onChange={(e) => {
                  const escolhido = e.target.files?.[0] ?? null;
                  setArquivo(escolhido);
                  setPrevia(null);
                  if (escolhido) void analisar({ arquivo: escolhido });
                }}
              />
            </label>
          </div>

          {previa ? (
            <div className="row" style={{ marginTop: 14 }}>
              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">{t('colunaTexto')}</span>
                <select
                  value={colunaTexto}
                  onChange={(e) => {
                    const valor = Number(e.target.value);
                    setColunaTexto(valor);
                    void analisar({ colunaTexto: valor });
                  }}
                >
                  {previa.colunas.map((c, i) => (
                    <option key={c} value={i}>
                      {c}
                      {previa.cabecalho[i] ? ` — ${previa.cabecalho[i]}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">
                  {t('colunaData')}
                  <Ajuda
                    texto={t.rich('colunaDataExplicacao', { b: (partes) => <b>{partes}</b> })}
                    rotulo={comum('ajudaSobre', { campo: t('colunaData') })}
                  />
                </span>
                <select
                  value={colunaData}
                  onChange={(e) => {
                    const valor = Number(e.target.value);
                    setColunaData(valor);
                    void analisar({ colunaData: valor });
                  }}
                >
                  <option value={-1}>{t('nenhumaColunaData')}</option>
                  {previa.colunas.map((c, i) => (
                    <option key={c} value={i}>
                      {c}
                      {previa.cabecalho[i] ? ` — ${previa.cabecalho[i]}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">{t('primeiraLinha')}</span>
                <select
                  value={cabecalho ? 'sim' : 'nao'}
                  onChange={(e) => {
                    const valor = e.target.value === 'sim';
                    setCabecalho(valor);
                    void analisar({ cabecalho: valor });
                  }}
                >
                  <option value="sim">{t('ehCabecalho')}</option>
                  <option value="nao">{t('jaEhDado')}</option>
                </select>
              </label>
            </div>
          ) : null}

          {erro ? (
            <div className="banner err" style={{ marginTop: 14 }}>
              <div>{erro}</div>
            </div>
          ) : null}

          <p className="faint" style={{ margin: '12px 0 0' }}>
            {t('semColunaDeOrdem')}
          </p>
        </div>
      </div>

      {previa ? (
        <div className="card">
          <header>
            <h2>{t('passoConferencia')}</h2>
            <span className="spacer" />
            <span className="sub">
              {t('resumo', {
                total: previa.total,
                importaveis: previa.importaveis,
                duplicadas: previa.duplicadas,
                descartadas: previa.descartadas,
              })}
              {previa.comoHistorico > 0
                ? ` ${t('comoHistorico', { quantidade: previa.comoHistorico })}`
                : ''}
            </span>
          </header>
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>{t('linha')}</th>
                <th>{rotulos('texto')}</th>
                <th style={{ width: 100 }}>{t('caracteres')}</th>
                <th style={{ width: 130 }}>{t('publicadaEm')}</th>
                <th style={{ width: 230 }}>{rotulos('situacao')}</th>
              </tr>
            </thead>
            <tbody>
              {previa.amostra.map((linha) => (
                <tr key={linha.numero}>
                  <td className="num">{linha.numero}</td>
                  <td>{linha.resumo || <span className="faint">{t('vazia')}</span>}</td>
                  <td className="num">{linha.caracteres}</td>
                  <td>{linha.publicadaEm ?? <span className="faint">{comum('nenhum')}</span>}</td>
                  <td>
                    <span className={CLASSE_DA_SITUACAO[linha.situacao] ?? 'pill'}>
                      {linha.situacao in CLASSE_DA_SITUACAO
                        ? situacoes(linha.situacao)
                        : linha.explicacao}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {previa.total > previa.amostra.length ? (
            <div className="body" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="faint">
                {t('mostrandoPrimeiras', { mostradas: previa.amostra.length, total: previa.total })}
              </span>
            </div>
          ) : null}

          <div
            className="body"
            style={{ borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}
          >
            <form
              action={(dados) => {
                if (arquivo) dados.set('arquivo', arquivo);
                acao(dados);
              }}
            >
              {csrf}
              <input type="hidden" name="folderId" value={folderId} />
              <input type="hidden" name="colunaTexto" value={colunaTexto} />
              <input type="hidden" name="colunaData" value={colunaData} />
              {cabecalho ? <input type="hidden" name="cabecalho" value="on" /> : null}
              <button className="btn primary" type="submit" disabled={previa.importaveis === 0}>
                {t('importarBotao', { quantidade: previa.importaveis })}
              </button>
            </form>
            <span className="faint">{t('duplicatasNaoGravadas')}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
