/**
 * Monta a frase em português a partir do problema devolvido pelas validações.
 *
 * As funções de `lib/` devolvem chave e valores, não texto pronto — quem traduz
 * é a ação de servidor, no idioma de quem pediu. Os testes que conferem a
 * mensagem visível passam por aqui, o que de quebra prova que a chave existe no
 * arquivo de mensagens.
 */
import { fraseNoIdioma } from '@/lib/mensagens';
import type { Problema } from '@/lib/avisos';

export function frase(problema: Problema | null): string | null {
  return problema ? fraseNoIdioma(problema, 'pt') : null;
}
