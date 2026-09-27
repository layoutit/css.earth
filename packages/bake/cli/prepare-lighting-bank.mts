/** Bake the shared lighting banks into `public/lighting/<bank>/`, or check the tracked files against a fresh bake. The
 * bake and the check are `bakeLightingBank` and `checkLightingBank` in `@cssearth/bake/raster`.
 *
 *   node packages/bake/cli/prepare-lighting-bank.mts [--check] [<bank>...]
 *
 * Every bank by default. */
import '@cssearth/bake/thread-pool';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LIGHTING_BANKS, LIGHTING_BANK_ROOT, bakeLightingBank, checkLightingBank } from '@cssearth/bake/raster';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), check = args.includes('--check'), ids = args.filter(arg => arg !== '--check');
  const root = process.cwd();
  for (const id of ids.length ? ids : Object.keys(LIGHTING_BANKS)) {
    if (check) {
      const result = await checkLightingBank(id, root);
      console.log(`${id}: ${result.files} files${result.differing.length ? `, differing: ${result.differing.join(', ')}` : ', tracked bank matches a fresh bake'}`);
      if (result.differing.length) process.exitCode = 1;
    } else {
      const files = await bakeLightingBank(id, resolve(root, LIGHTING_BANK_ROOT, id));
      console.log(`${id}: ${files.length} files baked under ${LIGHTING_BANK_ROOT}/${id}`);
    }
  }
}
