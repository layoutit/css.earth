/** Offline stars preparation CLI; implementation is shared with image restoration. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareStarsObject } from '../../src/preparation/stars/prepare.js';
export { prepareStarsObject };

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2] || process.argv[3]) throw new TypeError('Usage: prepare-stars <object-directory>');
  await prepareStarsObject({objectDirectory:process.argv[2]});
}
