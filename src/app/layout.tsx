import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { normalizePlausibleScriptSrc } from '@/lib/analytics/plausible';
import { SITE_CONFIG } from '@/lib/config';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    template: `%s · ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  openGraph: {
    type: 'website',
    siteName: SITE_CONFIG.name,
    title: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    description: SITE_CONFIG.description,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#1f7a4d',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const plausibleScriptSrc = normalizePlausibleScriptSrc(
    process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC,
  );

  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable}`}>
      {plausibleScriptSrc && (
        <head>
          <script async src={plausibleScriptSrc} />
          <script
            dangerouslySetInnerHTML={{
              __html:
                'window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()',
            }}
          />
        </head>
      )}
      <body className="flex min-h-screen flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
