import type { ColorMode } from './types';
import { designTokens } from './tokens';

const FONT_STACKS = {
  '--font-libre-baskerville': "'Libre Baskerville', Georgia, serif",
  '--font-ibm-plex': "'IBM Plex Sans', Arial, sans-serif",
  '--font-jetbrains-mono': "'JetBrains Mono', monospace",
} as const;

function declarations(mode: ColorMode, indent = '  '): string {
  return Object.entries(designTokens[mode])
    .map(([key, value]) => `${indent}--${key}: ${value};`)
    .join('\n');
}

function fontDeclarations(): string {
  return Object.entries(FONT_STACKS)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
}

/** Serialize the typed token tables into the static site's CSS custom properties. */
export function renderDesignTokensCss(): string {
  return `/* Generated from lib/design/tokens.ts. Do not edit. */

:root {
${fontDeclarations()}
}

:root,
:root.light {
  color-scheme: light;
${declarations('light')}
}

:root.dark {
  color-scheme: dark;
${declarations('dark')}
}

@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    color-scheme: dark;
${declarations('dark', '    ')}
  }
}
`;
}
