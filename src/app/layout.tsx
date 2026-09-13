import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'msg',
  description: 'Publicação programada de textos e imagens em grupos de Telegram.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // O idioma vem de quem está olhando — preferência do usuário, senão padrão da
  // organização —, não do endereço. Ver src/i18n/request.ts.
  const idioma = await getLocale();

  return (
    <html lang={idioma} data-theme="dark">
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
