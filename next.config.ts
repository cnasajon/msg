import type { NextConfig } from 'next';
import criarPluginDeIdioma from 'next-intl/plugin';

// sem rota por idioma: o idioma vem da sessão, não do endereço
const comIdioma = criarPluginDeIdioma('./src/i18n/request.ts');

const config: NextConfig = {
  // O worker roda fora do Next; aqui só a interface e a API.
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // as imagens são lidas do Postgres e servidas por rota própria,
    // podem chegar a 2 MB por upload
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default comIdioma(config);
