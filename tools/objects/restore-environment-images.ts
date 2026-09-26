/** Offline environment image restoration CLI; imports use the preparation core. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { restoreEnvironmentImages } from '@cssearth/bake/environment';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.slice(2).some(arg => arg !== '--verify-replay') || process.argv.length > 3)
    throw new TypeError('Usage: restore-environment-images [--verify-replay]');
  await restoreEnvironmentImages(resolve('src/objects'), process.argv.includes('--verify-replay'));
}
