'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Ajuda } from './ajuda';

/**
 * Versão em linha, para a barra de campos da pasta nova.
 *
 * Mesma regra da versão de bloco — o que vale só para fila some ao escolher
 * data —, mas com selects lado a lado, que é o formato daquela barra. Na
 * criação não há link para os textos: a pasta ainda não existe.
 */
export function CamposDoTipoDeListaEmLinha() {
  const t = useTranslations('pastas');
  const comum = useTranslations('comum');
  const [tipo, setTipo] = useState<'fila' | 'data'>('fila');

  return (
    <>
      <label className="field" style={{ margin: 0 }}>
        <span className="lbl">
          {t('tipoDeLista')}
          <Ajuda texto={t('tipoDeListaHint')} rotulo={comum('ajudaSobre', { campo: t('tipoDeLista') })} />
        </span>
        <select
          name="tipoDeLista"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as 'fila' | 'data')}
        >
          <option value="fila">{t('tipoFila')}</option>
          <option value="data">{t('tipoData')}</option>
        </select>
      </label>

      {tipo === 'fila' ? (
        <>
          <label className="field" style={{ margin: 0 }}>
            <span className="lbl">{t('aoEsgotarFila')}</span>
            <select name="aoEsgotar" defaultValue="parar_notificar">
              <option value="parar_notificar">{t('pararNotificarOpcao')}</option>
              <option value="reiniciar">{t('reiniciarOpcao')}</option>
            </select>
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span className="lbl">
              {t('alertarAbaixoDe')}
              <Ajuda
                texto={t('alertarAbaixoDeHint')}
                rotulo={comum('ajudaSobre', { campo: t('alertarAbaixoDe') })}
              />
            </span>
            <input type="number" name="alertarAbaixoDe" min={0} max={999} defaultValue={5} style={{ maxWidth: 120 }} />
          </label>
        </>
      ) : (
        <p className="faint" style={{ margin: 0, alignSelf: 'center', maxWidth: 320 }}>
          {t('ondeVaiAData')}
        </p>
      )}
    </>
  );
}

/**
 * O select de tipo de lista e os campos que só existem para um dos tipos.
 *
 * Vivem juntos porque a troca precisa aparecer na hora: escolher "baseada em
 * data" e continuar vendo "ao esgotar a fila" faz a tela parecer quebrada — e
 * esconde a única coisa que a pessoa precisa saber, que é onde a data vai. Ela
 * não fica na pasta: é de cada texto, e o campo está na tela de Textos. Aqui o
 * agendamento diz apenas em que horários e dias da semana existe slot.
 */
export function CamposDoTipoDeLista({
  tipoInicial,
  alertarAbaixoDeInicial,
  aoEsgotarInicial,
  folderId,
}: {
  tipoInicial: 'fila' | 'data';
  alertarAbaixoDeInicial: number;
  aoEsgotarInicial: 'parar_notificar' | 'reiniciar';
  /** Ausente na criação, quando a pasta ainda não tem textos para apontar. */
  folderId?: string;
}) {
  const t = useTranslations('pastas');
  const comum = useTranslations('comum');
  const [tipo, setTipo] = useState(tipoInicial);
  const porData = tipo === 'data';

  return (
    <>
      <label className="field">
        <span className="lbl">
          {t('tipoDeLista')}
          <Ajuda texto={t('tipoDeListaHint')} rotulo={comum('ajudaSobre', { campo: t('tipoDeLista') })} />
        </span>
        <select
          name="tipoDeLista"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as 'fila' | 'data')}
        >
          <option value="fila">{t('tipoFila')}</option>
          <option value="data">{t('tipoData')}</option>
        </select>
      </label>

      {porData ? (
        <>
          {/* O que vale só para fila continua guardado, para a pasta não perder
              a configuração se algum dia voltar a ser uma fila. Sem isto, o
              campo ausente no envio faria a ação gravar o valor padrão. */}
          <input type="hidden" name="aoEsgotar" value={aoEsgotarInicial} />
          <input type="hidden" name="alertarAbaixoDe" value={alertarAbaixoDeInicial} />
          <div className="banner info" style={{ marginTop: 12 }}>
            <div>
              <div className="ttl">{t('ondeVaiADataTitulo')}</div>
              {t('ondeVaiAData')}{' '}
              {folderId ? <Link href={`/textos?pasta=${folderId}`}>{t('irParaOsTextos')}</Link> : null}
            </div>
          </div>
        </>
      ) : (
        <>
          <h3 style={{ fontSize: 13, margin: '18px 0 8px' }}>{t('aoEsgotarFila')}</h3>
          <div className="check">
            <input
              type="radio"
              id="esgotar-parar"
              name="aoEsgotar"
              value="parar_notificar"
              defaultChecked={aoEsgotarInicial === 'parar_notificar'}
            />
            <label htmlFor="esgotar-parar">
              {t.rich('pararNotificarExplicacao', { b: (partes) => <b>{partes}</b> })}
            </label>
          </div>
          <div className="check">
            <input
              type="radio"
              id="esgotar-reiniciar"
              name="aoEsgotar"
              value="reiniciar"
              defaultChecked={aoEsgotarInicial === 'reiniciar'}
            />
            <label htmlFor="esgotar-reiniciar">
              {t.rich('reiniciarExplicacao', { b: (partes) => <b>{partes}</b> })}
            </label>
          </div>

          <label className="field" style={{ marginTop: 14 }}>
            <span className="lbl">
              {t('alertarAbaixoDe')}
              <Ajuda
                texto={t('alertarAbaixoDeHint')}
                rotulo={comum('ajudaSobre', { campo: t('alertarAbaixoDe') })}
              />
            </span>
            <input
              type="number"
              name="alertarAbaixoDe"
              min={0}
              max={999}
              defaultValue={alertarAbaixoDeInicial}
              style={{ maxWidth: 120 }}
            />
          </label>
        </>
      )}
    </>
  );
}
