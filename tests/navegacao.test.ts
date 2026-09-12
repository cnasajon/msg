/** Montagem do endereço de volta das ações, com a faixa de aviso. */
import { describe, it, expect } from 'vitest';
import { comAviso } from '@/lib/navegacao';

describe('comAviso', () => {
  it('acrescenta o aviso a um destino sem consulta', () => {
    expect(comAviso('/pastas', 'ok', 'Pasta criada.')).toBe('/pastas?ok=Pasta+criada.');
  });

  it('PRESERVA a consulta existente em vez de grudar outro "?"', () => {
    // o erro que isto evita: /textos?pasta=abc?erro=... — o segundo "?" vira
    // parte do valor de `pasta`, e a mensagem nunca aparece na tela
    const url = comAviso('/textos?pasta=abc', 'erro', 'Limite de 1024.');
    expect(url).toBe('/textos?pasta=abc&erro=Limite+de+1024.');
    expect(url.split('?').length).toBe(2);
    expect(new URLSearchParams(url.split('?')[1]).get('pasta')).toBe('abc');
  });

  it('troca um aviso anterior em vez de empilhar', () => {
    const url = comAviso('/usuarios?ok=Salvo&editar=7', 'erro', 'Falhou.');
    const parametros = new URLSearchParams(url.split('?')[1]);
    expect(parametros.get('ok')).toBeNull();
    expect(parametros.get('erro')).toBe('Falhou.');
    expect(parametros.get('editar')).toBe('7');
  });

  it('escapa o que quebraria a URL', () => {
    const url = comAviso('/pastas', 'erro', 'Senha provisória: a&b=c ?x');
    const parametros = new URLSearchParams(url.split('?')[1]);
    expect(parametros.get('erro')).toBe('Senha provisória: a&b=c ?x');
  });
});
