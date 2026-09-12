import type { NextConfig } from 'next';

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

export default config;
