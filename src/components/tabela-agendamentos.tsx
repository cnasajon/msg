'use client';

import { useState } from 'react';
import { DIAS_DA_SEMANA, resumirDias } from '@/lib/agenda';

type Agendamento = { id: string; horaLocal: string; diasSemana: number[]; ativo: boolean };

type Acoes = {
  criar: (dados: FormData) => void;
  editar: (dados: FormData) => void;
  alternar: (dados: FormData) => void;
  excluir: (dados: FormData) => void;
};

/** Escolha de dias, usada tanto na linha em edicao quanto na linha nova. */
function Dias({ iniciais }: { iniciais: number[] }) {
  const [escolhidos, setEscolhidos] = useState<number[]>(iniciais);

  return (
    <>
      <div className="days">
        {DIAS_DA_SEMANA.map((dia) => {
          const ligado = escolhidos.includes(dia.iso);
          return (
            <span
              key={dia.iso}
              className={ligado ? 'on' : undefined}
              role="checkbox"
              aria-checked={ligado}
              tabIndex={0}
              onClick={() =>
                setEscolhidos((atuais) =>
                  atuais.includes(dia.iso) ? atuais.filter((d) => d !== dia.iso) : [...atuais, dia.iso],
                )
              }
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setEscolhidos((atuais) =>
                    atuais.includes(dia.iso) ? atuais.filter((d) => d !== dia.iso) : [...atuais, dia.iso],
                  );
                }
              }}
            >
              {dia.sigla}
            </span>
          );
        })}
      </div>
      {escolhidos.map((iso) => (
        <input key={iso} type="hidden" name="diasSemana" value={iso} />
      ))}
    </>
  );
}

/**
 * Agendamentos editados na propria linha.
 *
 * A versao anterior tinha um formulario fixo embaixo da tabela, que ficava ali
 * ocupando espaco mesmo sem ninguem estar criando nada. Aqui a linha vira
 * formulario quando se clica no lapis, e a linha nova so aparece depois do
 * "Novo agendamento" — a tabela volta a ser uma tabela.
 */
export function TabelaDeAgendamentos({
  agendamentos,
  folderId,
  csrf,
  acoes,
}: {
  agendamentos: Agendamento[];
  folderId: string;
  csrf: React.ReactNode;
  acoes: Acoes;
}) {
  const [emEdicao, setEmEdicao] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  return (
    <>
      <table>
        <thead>
          <tr>
            <th style={{ width: 92 }}>Hora</th>
            <th>Dias</th>
            <th style={{ width: 92 }}>Situação</th>
            <th style={{ width: 128 }} />
          </tr>
        </thead>
        <tbody>
          {agendamentos.length === 0 && !criando ? (
            <tr>
              <td colSpan={4} className="faint">
                Nenhum agendamento. Sem ao menos um, esta pasta nunca publica.
              </td>
            </tr>
          ) : null}

          {agendamentos.map((a) =>
            emEdicao === a.id ? (
              <tr key={a.id}>
                <td colSpan={4}>
                  <form action={acoes.editar}>
                    {csrf}
                    <input type="hidden" name="id" value={a.id} />
                    <div className="linha-edicao">
                      <label className="field" style={{ margin: 0, width: 110, flex: 'none' }}>
                        <span className="lbl">Hora</span>
                        <input type="time" name="horaLocal" defaultValue={a.horaLocal} required />
                      </label>
                      <div style={{ flex: 'none' }}>
                        <span className="lbl" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                          Dias da semana
                        </span>
                        <Dias iniciais={a.diasSemana} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                        <button className="btn primary" type="submit">
                          Salvar
                        </button>
                        <button className="btn" type="button" onClick={() => setEmEdicao(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={a.id}>
                <td className="num">
                  <b>{a.horaLocal}</b>
                </td>
                <td>{resumirDias(a.diasSemana)}</td>
                <td>
                  <span className={a.ativo ? 'pill ok' : 'pill'}>{a.ativo ? 'ativo' : 'pausado'}</span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="iconbtn"
                    type="button"
                    title="Editar hora e dias"
                    aria-label="Editar agendamento"
                    onClick={() => {
                      setEmEdicao(a.id);
                      setCriando(false);
                    }}
                  >
                    ✎
                  </button>{' '}
                  <form action={acoes.alternar} style={{ display: 'inline' }}>
                    {csrf}
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn sm" type="submit">
                      {a.ativo ? 'Pausar' : 'Ativar'}
                    </button>
                  </form>{' '}
                  <form action={acoes.excluir} style={{ display: 'inline' }}>
                    {csrf}
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn sm danger" type="submit" title="Excluir agendamento">
                      ✕
                    </button>
                  </form>
                </td>
              </tr>
            ),
          )}

          {criando ? (
            <tr>
              <td colSpan={4}>
                <form action={acoes.criar}>
                  {csrf}
                  <input type="hidden" name="folderId" value={folderId} />
                  <div className="linha-edicao">
                    <label className="field" style={{ margin: 0, width: 110, flex: 'none' }}>
                      <span className="lbl">Hora</span>
                      <input type="time" name="horaLocal" defaultValue="07:00" required autoFocus />
                    </label>
                    <div style={{ flex: 'none' }}>
                      <span className="lbl" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                        Dias da semana
                      </span>
                      <Dias iniciais={[1, 2, 3, 4, 5]} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                      <button className="btn primary" type="submit">
                        Adicionar
                      </button>
                      <button className="btn" type="button" onClick={() => setCriando(false)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                </form>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {!criando ? (
        <div className="body" style={{ borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setCriando(true);
              setEmEdicao(null);
            }}
          >
            Novo agendamento
          </button>
          <span className="faint">
            O worker acorda a cada cinco minutos e tem trinta de tolerância: passado isso, o slot é
            marcado como perdido e nunca publicado com atraso.
          </span>
        </div>
      ) : null}
    </>
  );
}
