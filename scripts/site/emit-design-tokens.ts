import { cpSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderDesignTokensCss } from '@/lib/design/css';

const siteTokensPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../site/tokens.css'
);

writeFileSync(siteTokensPath, renderDesignTokensCss());

// The standalone site publishes its own root; public/fonts is the source.
cpSync(
  resolve(dirname(siteTokensPath), '../public/fonts'),
  resolve(dirname(siteTokensPath), 'fonts'),
  { recursive: true }
);
cpSync(
  resolve(dirname(siteTokensPath), '../public/linejam-mark.svg'),
  resolve(dirname(siteTokensPath), 'icon.svg')
);
