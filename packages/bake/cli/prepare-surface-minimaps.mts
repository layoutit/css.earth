import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
// Entry script: node packages/bake/cli/prepare-surface-minimaps.mts [<object-id>...]. Writes the sidebar minimaps of the registered
// objects of the checkout it runs in; the work is `prepareSurfaceMinimaps` in @cssearth/bake/surface-previews, with the generated
// solar geometry this entry loads from the checkout.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareSurfaceMinimaps } from '@cssearth/bake/surface-previews';
import type { SolarGeometry } from '@cssearth/bake/objects/scene';
import { readPreparedObjects } from '@cssearth/objects/node';

const projectRoot = checkoutProjectRoot(import.meta.url);
const SCENE_OBJECTS = readPreparedObjects(projectRoot).sceneObjects;
const solarGeometry: SolarGeometry = await import(pathToFileURL(resolve(projectRoot, 'src/platform/solar-geometry.mts')).href);
const requested = process.argv.slice(2);
for (const { id } of SCENE_OBJECTS) {
  if (requested.length && !requested.includes(id)) continue;
  const objectDirectory = resolve(projectRoot, 'src/objects', id);
  const images = await prepareSurfaceMinimaps({ objectDirectory, solarGeometry,
    publicDirectory: resolve(projectRoot, 'site/public/scenes', id), outputDirectory: resolve(objectDirectory, 'prepared') });
  console.log(`${id}: ${images.length} prepared minimaps`);
}
