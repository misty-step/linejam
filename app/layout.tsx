import type { Metadata, Viewport } from 'next';
import {
  Libre_Baskerville,
  IBM_Plex_Sans,
  Noto_Serif,
  Inter,
  Cormorant_Garamond,
  Source_Serif_4,
  JetBrains_Mono,
  Righteous,
  Outfit,
  Space_Mono,
} from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { themeIds, defaultThemeId } from '@/lib/themes';
import { siteConfig } from '@/lib/config';

// Kenya theme fonts
const libreBaskerville = Libre_Baskerville({
  variable: '--font-libre-baskerville',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

const ibmPlex = IBM_Plex_Sans({
  variable: '--font-ibm-plex',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

// Mono theme fonts
const notoSerif = Noto_Serif({
  variable: '--font-noto-serif',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

// Vintage Paper theme fonts
const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
});

// Hyper theme fonts
const righteous = Righteous({
  variable: '--font-righteous',
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
});

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

const spaceMono = Space_Mono({
  variable: '--font-space-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

// Shared mono font (legacy/fallback)
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
});

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1917' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    <html
      lang="en"
      className={`${libreBaskerville.variable} ${ibmPlex.variable} ${notoSerif.variable} ${inter.variable} ${cormorant.variable} ${sourceSerif.variable} ${righteous.variable} ${outfit.variable} ${spaceMono.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>
          <div className="min-h-screen flex flex-col bg-[var(--color-background)]">
            <Header />
            <main className="flex-1 flex flex-col">{children}</main>
            <Footer />
          </div>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
