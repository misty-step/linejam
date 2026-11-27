import type { ColorMode } from './types';
import { designTokens } from './tokens';

function declarations(mode: ColorMode, indent = '  '): string {
  return Object.entries(designTokens[mode])
    .map(([key, value]) => `${indent}--${key}: ${value};`)
    .join('\n');
}

/** Serialize the typed token tables into the static site's CSS custom properties. */
export function renderDesignTokensCss(): string {
  return `/* Generated from lib/design/tokens.ts. Do not edit. */

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
