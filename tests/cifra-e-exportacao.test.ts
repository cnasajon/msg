/** Cifra do token de sobreposição e geração dos cinco formatos de exportação. */
import { describe, it, expect } from 'vitest';
import { cifrar, decifrar, mascarar } from '@/lib/cifra';
import { exportar, nomeDoArquivo, type TextoExportado } from '@/lib/exportacao';

describe('cifra do token de sobreposição', () => {
  const token = '123456789:AAHn-exemplo-de-token-que-nao-existe-0000';

  it('vai e volta', () => {
    expect(decifrar(cifrar(token))).toBe(token);
  });

  it('cada cifragem é diferente da anterior, mesmo para o mesmo token', () => {
    // vetor de inicialização aleatório: dois valores iguais no banco não
    // denunciam que duas pastas usam o mesmo bot
    expect(cifrar(token)).not.toBe(cifrar(token));
  });

  it('o texto cifrado não contém o token', () => {
    const guardado = cifrar(token);
    expect(guardado).not.toContain('123456789');
    expect(guardado).not.toContain('AAHn');
  });

  it('recusa valor adulterado', () => {
    const guardado = cifrar(token);
    const partes = guardado.split('.');
    partes[3] = Buffer.from('outra coisa').toString('base64url');
    expect(() => decifrar(partes.join('.'))).toThrow();
  });

  it('recusa formato desconhecido', () => {
    expect(() => decifrar('só um texto qualquer')).toThrow(/formato desconhecido/i);
  });

  it('a máscara mostra só o fim do token', () => {
    const mascarado = mascarar(token);
    expect(mascarado.endsWith(token.slice(-4))).toBe(true);
    expect(mascarado).not.toContain('123456789');
  });
});

describe('exportação', () => {
  const textos: TextoExportado[] = [
    {
      ordem: 1,
      conteudo: 'Primeiro texto, com acento e "aspas" & um <b>negrito</b>',
      situacao: 'pendente',
      publicadoEm: null,
      arquivadoEm: null,
      temImagem: true,
      caracteres: 55,
      criadoEm: new Date('2026-09-01T10:00:00Z'),
    },
    {
      ordem: null,
      conteudo: 'Segundo texto',
      situacao: 'publicado',
      publicadoEm: new Date('2026-09-10T10:00:00Z'),
      arquivadoEm: null,
      temImagem: false,
      caracteres: 13,
      criadoEm: new Date('2026-08-01T10:00:00Z'),
    },
  ];
  const contexto = {
    organizacao: 'OA Brasil',
    pasta: 'Uma Visão Para Você',
    timezone: 'America/Sao_Paulo',
    gerado: new Date('2026-09-12T12:00:00Z'),
    filtros: 'todas as situações',
  };

  it('CSV sai com cabeçalho, marca de bytes e o conteúdo', async () => {
    const bytes = await exportar('csv', textos, contexto);
    // a marca de ordem de bytes é o que faz o Excel abrir os acentos certos;
    // conferida nos bytes porque o TextDecoder a remove ao decodificar
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const saida = new TextDecoder().decode(bytes);
    expect(saida).toContain('Texto');
    expect(saida).toContain('Primeiro texto');
    expect(saida).toContain('Segundo texto');
  });

  it('JSON traz o contexto e os textos', async () => {
    const saida = JSON.parse(new TextDecoder().decode(await exportar('json', textos, contexto)));
    expect(saida.pasta).toBe('Uma Visão Para Você');
    expect(saida.total).toBe(2);
    expect(saida.textos[0].conteudo).toContain('Primeiro texto');
    expect(saida.textos[1].publicadoEm).toBe('2026-09-10T10:00:00.000Z');
  });

  it('XML escapa o que quebraria o arquivo', async () => {
    const saida = new TextDecoder().decode(await exportar('xml', textos, contexto));
    expect(saida.startsWith('<?xml')).toBe(true);
    expect(saida).toContain('&amp;');
    expect(saida).toContain('&lt;b&gt;');
    // nenhuma tag do conteúdo pode ter escapado para dentro da estrutura
    expect(saida).not.toContain('<b>');
  });

  it('XLSX sai como arquivo zip válido', async () => {
    const saida = await exportar('xlsx', textos, contexto);
    expect(saida.byteLength).toBeGreaterThan(1000);
    expect([saida[0], saida[1]]).toEqual([0x50, 0x4b]); // "PK"
  });

  it('PDF sai com o cabeçalho de PDF', async () => {
    const saida = await exportar('pdf', textos, contexto);
    expect(new TextDecoder().decode(saida.slice(0, 5))).toBe('%PDF-');
    expect(saida.byteLength).toBeGreaterThan(1000);
  });

  it('o nome do arquivo não leva acento nem espaço', () => {
    const nome = nomeDoArquivo('Uma Visão Para Você', 'csv', new Date('2026-09-12T12:00:00Z'));
    expect(nome).toBe('msg-uma-visao-para-voce-2026-09-12.csv');
  });
});
