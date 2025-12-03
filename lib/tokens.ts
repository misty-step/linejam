export const tokens = {
  colors: {
    background: '#faf9f7', // Rice paper
    foreground: '#1c1917', // Sumi ink
    primary: '#e85d2b', // Persimmon stamp
    textMuted: '#57534e', // Secondary text
  },
  fonts: {
    display: 'Libre Baskerville',
    sans: 'IBM Plex Sans',
  },
} as const;

export type Tokens = typeof tokens;
