import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { SCENE_SATELLITE_IDS, SMALL_BODY_IDS, asteroidPositionKm, COMET_IDS, cometPositionKm, BODIES, DWARF_PLANET_IDS, dwarfPlanetPositionKm, moonPositionRelativeToPlanetKm,
  systemBarycentreHeliocentricAu, M_PER_AU, STAR_IDS, starStateKm, HOSTED_PLANET_IDS, hostedPlanetStateRelativeKm } from '@cssearth/astronomy';
import type { SmallBodyId, CometId, BodyId, DwarfPlanetId, Vsop87BodyKey, StarId, HostedPlanetId } from '@cssearth/astronomy';
import { readCatalog } from '../prepare-catalog.mts';
import { parseSpatialContextCommand, prepareSpatialContext } from './prepare-spatial-context.js';

const root = process.cwd();
const sourcePath = resolve(root, 'src/objects/sun/source/navigation/universe.json');
const solarGeometryPath = resolve(root, 'src/platform/solar-geometry.mts');
const contextEntries = (await readCatalog()).filter(body => body.context && body.id !== 'sun')
  .sort((a, b) => (a.context!.order ?? Number.MAX_SAFE_INTEGER) - (b.context!.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id, 'en'));

test('the command takes its paths and refuses unknown options', () => {
  const generated = parseSpatialContextCommand(['source.json', 'prepared.json'], '/repo');
  assert.equal(generated.sourcePath, '/repo/source.json');
  assert.equal(generated.outputPath, '/repo/prepared.json');
  assert.equal(generated.solarGeometryPath, '/repo/src/platform/solar-geometry.mts');

  assert.throws(() => parseSpatialContextCommand(['source.json', 'prepared.json', '--unknown'], '/repo'), /Usage:/);
});


test('migrated world-frame radii override astronomy only at the same position and epoch', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-spatial-context-'));
  try {
    const descriptor = JSON.parse(await readFile(resolve(root, 'src/objects/mercury/object.json'), 'utf8')) as Record<string, unknown>;
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

test('frame comparison allows distant roundoff but rejects shifted positions, epochs and references', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-frame-roundoff-'));
  try {
    for (const id of ['pluto', 'mercury']) {
      const source = JSON.parse(await readFile(sourcePath, 'utf8'));
      source.bodies = [{ id, name: id, color: '#aaaaaa' }];
      const authored = resolve(directory, 'source.json');
      await writeFile(authored, JSON.stringify(source));
      const descriptor = JSON.parse(await readFile(resolve(root, `src/objects/${id}/object.json`), 'utf8'));
      const frame = descriptor.properties.worldFrame;
      const objectDirectory = resolve(directory, id);
      await mkdir(objectDirectory);
      const shifted = (metres: number) => frame.originM.map((value: number, axis: number) => value + (axis === 0 ? metres : 0));
      const writeFrame = async (value: unknown) => writeFile(resolve(objectDirectory, 'object.json'), JSON.stringify({
        ...descriptor, properties: { ...descriptor.properties, worldFrame: value },
      }));
      const outputPath = resolve(directory, `${id}.json`);
      const prepare = () => prepareSpatialContext({ sourcePath: authored, solarGeometryPath, outputPath, objectsDirectory: directory });

      // Two millimetres exceed the inner-planet floor, but are a few binary64
      // coordinate steps at Pluto. This offset is independent of the allowance.
      await writeFrame({ ...frame, originM: shifted(.001953125), bodyRadiusM: 1234567 });
      if (id === 'pluto') {
        await prepare();
        const output = JSON.parse(await readFile(outputPath, 'utf8'));
        assert.equal(output.bodies[0].radiusM, 1234567);
      } else await assert.rejects(prepare, /incompatible/);

      for (const invalid of [
        { ...frame, originM: shifted(.02) },
        { ...frame, epochJdTt: frame.epochJdTt + 1 },
        { ...frame, referenceFrame: 'sun-ecliptic' },
      ]) {
        await writeFrame(invalid);
        await assert.rejects(prepare, /frame.*incompatible|worldFrame/);
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('authored context inventory extends beyond package and navigation registries', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-extra-context-'));
  try {
    const source = JSON.parse(await readFile(sourcePath, 'utf8'));
    source.bodies = [{ id: 'new-object', name: 'New object', color: '#aabbcc' }];
    const authored = resolve(directory, 'source.json');
    await writeFile(authored, JSON.stringify(source));
    const descriptor = JSON.parse(await readFile(resolve(root, 'src/objects/mercury/object.json'), 'utf8'));
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
    assert.deepEqual(result.bodies.map((body: { id: string }) => body.id), contextEntries.map(body => body.id));
    assert.deepEqual(result.bodies.filter((body: { placement?: string }) => body.placement === 'approximate')
      .map((body: { id: string }) => body.id).sort(), ['dactyl', 'selam'], 'Catalogue preparation must preserve the source records’ phase qualification.');
    // Independently parse the retained Horizons output, bypassing the snapshot
    // loader, solar-geometry.mts and descriptor frames. Retained Sun-centered
    // records own the primary positions; other bodies retain their compact models.
    const manifestPath = resolve(root, 'packages/astronomy/source/scene-epoch');
    const manifest = JSON.parse(await readFile(resolve(manifestPath, 'manifest.json'), 'utf8'));
    assert.equal(manifest.epochJdTt, source.frame.epochJdTt);
    const sourcePositions = new Map<string, number[]>();
    const sourcePrimaries = new Map<string, number[]>();
    for (const record of manifest.records) {
      const response = await readFile(resolve(manifestPath, record.path), 'utf8');
      const row = response.split('$$SOE')[1]!.split('$$EOE')[0]!.trim().split(',');
      const positionKm = row.slice(2, 5).map(Number);
      sourcePositions.set(record.id, positionKm);
      if (record.centerBodyId === 'sun') sourcePrimaries.set(record.id, positionKm);
    }
    for (const id of SCENE_SATELLITE_IDS) {
      const record = JSON.parse(await readFile(resolve(root, `src/objects/${id}/source/validation/epoch-state.json`), 'utf8'));
      sourcePositions.set(id, record.positionKm);
      if (record.parentHeliocentricState) sourcePrimaries.set(record.centerBodyId, record.parentHeliocentricState.positionKm);
    }
    const modelPositionM = (id: BodyId): readonly number[] => {
      const parent = BODIES[id].parent;
      // A placed star sits at its catalogue astrometry; a planet of another star on its hosted orbit around it.
      if ((STAR_IDS as readonly string[]).includes(id)) return starStateKm(id as StarId, source.frame.epochJdTt).positionKm.map(value => value * 1000);
      if ((HOSTED_PLANET_IDS as readonly string[]).includes(id)) {
        const host = modelPositionM(parent!), relative = hostedPlanetStateRelativeKm(id as HostedPlanetId, source.frame.epochJdTt).positionKm;
        return host.map((value, axis) => value + relative[axis]! * 1000);
      }
      if (parent === null) return [0, 0, 0];
      if (sourcePrimaries.has(id)) return sourcePrimaries.get(id)!.map(value => value * 1000);
      if (COMET_IDS.includes(id as CometId)) return cometPositionKm(id as CometId, source.frame.epochJdTt).map(value => value * 1000);
      if (SMALL_BODY_IDS.includes(id as SmallBodyId)) return asteroidPositionKm(id as SmallBodyId, source.frame.epochJdTt).map(value => value * 1000);
      if (DWARF_PLANET_IDS.includes(id as DwarfPlanetId)) return dwarfPlanetPositionKm(id as DwarfPlanetId, source.frame.epochJdTt).map(value => value * 1000);
      if (parent !== 'sun') {
        const parentPosition = modelPositionM(parent);
        return (sourcePositions.get(id) ?? moonPositionRelativeToPlanetKm(id, source.frame.epochJdTt)).map((value, axis) => parentPosition[axis]! + value * 1000);
      }
      return systemBarycentreHeliocentricAu((id === 'earth' ? 'emb' : id) as Vsop87BodyKey, source.frame.epochJdTt)
        .map((value, axis) => value * M_PER_AU + (id === 'earth' ? sourcePositions.get('earth')![axis]! * 1000 : 0));
    };
    for (const body of result.bodies) {
      const id = body.id as BodyId, parent = BODIES[id].parent!;
      if (body.orbit === undefined) {
        // Placed stars are positioned without a drawn trajectory; their planets orbit them below.
        assert.ok((STAR_IDS as readonly string[]).includes(id), `${id} has no orbit`);
        assert(Math.hypot(...modelPositionM(id).map((value, axis) => value - body.positionM[axis]!)) <= Math.max(.001, Math.hypot(...body.positionM) * Number.EPSILON * 8), `${id} differs from its independent placement`);
        continue;
      }
      assert.equal(body.orbit.centerBodyId, parent);
      // At outer-dwarf coordinates one floating-point step already exceeds a
      // millimetre. Bound the independent conversion by four relative epsilons.
      const agrees = (expected: readonly number[], actual: readonly number[]) =>
        Math.hypot(...expected.map((value, axis) => value - actual[axis]!)) <=
          Math.max(.001, Math.hypot(...expected) * Number.EPSILON * 4);
      assert(agrees(modelPositionM(id), body.positionM), `${id} differs from its independent ephemeris`);
      assert(agrees(modelPositionM(parent), body.orbit.centerPositionM), `${id} orbit differs from its parent's independent ephemeris`);
    }
    // A placed star with an orbiting planet roots its own planetary system.
    for (const id of HOSTED_PLANET_IDS) {
      const host = result.bodies.find((body: { id: string }) => body.id === BODIES[id].parent);
      assert.ok(host.systemView?.memberIds.includes(id), `${host.id} frames its planet ${id}`);
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
    const authoredIds = new Set(contextEntries.map(body => body.id));
    for (const [id, positionKm] of sourcePrimaries) {
      if (authoredIds.has(id)) {
        assert.equal(result.orbitCenters?.[id], undefined, 'an authored primary owns its body frame, without a duplicate coordinate-only entry');
      } else {
        assert.equal(result.bodies.some((body: { id: string }) => body.id === id), false, 'a primary coordinate must not add an unauthored scene or marker');
        assert.deepEqual(result.orbitCenters[id], { centerBodyId: 'sun', positionM: positionKm.map(value => value * 1000) });
      }
    }
    const patroclus = result.bodies.find((body: { id: string }) => body.id === 'patroclus');
    assert.ok(patroclus, 'an explicitly authored primary remains a visible body');
    const menoetius = result.bodies.find((body: { id: string }) => body.id === 'menoetius');
    assert.ok(menoetius, 'the authored satellite remains a visible body');
    assert.equal(menoetius.orbit.centerBodyId, patroclus.id);
    assert.deepEqual(menoetius.orbit.centerPositionM, patroclus.positionM);
    assert.equal(result.orbitCenters?.patroclus, undefined, 'a visible primary does not need a hidden coordinate entry');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a non-visible primary must come from matching canonical geometry, without tolerance relaxation', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-hidden-primary-'));
  try {
    const source = JSON.parse(await readFile(sourcePath, 'utf8'));
    source.bodies = [{ id: 'menoetius', name: 'Menoetius', color: '#aaaaaa' }];
    const authored = resolve(directory, 'source.json');
    await writeFile(authored, JSON.stringify(source));
    const outputPath = resolve(directory, 'context.json');
    await prepareSpatialContext({ sourcePath: authored, solarGeometryPath, outputPath, objectsDirectory: directory });
    const prepared = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.deepEqual(prepared.bodies.map((body: { id: string }) => body.id), ['menoetius']);
    assert.equal(prepared.bodies[0].orbit.centerBodyId, 'patroclus');
    assert.deepEqual(prepared.bodies[0].orbit.centerPositionM, prepared.orbitCenters.patroclus.positionM);
    for (const [name, override] of [['missing', '{}'], ['moved', "{...original.BODY_HELIOCENTRIC_STATES,patroclus:{...original.BODY_HELIOCENTRIC_STATES.patroclus,positionKm:[0,0,0]}}"]]) {
      const fixtureGeometryPath = resolve(directory, `${name}.mjs`);
      await writeFile(fixtureGeometryPath, `export * from ${JSON.stringify(pathToFileURL(solarGeometryPath).href)};\nimport * as original from ${JSON.stringify(pathToFileURL(solarGeometryPath).href)};\nexport const BODY_HELIOCENTRIC_STATES=${override};\n`);
      await assert.rejects(() => prepareSpatialContext({ sourcePath: authored, solarGeometryPath: fixtureGeometryPath, outputPath, objectsDirectory: directory }), /incompatible with its parent/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
