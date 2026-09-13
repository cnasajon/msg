/**
 * Integridade das traduções.
 *
 * Dois erros silenciosos que este teste pega: uma chave que existe em português
 * e some no espanhol — a tela mostra o nome da chave crua para quem escolheu
 * aquele idioma —, e uma chave usada no código que nunca foi escrita nas
 * mensagens. Nenhum dos dois quebra o build.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GRUPOS_DO_CLIENTE } from '@/i18n/idiomas';
import pt from '../messages/pt.json';
import es from '../messages/es.json';
import en from '../messages/en.json';

type Mensagens = Record<string, Record<string, string>>;

const IDIOMAS: Record<string, Mensagens> = { pt, es, en };

function chavesDe(mensagens: Mensagens): string[] {
  return Object.entries(mensagens)
    .flatMap(([grupo, pares]) => Object.keys(pares).map((chave) => `${grupo}.${chave}`))
    .sort();
}

/** Todo arquivo .ts/.tsx sob src/. */
function arquivosDaAplicacao(diretorio = 'src'): string[] {
  return readdirSync(diretorio).flatMap((nome) => {
    const caminho = join(diretorio, nome);
    if (statSync(caminho).isDirectory()) return arquivosDaAplicacao(caminho);
    return /\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

describe('mensagens', () => {
  it('tem as mesmas chaves nos três idiomas', () => {
    const referencia = chavesDe(pt as Mensagens);
    for (const [idioma, mensagens] of Object.entries(IDIOMAS)) {
      expect(chavesDe(mensagens), `chaves de ${idioma}`).toEqual(referencia);
    }
  });

  it('não deixa nenhum texto vazio', () => {
    for (const [idioma, mensagens] of Object.entries(IDIOMAS)) {
      for (const [grupo, pares] of Object.entries(mensagens)) {
        for (const [chave, valor] of Object.entries(pares)) {
          expect(valor.trim(), `${idioma}:${grupo}.${chave}`).not.toBe('');
        }
      }
    }
  });

  it('manda para o navegador todo grupo que um componente de cliente usa', () => {
    // o provedor do layout só serializa GRUPOS_DO_CLIENTE; um grupo esquecido
    // ali só apareceria em execução, como erro no console do navegador
    const faltando: string[] = [];

    for (const arquivo of arquivosDaAplicacao()) {
      const codigo = readFileSync(arquivo, 'utf8');
      if (!codigo.includes("'use client'")) continue;

      for (const achado of codigo.matchAll(/useTranslations\('(\w+)'\)/g)) {
        const grupo = achado[1];
        if (grupo && !(GRUPOS_DO_CLIENTE as readonly string[]).includes(grupo)) {
          faltando.push(`${grupo} (${arquivo})`);
        }
      }
    }

    expect(faltando).toEqual([]);
  });

  it('só usa chaves que existem', () => {
    const ausentes: string[] = [];

    for (const arquivo of arquivosDaAplicacao()) {
      const codigo = readFileSync(arquivo, 'utf8');

      // `const t = await getTranslations('painel')` → t responde pelo grupo painel
      const grupoDoTradutor = new Map<string, string>();
      for (const achado of codigo.matchAll(
        /const\s+(\w+)\s*=\s*(?:await\s+)?(?:get|use)Translations\('(\w+)'\)/g,
      )) {
        const [, tradutor, grupo] = achado;
        if (tradutor && grupo) grupoDoTradutor.set(tradutor, grupo);
      }

      // só as chamadas com chave literal; as dinâmicas (t(texto.status)) ficam
      // de fora porque o valor só existe em execução
      for (const [tradutor, grupo] of grupoDoTradutor) {
        const chamadas = new RegExp(`\\b${tradutor}(?:\\.rich)?\\('([\\w.]+)'`, 'g');
        for (const achado of codigo.matchAll(chamadas)) {
          const chave = achado[1];
          if (!chave || !(pt as Mensagens)[grupo]?.[chave]) {
            ausentes.push(`${grupo}.${chave} (${arquivo})`);
          }
        }
      }
    }

    expect(ausentes).toEqual([]);
  });
});
