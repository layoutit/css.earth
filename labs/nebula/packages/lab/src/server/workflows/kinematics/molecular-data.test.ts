import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseMolecularTable, readMolecularRecipe } from './molecular-data.ts';
import { acquireMolecularSources, loadMolecularCatalogue } from './molecular-source.ts';
import type { MolecularRecipe } from '@cssearth/nebula-reconstruction/methods/kinematics/molecular-types';

const recipePath = 'labs/nebula/models/helix/kinematics-hco.json';
const originalRecipe = readMolecularRecipe(JSON.parse(await readFile(recipePath, 'utf8')) as unknown);
// Original Table 1's first ten rows, including two multicomponent pointings and three intensity limits.
// The published paper prints this same excerpt. No synthetic observations are used for numerical assertions.
const excerpt = [
  ' 525 -105   13.7 12.9 -25.5 1.227e11 1.635e-8',
  ' 525  -35   16.2 14.6 -20.8 1.642e11 2.189e-8',
  ' 525   35 < 20.',
  ' 525  105 < 20.',
  ' 455 -210 < 15.',
  ' 455 -140   20.4  2.3 -28.7 3.257e10 4.342e-9',
  ' 455 -140   17.7  7.8 -16.0 9.582e10 1.278e-8',
  ' 455  -70   32.8 13.3 -28.5 3.028e11 4.037e-8',
  ' 455  -70   23.0  3.5 -17.9 5.587e10 7.450e-9',
  ' 455    0   50.6 14.3 -24.5 5.022e11 6.696e-8',
].join('\n') + '\n';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const recipe: MolecularRecipe = { ...originalRecipe, table: { ...originalRecipe.table, records: 10, bytes: Buffer.byteLength(excerpt) },
  expectedCounts: { rows: 10, pointings: 8, detectedComponents: 7, detectedPointings: 5, upperLimits: 3 } };

test('published offset signs and exact origin are retained without a second cosine factor or hidden recentering', () => {
  const data = parseMolecularTable(excerpt, recipe);
  assert.equal(data.points[0]!.xWestArcsec, -525); assert.equal(data.points[0]!.yNorthArcsec, -105);
  assert.deepEqual(recipe.coordinates.originJ2000Degrees, { ra: 337.41083333333336, dec: -20.83833333333333 });
  assert.equal(data.points[9]!.yNorthArcsec, 0); assert.equal(Object.is(data.points[9]!.yNorthArcsec, -0), false);
  assert.deepEqual(data.diagnostics.xWestRangeArcsec, [-525, -455]);
});
test('published LSR centroids remain untouched despite the available source-specific heliocentric conversion', () => {
  const data = parseMolecularTable(excerpt, recipe);
  assert.equal(recipe.velocity.publishedHeliocentricConversion.lsrMinusHeliocentricKmS, 3.12);
  assert.equal(recipe.velocity.publishedHeliocentricConversion.appliedToMeasurements, false);
  assert.equal(data.points[0]!.velocityLsrKmS, -25.5);
  assert.equal(data.points[5]!.velocityLsrKmS, -28.7);
  assert.equal(data.points[6]!.velocityLsrKmS, -16);
  assert.equal(data.points[0]!.intensityMilliKelvin, 13.7, 'T_R* is not efficiency corrected');
});
test('multiple components preserve the common pointing key and their own measured widths and velocities', () => {
  const data = parseMolecularTable(excerpt, recipe), a = data.points[5]!, b = data.points[6]!;
  assert.equal(a.pointingKey, b.pointingKey); assert.notEqual(a.id, b.id);
  assert.equal(a.componentIndex, 0); assert.equal(b.componentIndex, 1);
  assert.equal(a.fwhmKmS, 2.3); assert.equal(b.fwhmKmS, 7.8);
  const pointing = data.pointings.find(p => p.pointingKey === a.pointingKey)!;
  assert.deepEqual(pointing.sourceRows, [6, 7]); assert.deepEqual(pointing.pointIds, [a.id, b.id]);
  assert.equal(data.diagnostics.multiComponentPointings, 2); assert.equal(data.diagnostics.maximumComponents, 2);
});
test('upper limits remain intensity constraints with null velocity, width, errors, and inferred chemistry', () => {
  const data = parseMolecularTable(excerpt, recipe), limit = data.points[2]!;
  assert.equal(limit.status, 'upper-limit'); assert.equal(limit.intensityLimit, '<'); assert.equal(limit.intensityMilliKelvin, 20);
  assert.equal(limit.velocityLsrKmS, null); assert.equal(limit.fwhmKmS, null);
  assert.deepEqual(limit.inferred, { columnDensityCm2: null, fractionalAbundance: null });
  assert.equal(data.diagnostics.centralPointingPresent, false, 'unlisted central nondetection is not invented');
  for (const point of data.points) {
    assert.equal(point.velocityUncertaintyKmS, null); assert.equal(point.fwhmUncertaintyKmS, null); assert.equal(point.intensityUncertaintyMilliKelvin, null);
  }
  assert.equal(recipe.instrument.beamFwhmArcsec, 70, 'half-beam sampling must not be called higher beam resolution');
  assert.deepEqual(recipe.instrument.gridSpacingsArcsec, [35, 70]);
});
test('chemistry stays a separate inferred quantity and broad lines are marked without dropping observations', () => {
  const data = parseMolecularTable(excerpt, recipe);
  assert.equal(data.points[0]!.inferred.columnDensityCm2, 1.227e11);
  assert.equal(data.points[0]!.inferred.fractionalAbundance, 1.635e-8);
  const broad = parseMolecularTable(excerpt.replace('13.7 12.9', '13.7 22.0'), recipe);
  assert.equal(broad.points.length, 10); assert.equal(broad.points[0]!.possiblyUnresolvedBlend, true);
  assert.equal(broad.points[0]!.velocityLsrKmS, data.points[0]!.velocityLsrKmS);
});
test('malformed fields, incompatible frames, double-applied conversion and contradictory counts fail validation', () => {
  assert.throws(() => readMolecularRecipe({ ...recipe, velocity: { ...recipe.velocity, frame: 'heliocentric' } }));
  assert.throws(() => readMolecularRecipe({ ...recipe, velocity: { ...recipe.velocity, publishedHeliocentricConversion: { ...recipe.velocity.publishedHeliocentricConversion, appliedToMeasurements: true } } }));
  assert.throws(() => readMolecularRecipe({ ...recipe, table: { ...recipe.table, columns: { ...recipe.table.columns, intensity: { ...recipe.table.columns.intensity, unit: 'K' } } } }));
  assert.throws(() => parseMolecularTable(excerpt.replace('< 20.', '> 20.'), recipe));
  assert.throws(() => parseMolecularTable(excerpt.replace('-25.5', '     '), recipe));
  assert.throws(() => parseMolecularTable(excerpt.replace('-25.5', ' NaN '), recipe));
  assert.throws(() => parseMolecularTable(excerpt.split('\n').slice(1).join('\n'), recipe));
  assert.throws(() => parseMolecularTable(excerpt, { ...recipe, expectedCounts: { ...recipe.expectedCounts, pointings: 7 } }));
  const zeroVelocity = parseMolecularTable(excerpt.replace('-25.5', '  0.0'), recipe);
  assert.equal(zeroVelocity.points[0]!.velocityLsrKmS, 0, 'a measured zero is distinct from a blank field');
});

async function fixtureRoot(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'nebula-molecular-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const readme = 'Unit-test metadata for the printed Table 1 excerpt.\n';
  const local = { ...recipe, citation: { ...recipe.citation, readme: { ...recipe.citation.readme, bytes: Buffer.byteLength(readme), sha256: sha(readme) } } };
  await mkdir(dirname(resolve(root, recipePath)), { recursive: true });
  await writeFile(resolve(root, recipePath), JSON.stringify(local));
  return { root, local, readme };
}
test('explicit acquisition verifies actual side effects, then replay uses the source cache without any fetch', async t => {
  const { root, local, readme } = await fixtureRoot(t), realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const fetched: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input); fetched.push(url);
    return new Response(url === local.table.url ? excerpt : url === local.citation.readme.url ? readme : '', { status: 200 });
  };
  const receipt = await acquireMolecularSources(root, recipePath);
  assert.equal(receipt.status, 'complete'); assert.equal(receipt.diagnostics.detectedComponents, 7);
  assert.equal(fetched.length, 2); assert.ok(receipt.sources.every(source => source.status === 'downloaded'));
  assert.equal(await readFile(resolve(root, local.table.cachePath), 'utf8'), excerpt);
  globalThis.fetch = async () => { throw new Error('Cache replay must not fetch.'); };
  const loaded = await loadMolecularCatalogue(root, recipePath);
  assert.deepEqual(loaded.points, parseMolecularTable(excerpt, recipe).points);
  const replay = await acquireMolecularSources(root, recipePath);
  assert.ok(replay.sources.every(source => source.status === 'verified'));
});
test('HTTP 200 without the pinned bytes does not establish source acquisition', async t => {
  const { root } = await fixtureRoot(t), realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async () => new Response('HTML error page', { status: 200 });
  await assert.rejects(acquireMolecularSources(root, recipePath), /identity changed/);
  await assert.rejects(loadMolecularCatalogue(root, recipePath));
});
