/** Replay missing runtime images from pinned recipes; accepted descriptors stay immutable. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseImageLayerRecipe } from './image-layers/config.js';
import { prepareImageLayers } from './image-layers/prepare.js';
import { containedPath, sourceBytes } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { sha256 } from '@cssearth/core/node';
import { prepareSurfaceShellObject } from './shell/prepare.js';
import { prepareDensityVolumeObject } from './volume/prepare.js';
import { prepareStarsObject } from './stars/prepare.js';

interface Resource { path: string; sha256: string; bytes: number }
interface Descriptor {
  id: string; type: string;
  properties: { preparation: { source: string } };
  prepared: { url: string };
}
const raster = /\.(?:webp|png|jpe?g|avif)$/i;


const replayCoordinate = /^(?:banks\/\d+\/(?:normalUnits\/[0-2]|samplingStepUnits|leaves\/\d+\/(?:offsetKpc|centerUnits\/[0-2]|verticesUnits\/[0-3]\/[0-2]))|frame\/(?:originM\/[0-2]|localToReferenceXyzw\/[0-3]|boundsUnits\/(?:min|max)\/[0-2]))$/;

/** Allow binary64 coordinate roundoff while preserving every other replay field. */
export function assertImageLayerReplay(actual: unknown, expected: unknown): void {
  const compare = (a: unknown, b: unknown, path: string): void => {
    const message = `Image-layer replay changed accepted metadata at ${path || 'root'}.`;
    if (typeof a === 'number' && typeof b === 'number' && replayCoordinate.test(path)) {
      assert.ok(Number.isFinite(a) && Number.isFinite(b), message);
      assert.ok(Math.abs(a - b) <= 64 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)), message);
      return;
    }
    if (Array.isArray(a) || Array.isArray(b)) {
      assert.ok(Array.isArray(a) && Array.isArray(b), message);
      assert.equal(a.length, b.length, message);
      a.forEach((value, index) => compare(value, b[index], `${path}/${index}`));
      return;
    }
    if (a !== null && typeof a === 'object' && b !== null && typeof b === 'object') {
      const left = Object.entries(a), right = Object.entries(b);
      assert.deepEqual(left.map(([key]) => key).sort(), right.map(([key]) => key).sort(), message);
      const values = new Map(right);
      for (const [key, value] of left) compare(value, values.get(key), path ? `${path}/${key}` : key);
      return;
    }
    assert.deepEqual(a, b, message);
  };
  compare(actual, expected, '');
}

export async function restoreEnvironmentObject(objectDirectory: string, verifyReplay = false) {
  const descriptor: Descriptor = JSON.parse(await readFile(join(objectDirectory, 'object.json'), 'utf8'));
  // These resources have their own preparation steps later in the build.
  if (descriptor.type === 'volume-lens-bank' || descriptor.type === 'galaxy-point-field') return;
  const preparedBytes = await readFile(containedPath(objectDirectory, descriptor.prepared.url));
  const expected = JSON.parse(preparedBytes.toString());
  const data = expected.data ?? expected;
  const resources: Resource[] = (data.resources ?? []).filter((resource: Resource) => raster.test(resource.path));
  const preparedDirectory = dirname(containedPath(objectDirectory, descriptor.prepared.url));
  // A density volume's bake retires every slice texture no leaf draws (`prepareDensityVolumeObject`), so its prepared
  // resources are the complete published bank; the slice manifest's quads are bake inputs, not published files.
  if (!resources.length) return;
  let missing = false;
  for (const resource of resources) {
    try { await sourceBytes(preparedDirectory, resource); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; missing = true; }
  }
  if (!missing && !verifyReplay) {
    console.log(`ENVIRONMENT_CACHED ${descriptor.id}: ${resources.length} verified images`);
    return;
  }
  const temporary = await mkdtemp(join(tmpdir(), 'cssearth-environment-'));
  try {
    console.log(`ENVIRONMENT_BAKE ${descriptor.id}: ${resources.length} images`);
    switch (descriptor.type) {
      case 'image-layer-bank': {
        const ref = descriptor.properties.preparation;
        const recipe = parseImageLayerRecipe(JSON.parse((await readFile(containedPath(objectDirectory, ref.source))).toString()));
        const baked = await prepareImageLayers({ sourceDirectory: dirname(containedPath(objectDirectory, ref.source)), outputDirectory: temporary, recipe });
        assertImageLayerReplay(JSON.parse(JSON.stringify(baked)), data);
        break;
      }
      case 'density-volume': await prepareDensityVolumeObject({ objectDirectory, outputDirectory: temporary }); break;
      case 'surface-shell': await prepareSurfaceShellObject({ objectDirectory, outputDirectory: temporary }); break;
      case 'point-field': await prepareStarsObject({ objectDirectory, outputDirectory: temporary }); break;
      default: throw new Error(`No image replay for object type ${descriptor.type}; keep its images until a recipe exists.`);
    }
    // Verify the entire accepted bank before copying anything. Never replace scientific metadata.
    for (const resource of resources) {
      const bytes = await sourceBytes(temporary, resource);
      assert.equal(bytes.length, resource.bytes, `Image byte length changed: ${resource.path}`);
    }
    for (const resource of resources) {
      const destination = containedPath(preparedDirectory, resource.path);
      await mkdir(dirname(destination), { recursive: true });
      const pending = `${destination}.${process.pid}.tmp`;
      await writeFile(pending, await sourceBytes(temporary, resource));
      await rename(pending, destination);
    }
    console.log(`ENVIRONMENT_READY ${descriptor.id}: ${resources.length} byte-identical images`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export async function restoreEnvironmentImages(root: string, verifyReplay = false) {
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const directory = join(root, entry.name);
    try { await readFile(join(directory, 'object.json')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    await restoreEnvironmentObject(directory, verifyReplay);
  }
}
