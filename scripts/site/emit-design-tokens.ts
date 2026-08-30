import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderDesignTokensCss } from '@/lib/design/css';

const siteTokensPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../site/tokens.css'
);

writeFileSync(siteTokensPath, renderDesignTokensCss());
