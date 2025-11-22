import type { Metadata, Viewport } from 'next';
import { Libre_Baskerville, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const libreBaskerville = Libre_Baskerville({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

const ibmPlex = IBM_Plex_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Linejam',
  description: 'Collaborative poetry for friends in the same room',
  keywords: ['poetry', 'game', 'collaborative', 'writing', 'friends'],
  authors: [{ name: 'Linejam' }],
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
  return (
    <html lang="en">
      <body
        className={`${libreBaskerville.variable} ${ibmPlex.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
