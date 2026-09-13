/**
 * Tradução fora do next-intl.
 *
 * O worker não tem requisição nem sessão: quando ele grava o erro de uma
 * publicação ou o texto de um alerta, o idioma que faz sentido é o da
 * organização daquela pasta. Este módulo lê os mesmos arquivos de mensagens da
 * interface, sem passar pelo next-intl.
 *
 * Vive separado de `avisos.ts` de propósito: aqui os três arquivos de mensagens
 * entram no pacote, e `avisos.ts` é alcançado por código que roda no navegador.
 */
import { IDIOMA_PADRAO, idiomaValido } from '@/i18n/idiomas';
import { textoDoProblema, type Problema } from './avisos';
import pt from '../../messages/pt.json';
import es from '../../messages/es.json';
import en from '../../messages/en.json';

const ARQUIVOS = { pt, es, en };

/** Interpolação de `{nome}` — é tudo que o grupo `avisos` usa. */
function interpolar(modelo: string, valores?: Record<string, string | number>): string {
  return modelo.replace(/\{(\w+)\}/g, (inteiro, nome: string) =>
    valores && nome in valores ? String(valores[nome]) : inteiro,
  );
}

export function fraseNoIdioma(problema: Problema, idioma: string | null | undefined): string {
  const escolhido = idiomaValido(idioma) ?? IDIOMA_PADRAO;
  const avisos = ARQUIVOS[escolhido].avisos as Record<string, string>;

  return textoDoProblema(
    problema,
    (chave, valores) => {
      const modelo = avisos[chave];
      if (modelo === undefined) throw new Error(`Mensagem sem tradução: avisos.${chave}`);
      return interpolar(modelo, valores);
    },
    escolhido,
  );
}
