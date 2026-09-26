// Entry script: node tools/prepare/cli/prepare-surface-minimaps.mts [<object-id>...]. The work is in ../prepare-surface-minimaps.mts.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_OBJECTS } from '../../../site/objects.mts';
import { prepareSurfaceMinimaps } from '../prepare-surface-minimaps.mts';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const requested = process.argv.slice(2);
for (const { id } of SCENE_OBJECTS) {
  if (requested.length && !requested.includes(id)) continue;
  const objectDirectory = resolve(projectRoot, 'src/objects', id);
  const images = await prepareSurfaceMinimaps({ objectDirectory,
    publicDirectory: resolve(projectRoot, 'public/scenes', id), outputDirectory: resolve(objectDirectory, 'prepared') });
  console.log(`${id}: ${images.length} prepared minimaps`);
}
