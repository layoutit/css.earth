import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { parsePreparedClusterCatalog } from '@cssearth/catalog';
import { M_PER_PC } from '@cssearth/astronomy';
import { comovingDistanceMpc, parseMcxcRows, prepareClusterCatalog } from './prepare.js';
import type { ClusterRecipe } from './prepare.js';

const directory = resolve('src/objects/galaxy-clusters');
test('the checked seven clusters reproduce from the pinned independent MCXC-II release with exact columns and units', async () => {
  const recipe = JSON.parse(await readFile(resolve(directory, 'source/catalogue.json'), 'utf8')) as ClusterRecipe;
  const provenance = JSON.parse(await readFile(resolve(directory, 'source/provenance.json'), 'utf8'));
  assert.deepEqual(recipe.sources, provenance.sources);
  for (const source of recipe.sources) {
    const bytes = await readFile(resolve(directory, 'source', source.path));
    assert.equal(bytes.length, source.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
  }
  const table = await readFile(resolve(directory, 'source/mcxcii.dat.gz'));
  const rows = parseMcxcRows(gunzipSync(table).toString('ascii'));
  assert.equal(rows.length, recipe.rowCount);
  const data = parsePreparedClusterCatalog(prepareClusterCatalog(rows, recipe));
  assert.deepEqual(data.objects.map(row => row.id), recipe.selection.map(row => row.id));
  const perseus = data.objects.find(row => row.id === 'perseus-cluster')!;
  assert.equal(perseus.skyPosition.raDeg, 49.9467); assert.equal(perseus.skyPosition.decDeg, 41.5131);
  assert.equal(perseus.redshift.value, .0179); assert.equal(perseus.redshift.sourceRef, '1998AAS...193.3912C');
  assert.equal(perseus.aperture.properRadiusM, 1.2778 * 1e6 * M_PER_PC);
  for (const row of data.objects) {
    assert.ok(Math.abs(Math.hypot(...row.positionM) / (row.distance.valuePc * M_PER_PC) - 1) < 1e-11);
    assert.equal(row.aperture.comovingRadiusM, row.aperture.properRadiusM * (1 + row.redshift.value));
    assert.match(row.distance.method, /peculiar velocities are not corrected/);
    assert.ok(!('membership' in row)); assert.ok(!('members' in row));
  }
  const bytes = await readFile(resolve(directory, 'prepared/catalogue.json'));
  assert.deepEqual(JSON.parse(bytes.toString()), data);
  const manifest = JSON.parse(await readFile(resolve(directory, 'inventory.json'), 'utf8'));
  assert.equal(manifest.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(manifest.bytes, bytes.length); assert.equal(manifest.objects, recipe.selection.length);
  assert.throws(() => prepareClusterCatalog(rows.filter(row => row.catalogueId !== recipe.selection[0]!.catalogueId), recipe), /release/);
  assert.throws(() => prepareClusterCatalog(rows, { ...recipe, cosmology: { ...recipe.cosmology, hubbleKmPerSecPerMpc: 67 } }), /angular scale/);
});

test('redshift integration agrees with analytic matter-only and Lambda-only distances, not linear cz/H0', () => {
  const z = .3, hubble = 70, scale = 299792.458 / hubble;
  assert.ok(Math.abs(comovingDistanceMpc(z, hubble, 0) - scale * z) < 1e-9);
  assert.ok(Math.abs(comovingDistanceMpc(z, hubble, 1) - 2 * scale * (1 - 1 / Math.sqrt(1 + z))) < 1e-9);
  assert.ok(comovingDistanceMpc(z, hubble, .3) < scale * z * .95);
});

test('cluster validation rejects missing evidence, invalid apertures and ambiguous focus identities', async () => {
  const data = JSON.parse(await readFile(resolve(directory, 'prepared/catalogue.json'), 'utf8'));
  for (const change of [
    (d: typeof data) => { d.objects[0].aperture.properRadiusM = -1; },
    (d: typeof data) => { d.objects[0].positionM[2] = NaN; },
    (d: typeof data) => { d.objects[0].distance.sourceRef = 'unavailable'; },
    (d: typeof data) => { d.objects[1].id = d.objects[0].id; },
    (d: typeof data) => { d.cosmology.omegaMatter = 2; },
  ]) { const bad = structuredClone(data); change(bad); assert.throws(() => parsePreparedClusterCatalog(bad)); }
});

test('shared navigation reaches the selected release and source, context and navigation pins remain closed', async () => {
  const read = async (path: string) => JSON.parse(await readFile(resolve(path), 'utf8'));
  const catalogue = await read('src/objects/galaxy-clusters/prepared/catalogue.json');
  const presentation = await read('src/objects/local-group/source/presentation.json');
  const context = await read('src/objects/sun/prepared/world-context.json');
  const sourceBytes = await readFile(resolve('src/objects/sun/source/navigation/universe.json'));
  const hash = createHash('sha256').update(sourceBytes).digest('hex');
  const descriptor = await read('src/objects/sun/object.json'), navigation = await read('src/objects/sun/prepared/world-navigation.json');
  const manifest = await read('src/objects/sun/source/manifest.json');
  assert.equal(JSON.parse(sourceBytes.toString()).camera.maximumDistanceM, context.camera.maximumDistanceM);
  assert.equal(presentation.maximumDistanceM, context.camera.maximumDistanceM);
  for (const row of catalogue.objects) assert.ok(context.camera.maximumDistanceM > Math.hypot(...row.positionM) + row.aperture.comovingRadiusM * 10);
  // #242 moved pin ownership to the manifest; the recipe source only declares the id/path binding now.
  assert.equal(descriptor.properties.recipe.sources.find((source: { id: string }) => source.id === 'world-context').path, 'source/navigation/universe.json');
  assert.equal(navigation.sources.find((source: { id: string }) => source.id === 'world-context').sha256, hash);
  assert.ok(manifest.inputs.find((source: { path: string }) => source.path === 'navigation/universe.json'));
});
