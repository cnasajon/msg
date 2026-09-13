/**
 * Sobe a versão publicada e carimba a data de hoje.
 *
 *   node scripts/versao.mjs          → 1.0 vira 1.1 (alteração menor)
 *   node scripts/versao.mjs --maior  → 1.7 vira 2.0 (alteração maior)
 *
 * Roda antes de cada commit. A alteração maior é decisão do dono do produto, e
 * por isso exige a opção explícita em vez de acontecer por contagem.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ARQUIVO = 'src/lib/versao.ts';
const maior = process.argv.includes('--maior');

const conteudo = readFileSync(ARQUIVO, 'utf8');
const atual = conteudo.match(/export const VERSAO = '([\d.]+)'/)?.[1];
if (!atual) throw new Error(`Não achei a versão em ${ARQUIVO}.`);

const [antes, depois] = atual.split('.').map(Number);
const nova = maior ? `${antes + 1}.0` : `${antes}.${depois + 1}`;
// data local, não UTC: "hoje" é o dia de quem publica
const hoje = new Date();
const data = [
  hoje.getFullYear(),
  String(hoje.getMonth() + 1).padStart(2, '0'),
  String(hoje.getDate()).padStart(2, '0'),
].join('-');

writeFileSync(
  ARQUIVO,
  conteudo
    .replace(/export const VERSAO = '[\d.]+'/, `export const VERSAO = '${nova}'`)
    .replace(/export const PUBLICADA_EM = '[\d-]+'/, `export const PUBLICADA_EM = '${data}'`),
);

console.log(`versão ${atual} → ${nova}, publicada em ${data}`);
