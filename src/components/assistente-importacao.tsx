'use client';

import { useRef, useState } from 'react';

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
        setErro(corpo.erro ?? 'Não foi possível ler o arquivo.');
        setPrevia(null);
      } else {
        setPrevia(corpo as Previa);
      }
    } catch {
      setErro('Falha ao falar com o servidor.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <div className="card">
        <header>
          <h2>1. Arquivo e mapeamento</h2>
          {carregando ? <span className="sub">analisando…</span> : null}
        </header>
        <div className="body">
          <div className="row">
            <label className="field" style={{ margin: 0 }}>
              <span className="lbl">Arquivo CSV ou XLSX</span>
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
              <span className="hint">A importação é somente texto — imagens entram pela edição de cada texto.</span>
            </label>
          </div>

          {previa ? (
            <div className="row" style={{ marginTop: 14 }}>
              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">Coluna do texto</span>
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
                <span className="lbl">Coluna da data de publicação (opcional)</span>
                <select
                  value={colunaData}
                  onChange={(e) => {
                    const valor = Number(e.target.value);
                    setColunaData(valor);
                    void analisar({ colunaData: valor });
                  }}
                >
                  <option value={-1}>— nenhuma: tudo entra como pendente —</option>
                  {previa.colunas.map((c, i) => (
                    <option key={c} value={i}>
                      {c}
                      {previa.cabecalho[i] ? ` — ${previa.cabecalho[i]}` : ''}
                    </option>
                  ))}
                </select>
                <span className="hint">
                  Preenchida, a linha entra como <b>publicado</b> naquela data — é assim que se traz o
                  histórico de outro aplicativo. O dispatcher nunca reenvia essas linhas.
                </span>
              </label>

              <label className="field" style={{ margin: 0 }}>
                <span className="lbl">Primeira linha</span>
                <select
                  value={cabecalho ? 'sim' : 'nao'}
                  onChange={(e) => {
                    const valor = e.target.value === 'sim';
                    setCabecalho(valor);
                    void analisar({ cabecalho: valor });
                  }}
                >
                  <option value="sim">é cabeçalho</option>
                  <option value="nao">já é dado</option>
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
            Não há coluna de ordem para mapear: a ordem da fila é a ordem das linhas do arquivo.
          </p>
        </div>
      </div>

      {previa ? (
        <div className="card">
          <header>
            <h2>2. Conferência</h2>
            <span className="spacer" />
            <span className="sub">
              {previa.total} linhas · {previa.importaveis} importáveis
              {previa.comoHistorico > 0 ? ` (${previa.comoHistorico} como histórico)` : ''} ·{' '}
              {previa.duplicadas} duplicadas · {previa.descartadas} descartadas
            </span>
          </header>
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Linha</th>
                <th>Texto</th>
                <th style={{ width: 100 }}>Caracteres</th>
                <th style={{ width: 130 }}>Publicada em</th>
                <th style={{ width: 230 }}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {previa.amostra.map((linha) => (
                <tr key={linha.numero}>
                  <td className="num">{linha.numero}</td>
                  <td>{linha.resumo || <span className="faint">(vazia)</span>}</td>
                  <td className="num">{linha.caracteres}</td>
                  <td>{linha.publicadaEm ?? <span className="faint">—</span>}</td>
                  <td>
                    <span className={CLASSE_DA_SITUACAO[linha.situacao] ?? 'pill'}>{linha.explicacao}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {previa.total > previa.amostra.length ? (
            <div className="body" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="faint">
                Mostrando as {previa.amostra.length} primeiras linhas de {previa.total}. A importação
                processa o arquivo inteiro.
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
                Importar {previa.importaveis} texto(s)
              </button>
            </form>
            <span className="faint">
              As duplicatas e as linhas descartadas não são gravadas. Tudo entra numa transação só.
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}
