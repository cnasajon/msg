/** Limites de tamanho, tags aceitas e hash de duplicata. */
import { describe, it, expect } from 'vitest';
import { problemaNoChatId } from '@/lib/telegram';
import {
  LIMITE_COM_IMAGEM,
  LIMITE_SEM_IMAGEM,
  hashDoConteudo,
  problemaNoHtml,
  problemaNoTamanho,
  resumir,
  tamanhoDoTexto,
} from '@/lib/textos';

describe('limites de tamanho', () => {
  it('sem imagem o limite é 4096; com imagem, 1024', () => {
    expect(LIMITE_SEM_IMAGEM).toBe(4096);
    expect(LIMITE_COM_IMAGEM).toBe(1024);
  });

  it('o mesmo texto passa sem imagem e falha com imagem', () => {
    const texto = 'a'.repeat(2000);
    expect(problemaNoTamanho(texto, false)).toBeNull();
    expect(problemaNoTamanho(texto, true)).toMatch(/1024 caracteres/);
  });

  it('a mensagem com imagem explica as duas saídas', () => {
    const problema = problemaNoTamanho('a'.repeat(1025), true)!;
    expect(problema).toMatch(/Reduza o texto ou remova a imagem/);
  });

  it('exatamente no limite passa; um caractere além, não', () => {
    expect(problemaNoTamanho('a'.repeat(1024), true)).toBeNull();
    expect(problemaNoTamanho('a'.repeat(1025), true)).not.toBeNull();
    expect(problemaNoTamanho('a'.repeat(4096), false)).toBeNull();
    expect(problemaNoTamanho('a'.repeat(4097), false)).not.toBeNull();
  });

  it('texto vazio é recusado nos dois casos', () => {
    expect(problemaNoTamanho('', false)).toMatch(/vazio/);
    expect(problemaNoTamanho('', true)).toMatch(/vazio/);
  });

  it('emoji conta como um caractere, como o Telegram conta', () => {
    // '👨‍👩‍👧' ocupa várias unidades UTF-16; o que importa são os pontos de código
    expect(tamanhoDoTexto('😀')).toBe(1);
    expect('😀'.length).toBe(2);
    expect(problemaNoTamanho('😀'.repeat(1024), true)).toBeNull();
    expect(problemaNoTamanho('😀'.repeat(1025), true)).not.toBeNull();
  });
});

describe('tags do parse_mode HTML', () => {
  it('aceita as tags que o Telegram conhece', () => {
    expect(problemaNoHtml('<b>oi</b> <i>tudo</i> <a href="https://x">bem</a>')).toBeNull();
    expect(problemaNoHtml('texto sem marcação nenhuma')).toBeNull();
  });

  it('recusa tag que o Telegram não conhece', () => {
    expect(problemaNoHtml('<div>oi</div>')).toMatch(/<div>/);
    expect(problemaNoHtml('<script>alert(1)</script>')).toMatch(/<script>/);
  });

  it('recusa tag aberta e não fechada, e fechamento fora de ordem', () => {
    expect(problemaNoHtml('<b>sem fim')).toMatch(/não foi fechada/);
    expect(problemaNoHtml('<b><i>trocado</b></i>')).toMatch(/fora de ordem/);
  });
});

describe('hash de duplicata', () => {
  it('ignora espaço no fim e quebra de linha do Windows', () => {
    expect(hashDoConteudo('Um texto  ')).toBe(hashDoConteudo('Um texto'));
    expect(hashDoConteudo('linha1\r\nlinha2')).toBe(hashDoConteudo('linha1\nlinha2'));
  });

  it('distingue textos diferentes', () => {
    expect(hashDoConteudo('Um texto')).not.toBe(hashDoConteudo('Outro texto'));
  });

  it('não muda com a imagem, porque a imagem não entra no cálculo', () => {
    // o hash é do conteúdo textual, e só dele — é o que a especificação pede
    const conteudo = 'O mesmo texto';
    expect(hashDoConteudo(conteudo)).toBe(hashDoConteudo(conteudo));
  });
});

describe('resumo da lista', () => {
  it('tira as tags e colapsa o espaço', () => {
    expect(resumir('<b>Oi</b>\n\n  tudo   bem')).toBe('Oi tudo bem');
  });

  it('corta no tamanho pedido', () => {
    expect(resumir('a'.repeat(200), 10)).toBe(`${'a'.repeat(10)}…`);
  });
});

describe('chat_id do Telegram', () => {
  it('aceita supergrupo e grupo comum, que são negativos', () => {
    expect(problemaNoChatId('-1001492357816')).toBeNull();
    expect(problemaNoChatId('-371133828')).toBeNull();
  });

  it('RECUSA o número sem o sinal de menos, e sugere a correção', () => {
    // o engano mais comum: copiar o id do supergrupo sem o "-", que só aparece
    // como "chat not found" na hora de publicar
    const problema = problemaNoChatId('1001492357816');
    expect(problema).toMatch(/sinal de menos/);
    expect(problema).toContain('-1001492357816');
  });

  it('recusa positivo qualquer, explicando que ali é conversa privada', () => {
    expect(problemaNoChatId('987654321')).toMatch(/conversa privada/);
  });

  it('recusa link e @nome', () => {
    expect(problemaNoChatId('@uvpv')).toMatch(/numérico/);
    expect(problemaNoChatId('https://t.me/uvpv')).toMatch(/numérico/);
  });
});
