import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { GRUPOS_DO_CLIENTE } from '@/i18n/idiomas';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const comum = await getTranslations('comum');
  return { title: comum('app'), description: comum('descricaoDoApp') };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // O idioma vem de quem está olhando — preferência do usuário, senão padrão da
  // organização —, não do endereço. Ver src/i18n/request.ts.
  const idioma = await getLocale();

  // Só os grupos que os componentes de cliente usam: o provedor serializa na
  // página tudo que recebe. Ver GRUPOS_DO_CLIENTE.
  const todas = await getMessages();
  const doCliente = Object.fromEntries(
    GRUPOS_DO_CLIENTE.filter((grupo) => grupo in todas).map((grupo) => [grupo, todas[grupo]]),
  );

  return (
    <html lang={idioma} data-theme="dark">
      <body>
        <NextIntlClientProvider messages={doCliente}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
