import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Instrument_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const cormorant = Cormorant_Garamond({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const instrument = Instrument_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
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
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1f' },
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
        className={`${cormorant.variable} ${instrument.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
