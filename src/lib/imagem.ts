import { problema, type Problema } from './avisos';
import sharp from 'sharp';
import { env } from './env';

/**
 * Processamento das imagens antes de irem para o banco.
 *
 * O que entra é o arquivo do navegador; o que sai é algo que cabe numa
 * mensagem do Telegram e num `bytea` sem susto: no máximo 1600 px no lado
 * maior, recomprimido, sem EXIF.
 */

const FORMATOS_ACEITOS = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
const LADO_MAXIMO = 1600;

export type ImagemProcessada = {
  dados: Uint8Array<ArrayBuffer>;
  mime: string;
  bytes: number;
  largura: number;
  altura: number;
};

/** Carrega a chave da mensagem; a tradução acontece na ação que chamou. */
export class ImagemInvalida extends Error {
  constructor(readonly problema: Problema) {
    super(problema.chave);
  }
}

export async function processarImagem(arquivo: File): Promise<ImagemProcessada> {
  const limiteBytes = env.maxImageMb * 1024 * 1024;

  // corta cedo o que é grande demais até para processar
  if (arquivo.size > limiteBytes * 8) {
    throw new ImagemInvalida(
      problema('arquivoGrandeDemais', { mb: (arquivo.size / 1024 / 1024).toFixed(1) }),
    );
  }

  const original = Buffer.from(await arquivo.arrayBuffer());

  // O formato vem do conteúdo do arquivo, não da extensão nem do MIME que o
  // navegador declarou — é o que a seção 11 pede.
  let metadados;
  try {
    metadados = await sharp(original).metadata();
  } catch {
    throw new ImagemInvalida(problema('naoEhImagem'));
  }

  const formato = metadados.format as keyof typeof FORMATOS_ACEITOS | undefined;
  if (!formato || !(formato in FORMATOS_ACEITOS)) {
    throw new ImagemInvalida(
      problema('formatoNaoAceito', { formato: metadados.format ?? '' }),
    );
  }

  const precisaReduzir = (metadados.width ?? 0) > LADO_MAXIMO || (metadados.height ?? 0) > LADO_MAXIMO;
  let processador = sharp(original, { failOn: 'error' }).rotate(); // `rotate` sem argumento aplica a orientação do EXIF e depois o descarta
  if (precisaReduzir) {
    processador = processador.resize(LADO_MAXIMO, LADO_MAXIMO, { fit: 'inside', withoutEnlargement: true });
  }

  let saida: Buffer;
  let mime: string;
  if (formato === 'png') {
    saida = await processador.png({ compressionLevel: 9, palette: true }).toBuffer();
    mime = FORMATOS_ACEITOS.png;
  } else if (formato === 'webp') {
    saida = await processador.webp({ quality: 82 }).toBuffer();
    mime = FORMATOS_ACEITOS.webp;
  } else {
    saida = await processador.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    mime = FORMATOS_ACEITOS.jpeg;
  }

  // PNG grande e fotográfico às vezes não cabe no limite; JPEG resolve
  if (saida.length > limiteBytes && formato === 'png') {
    saida = await processador.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    mime = FORMATOS_ACEITOS.jpeg;
  }
  if (saida.length > limiteBytes) {
    throw new ImagemInvalida(
      problema('aindaGrandeDepois', {
        mb: (saida.length / 1024 / 1024).toFixed(1),
        limite: env.maxImageMb,
      }),
    );
  }

  const finais = await sharp(saida).metadata();
  const dados = new Uint8Array(new ArrayBuffer(saida.length));
  dados.set(saida);

  return {
    dados,
    mime,
    bytes: saida.length,
    largura: finais.width ?? 0,
    altura: finais.height ?? 0,
  };
}
