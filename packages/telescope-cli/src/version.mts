import { createRequire } from 'node:module';

const metadata: unknown = createRequire(import.meta.url)('@cssearth/telescope/package.json');
if (!metadata || typeof metadata !== 'object' || !('version' in metadata) || typeof metadata.version !== 'string') {
  throw new TypeError('The telescope package has no version.');
}
export const VERSION = metadata.version;
