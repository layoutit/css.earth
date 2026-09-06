import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { prepareSpatialContext } from './prepare-spatial-context.js';

const root = process.cwd();
const sourcePath = resolve(root, 'src/planets/sun/source/navigation/universe.json');
const solarGeometryPath = resolve(root, 'src/platform/solar-geometry.mjs');

test('migrated world-frame radii override astronomy only at the same position and epoch', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-spatial-context-'));
  try {
    const descriptor = JSON.parse(await readFile(resolve(root, 'src/planets/mercury/object.json'), 'utf8')) as Record<string, unknown>;
    const properties = descriptor.properties as Record<string, unknown>;
    const frame = properties.worldFrame as Record<string, unknown>;
    const customRadiusM = 2_439_701;
    const objectDirectory = resolve(directory, 'mercury');
    await mkdir(objectDirectory);
    await writeFile(resolve(objectDirectory, 'object.json'), JSON.stringify({ ...descriptor, properties: { ...properties,
      worldFrame: { ...frame, bodyRadiusM: customRadiusM } } }));
    const objectsDirectory = directory;
    await prepareSpatialContext({ sourcePath, solarGeometryPath, outputPath: resolve(directory, 'world-context.json'), objectsDirectory });
    const output = JSON.parse(await readFile(resolve(directory, 'world-context.json'), 'utf8')) as { bodies: readonly { id: string; radiusM: number }[] };
    assert.equal(output.bodies.find(body => body.id === 'mercury')?.radiusM, customRadiusM);

    await writeFile(resolve(objectDirectory, 'object.json'), JSON.stringify({ ...descriptor, properties: { ...properties,
      worldFrame: { ...frame, originM: [0, 0, 0] } } }));
    await assert.rejects(() => prepareSpatialContext({ sourcePath, solarGeometryPath,
      outputPath: resolve(directory, 'rejected.json'), objectsDirectory }), /incompatible/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
