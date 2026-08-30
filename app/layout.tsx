import { headers } from 'next/headers';
import type { Metadata, Viewport } from 'next';
import { resolveDeploymentId } from '@/lib/deploymentId';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { designTokens } from '@/lib/design';
import { COLOR_MODE_STORAGE_KEY } from '@/lib/colorMode/constants';
import { siteConfig } from '@/lib/config';

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  keywords: [
    'poetry',
    'game',
    'collaborative',
    'writing',
    'party game',
    'friends',
  ],
  authors: [{ name: siteConfig.title }],
  manifest: '/site.webmanifest',
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    siteName: siteConfig.title,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.title,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    {
      media: '(prefers-color-scheme: light)',
      color: designTokens.light['color-background'],
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: designTokens.dark['color-background'],
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // Blocking script: apply the effective mode and fixed identity before paint.
  const colorModeInitScript = `
    (function() {
      var MODE_KEY = ${JSON.stringify(COLOR_MODE_STORAGE_KEY)};
      var DESIGN_TOKENS = ${JSON.stringify(designTokens)};
      var storedMode = null;

      try {
        storedMode = localStorage.getItem(MODE_KEY);
      } catch (error) {
        console.warn('Could not read color mode preference:', error);
      }

      var mode = storedMode === 'light' || storedMode === 'dark'
        ? storedMode
        : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var root = document.documentElement;

      Object.entries(DESIGN_TOKENS[mode]).forEach(function(entry) {
        root.style.setProperty('--' + entry[0], entry[1]);
      });
      root.classList.remove('light', 'dark');
      root.classList.add(mode);
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: colorModeInitScript }}
        />
        <Providers
          deploymentId={resolveDeploymentId(process.env.NEXT_DEPLOYMENT_ID)}
        >
          <div className="min-h-screen flex flex-col bg-[var(--color-background)]">
            <Header />
            <main className="flex-1 flex flex-col">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
