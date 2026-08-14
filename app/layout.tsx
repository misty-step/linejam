import { headers } from 'next/headers';
import type { Metadata, Viewport } from 'next';
import { resolveDeploymentId } from '@/lib/deploymentId';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { themeIds, defaultThemeId } from '@/lib/themes';
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
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1917' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // Blocking script: apply theme before first paint to prevent FOUC
  // Theme IDs injected from registry to avoid duplication
  const themeInitScript = `
    (function() {
      try {
        var THEME_KEY = 'linejam-theme-id';
        var MODE_KEY = 'linejam-theme-mode';
        var VALID_THEMES = ${JSON.stringify(themeIds)};
        var DEFAULT_THEME = ${JSON.stringify(defaultThemeId)};

        var storedTheme = localStorage.getItem(THEME_KEY);
        var storedMode = localStorage.getItem(MODE_KEY);

        var themeId = VALID_THEMES.indexOf(storedTheme) >= 0 ? storedTheme : DEFAULT_THEME;

        var mode;
        if (storedMode === 'light' || storedMode === 'dark') {
          mode = storedMode;
        } else {
          mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        document.documentElement.setAttribute('data-theme', themeId);
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(mode);
      } catch (e) {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
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
