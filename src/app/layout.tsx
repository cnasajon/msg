import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'msg',
  description: 'Publicação programada de textos e imagens em grupos de Telegram.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
