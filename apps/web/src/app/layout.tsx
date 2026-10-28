import { LOCALE_TAGS } from '@math-adventure/shared';
import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Myanmar, Noto_Sans_Thai } from 'next/font/google';
import { I18nProvider } from '@/components/i18n';
import { getLocale, getT } from '@/lib/i18n';
import './globals.css';

// Loaded only for Burmese and Thai characters (each face is limited to its script's unicode-range).
const myanmar = Noto_Sans_Myanmar({ subsets: ['myanmar'], weight: ['400', '600', '700', '800'], variable: '--font-myanmar', display: 'swap', preload: false });
const thai = Noto_Sans_Thai({ subsets: ['thai'], variable: '--font-thai', display: 'swap', preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: { default: t('app.name'), template: `%s | ${t('app.name')}` },
    description: t('app.description'),
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { themeColor: '#0e9f94', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getT();
  return (
    <html lang={LOCALE_TAGS[locale]} className={`${myanmar.variable} ${thai.variable}`}>
      <body className="bg-chalk text-ink antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-paper focus:px-4 focus:py-2 focus:shadow">
          {t('common.skipToContent')}
        </a>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
