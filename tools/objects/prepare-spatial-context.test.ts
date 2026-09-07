import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ASTEROID_IDS, asteroidPositionKm, BODIES, DWARF_PLANET_IDS, dwarfPlanetPositionKm, moonPositionRelativeToPlanetKm,
  systemBarycentreHeliocentricAu, M_PER_AU } from '@cssearth/astronomy';
import type { AsteroidId, BodyId, DwarfPlanetId, Vsop87BodyKey } from '@cssearth/astronomy';
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
    const outputPath = resolve(directory, 'world-context.json');
    await utimes(outputPath, 1, 1);
    await prepareSpatialContext({ sourcePath, solarGeometryPath, outputPath, objectsDirectory });
    assert.equal((await stat(outputPath)).mtimeMs, 1000, 'unchanged context must not trigger hot reload');

    await writeFile(resolve(objectDirectory, 'object.json'), JSON.stringify({ ...descriptor, properties: { ...properties,
      worldFrame: { ...frame, originM: [0, 0, 0] } } }));
    await assert.rejects(() => prepareSpatialContext({ sourcePath, solarGeometryPath,
      outputPath: resolve(directory, 'rejected.json'), objectsDirectory }), /incompatible/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('authored context inventory extends beyond package and navigation registries', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-extra-context-'));
  try {
    const source = JSON.parse(await readFile(sourcePath, 'utf8'));
    source.bodies = [{ id: 'new-object', name: 'New object', color: '#aabbcc' }];
    const authored = resolve(directory, 'source.json');
    await writeFile(authored, JSON.stringify(source));
    const descriptor = JSON.parse(await readFile(resolve(root, 'src/planets/mercury/object.json'), 'utf8'));
    descriptor.id = 'new-object'; descriptor.properties.worldFrame.bodyRadiusM = 1234567;
    await mkdir(resolve(directory, 'new-object'));
    await writeFile(resolve(directory, 'new-object/object.json'), JSON.stringify(descriptor));
    const fixtureGeometryPath = resolve(directory, 'geometry.mjs');
    await writeFile(fixtureGeometryPath, `import * as original from ${JSON.stringify(pathToFileURL(solarGeometryPath).href)};
export const SOLAR_GEOMETRY_EPOCH_JD_TT=original.SOLAR_GEOMETRY_EPOCH_JD_TT;
export const ASTRONOMICAL_UNIT_KILOMETERS=original.ASTRONOMICAL_UNIT_KILOMETERS;
${['BODY_FIXED_SUN_DIRECTIONS','BODY_FIXED_ORBIT_NORMAL_DIRECTIONS','BODY_FIXED_TO_ICRF_MATRICES','BODY_ORBITS'].map(key => `export const ${key}={...original.${key},'new-object':original.${key}.mercury};`).join('\n')}`);
    const outputPath = resolve(directory, 'context.json');
    await prepareSpatialContext({ sourcePath: authored, solarGeometryPath: fixtureGeometryPath, outputPath, objectsDirectory: directory });
    const output = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.deepEqual(output.bodies.map((body: { id: string }) => body.id), ['new-object']);
    assert.equal(output.bodies[0].radiusM, 1234567);
    assert.equal(output.bodies[0].orbit.centerBodyId, source.focus.id);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('all authored bodies retain parent-relative ephemeris orbits in one physical context', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-parent-context-'));
  try {
    const outputPath = resolve(directory, 'context.json');
    await prepareSpatialContext({ sourcePath, solarGeometryPath, outputPath });
    const result = JSON.parse(await readFile(outputPath, 'utf8'));
    const source = JSON.parse(await readFile(sourcePath, 'utf8'));
    assert.deepEqual(result.bodies.map((body: { id: string }) => body.id), source.bodies.map((body: { id: string }) => body.id));
    // Independently call the astronomy models, bypassing solar-geometry.mjs and
    // descriptor frames. The epoch adapter currently places Earth at the EMB.
    const modelPositionM = (id: BodyId): readonly number[] => {
      const parent = BODIES[id].parent;
      if (parent === null) return [0, 0, 0];
      if (ASTEROID_IDS.includes(id as AsteroidId)) return asteroidPositionKm(id as AsteroidId, source.frame.epochJdTt).map(value => value * 1000);
      if (DWARF_PLANET_IDS.includes(id as DwarfPlanetId)) return dwarfPlanetPositionKm(id as DwarfPlanetId, source.frame.epochJdTt).map(value => value * 1000);
      if (parent !== 'sun') {
        const parentPosition = modelPositionM(parent);
        return moonPositionRelativeToPlanetKm(id, source.frame.epochJdTt).map((value, axis) => parentPosition[axis]! + value * 1000);
      }
      return systemBarycentreHeliocentricAu((id === 'earth' ? 'emb' : id) as Vsop87BodyKey, source.frame.epochJdTt).map(value => value * M_PER_AU);
    };
    for (const body of result.bodies) {
      const id = body.id as BodyId, parent = BODIES[id].parent!;
      assert.equal(body.orbit.centerBodyId, parent);
      // At outer-dwarf coordinates one floating-point step already exceeds a
      // millimetre. Bound the independent conversion by four relative epsilons.
      const agrees = (expected: readonly number[], actual: readonly number[]) =>
        Math.hypot(...expected.map((value, axis) => value - actual[axis]!)) <=
          Math.max(.001, Math.hypot(...expected) * Number.EPSILON * 4);
      assert(agrees(modelPositionM(id), body.positionM), `${id} differs from its independent ephemeris`);
      assert(agrees(modelPositionM(parent), body.orbit.centerPositionM), `${id} orbit differs from its parent's independent ephemeris`);
    }
    for (const [id, parentId] of [['moon', 'earth'], ['io', 'jupiter'], ['europa', 'jupiter'], ['ganymede', 'jupiter'], ['callisto', 'jupiter']]) {
      const child = result.bodies.find((body: { id: string }) => body.id === id);
      const parent = result.bodies.find((body: { id: string }) => body.id === parentId);
      assert.equal(child.orbit.centerBodyId, parentId);
      assert.deepEqual(child.orbit.centerPositionM, parent.positionM);
      assert.deepEqual(child.orbit.verticesM[0], child.positionM);
      const initialDistance = Math.hypot(...child.positionM.map((value: number, axis: number) => value - parent.positionM[axis]));
      for (const vertex of child.orbit.verticesM) {
        const distance = Math.hypot(...vertex.map((value: number, axis: number) => value - parent.positionM[axis]));
        assert(distance < initialDistance * 1.2 && distance > initialDistance * .8, `${id} ellipse left its parent centre`);
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
