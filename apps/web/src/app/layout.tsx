import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Math Adventure', template: '%s | Math Adventure' },
  description: 'Game-based maths practice for children aged 5 to 12, with progress parents can see.',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: '#0e9f94', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-chalk text-ink antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-paper focus:px-4 focus:py-2 focus:shadow">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
