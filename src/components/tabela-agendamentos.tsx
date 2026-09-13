'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const dias = useTranslations('dias');
  const [escolhidos, setEscolhidos] = useState<number[]>(iniciais);

  return (
    <>
      <div className="days">
        {DIAS_DA_SEMANA.map((iso) => {
          const ligado = escolhidos.includes(iso);
          return (
            <span
              key={iso}
              className={ligado ? 'on' : undefined}
              role="checkbox"
              aria-checked={ligado}
              tabIndex={0}
              onClick={() =>
                setEscolhidos((atuais) =>
                  atuais.includes(iso) ? atuais.filter((d) => d !== iso) : [...atuais, iso],
                )
              }
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setEscolhidos((atuais) =>
                    atuais.includes(iso) ? atuais.filter((d) => d !== iso) : [...atuais, iso],
                  );
                }
              }}
            >
              {dias(String(iso))}
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
  const t = useTranslations('agendamentos');
  const dias = useTranslations('dias');
  const comum = useTranslations('comum');
  const [emEdicao, setEmEdicao] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  return (
    <>
      <table>
        <thead>
          <tr>
            <th style={{ width: 92 }}>{t('hora')}</th>
            <th>{t('dias')}</th>
            <th style={{ width: 92 }}>{t('situacao')}</th>
            <th style={{ width: 128 }} />
          </tr>
        </thead>
        <tbody>
          {agendamentos.length === 0 && !criando ? (
            <tr>
              <td colSpan={4} className="faint">
                {t('nenhum')}
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
                        <span className="lbl">{t('hora')}</span>
                        <input type="time" name="horaLocal" defaultValue={a.horaLocal} required />
                      </label>
                      <div style={{ flex: 'none' }}>
                        <span className="lbl" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                          {dias('diasDaSemana')}
                        </span>
                        <Dias iniciais={a.diasSemana} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                        <button className="btn primary" type="submit">
                          {comum('salvar')}
                        </button>
                        <button className="btn" type="button" onClick={() => setEmEdicao(null)}>
                          {comum('cancelar')}
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
                <td>{resumirDias(a.diasSemana, dias)}</td>
                <td>
                  <span className={a.ativo ? 'pill ok' : 'pill'}>
                    {a.ativo ? t('ativo') : t('pausado')}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="iconbtn"
                    type="button"
                    title={t('editarHoraEDias')}
                    aria-label={t('editarAgendamento')}
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
                      {a.ativo ? t('pausar') : t('ativar')}
                    </button>
                  </form>{' '}
                  <form action={acoes.excluir} style={{ display: 'inline' }}>
                    {csrf}
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn sm danger" type="submit" title={t('excluirAgendamento')}>
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
                      <span className="lbl">{t('hora')}</span>
                      <input type="time" name="horaLocal" defaultValue="07:00" required autoFocus />
                    </label>
                    <div style={{ flex: 'none' }}>
                      <span className="lbl" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
                        {dias('diasDaSemana')}
                      </span>
                      <Dias iniciais={[1, 2, 3, 4, 5]} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                      <button className="btn primary" type="submit">
                        {t('adicionar')}
                      </button>
                      <button className="btn" type="button" onClick={() => setCriando(false)}>
                        {comum('cancelar')}
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
            {t('novoAgendamento')}
          </button>
          <span className="faint">{t('tolerancia')}</span>
        </div>
      ) : null}
    </>
  );
}
