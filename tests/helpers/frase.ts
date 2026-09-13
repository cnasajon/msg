/**
 * Monta a frase em português a partir do problema devolvido pelas validações.
 *
 * As funções de `lib/` devolvem chave e valores, não texto pronto — quem traduz
 * é a ação de servidor, no idioma de quem pediu. Os testes que conferem a
 * mensagem visível passam por aqui, o que de quebra prova que a chave existe no
 * arquivo de mensagens.
 */
import { textoDoProblema, type Problema } from '@/lib/avisos';
import pt from '../../messages/pt.json';

const AVISOS = pt.avisos as Record<string, string>;

/** Interpolação de `{nome}` — o suficiente para este grupo de mensagens. */
function traduzir(chave: string, valores?: Record<string, string | number>): string {
  const modelo = AVISOS[chave];
  if (modelo === undefined) throw new Error(`Mensagem sem tradução em pt: avisos.${chave}`);
  return modelo.replace(/\{(\w+)\}/g, (inteiro, nome: string) =>
    valores && nome in valores ? String(valores[nome]) : inteiro,
  );
}

export function frase(problema: Problema | null): string | null {
  return problema ? textoDoProblema(problema, traduzir, 'pt') : null;
}
