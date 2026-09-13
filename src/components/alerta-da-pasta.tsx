'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Linha de configuração do alerta de fila curta, na tela de Alertas.
 *
 * A chave salva sozinha, no clique — é o gesto de "silencia isto agora", e
 * obrigar a procurar um botão depois faria a pessoa achar que já silenciou
 * quando ainda não. O número não: ele salva no Enter ou quando o campo perde o
 * foco, senão cada dígito digitado viraria uma gravação, e "12" passaria por
 * "1" no caminho.
 *
 * Com a chave desligada o número fica inerte — continua visível, porque é o
 * valor que volta a valer quando o alerta for religado.
 */
export function AlertaDaPasta({
  id,
  ativo,
  minimo,
  editavel,
  csrf,
  acao,
}: {
  id: string;
  ativo: boolean;
  minimo: number;
  editavel: boolean;
  csrf: React.ReactNode;
  acao: (dados: FormData) => void | Promise<void>;
}) {
  const t = useTranslations('alertas');
  const formulario = useRef<HTMLFormElement>(null);

  if (!editavel) {
    return (
      <>
        <td>
          <span className={ativo ? 'pill ok' : 'pill'}>{ativo ? t('ligado') : t('desligado')}</span>
        </td>
        <td className="num">{ativo ? minimo : <span className="faint">—</span>}</td>
      </>
    );
  }

  return (
    <>
      <td>
        <form action={acao} ref={formulario} id={`alerta-${id}`}>
          {csrf}
          <input type="hidden" name="id" value={id} />
          <label className="chave" title={ativo ? t('desligarAlerta') : t('ligarAlerta')}>
            <input
              type="checkbox"
              name="alertaDeFilaCurtaAtivo"
              defaultChecked={ativo}
              onChange={() => formulario.current?.requestSubmit()}
            />
            <span className="chave-trilho" aria-hidden="true">
              <span className="chave-bolinha" />
            </span>
            <span className="chave-texto">{ativo ? t('ligado') : t('desligado')}</span>
          </label>
        </form>
      </td>
      <td>
        <input
          form={`alerta-${id}`}
          type="number"
          name="alertarAbaixoDe"
          defaultValue={minimo}
          min={1}
          max={999}
          disabled={!ativo}
          aria-label={t('minimo')}
          style={{ width: 84 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              formulario.current?.requestSubmit();
            }
          }}
          onBlur={(e) => {
            if (e.currentTarget.value !== String(minimo)) formulario.current?.requestSubmit();
          }}
        />
      </td>
    </>
  );
}
