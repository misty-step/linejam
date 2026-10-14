import catalog from '../../content/releases/catalog.json';
import { APP_VERSION } from '../appVersion';
import type { ReleaseCatalog } from './types';

export const releaseCatalog: ReleaseCatalog = {
  // SAFETY: generate:releases validates this projection; catalog.test.ts checks
  // freshness. Workers must not import the Ajv/filesystem source loader.
  ...(catalog as ReleaseCatalog),
  currentVersion: APP_VERSION,
};
