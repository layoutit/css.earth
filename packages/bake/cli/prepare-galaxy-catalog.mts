// Entry script: `node packages/bake/cli/prepare-galaxy-catalog.mts <object-directory>`. Prepares a galaxy-catalogue object
// (the Local Group); the work is in @cssearth/bake/galaxy-catalog.
import { prepareGalaxyCatalogObject } from '@cssearth/bake/galaxy-catalog';

if (!process.argv[2] || process.argv[3]) throw new TypeError('Usage: prepare-galaxy-catalog <object-directory>');
await prepareGalaxyCatalogObject({ objectDirectory: process.argv[2] });
