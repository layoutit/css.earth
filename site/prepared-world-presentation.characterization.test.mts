import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importWithJson } from './test/fixtures/module-import.mts';
const input = { schema: 'cssearth-world-presentation@6', moons: { major: ['moon'], minor: ['minor-moon'] }, defaultFeatureIds: ['feature'], orbitFeatureIds: [], hiddenOrbitIds: [],
  galaxies: { fadeStartDistanceM: 1, fullDistanceM: 2, maximumDistanceM: 3, minimumDistanceRadii: 4, defaultFocusRadiusM: 5, metersPerParsec: 6 },
  clusters: { fadeStartDistanceM: 7, fullDistanceM: 8 }, categoryFrames: { planet: { centreM: [0, 0, 0], minimumM: [-1, -2, -3], maximumM: [1, 2, 3] } },
};
test('prepared world import validates ids, distances, boxes and ordered corners', () => {
  const subject = new URL('./prepared-world-presentation.mts', import.meta.url), dependency = new URL('./prepared/prepared-world-presentation.json', import.meta.url);
  const valid = importWithJson(subject, dependency, input, `
const value = loaded.PREPARED_WORLD_PRESENTATION;
console.log(JSON.stringify({ ...value, categoryFrames: [...value.categoryFrames], frozenIds: [value.moons.major, value.moons.minor, value.defaultFeatureIds, value.orbitFeatureIds, value.hiddenOrbitIds].map(Object.isFrozen) }));
`);
  assert.deepEqual(JSON.parse(valid.stdout.split('\n')[0]!), {
    moons: input.moons, defaultFeatureIds: input.defaultFeatureIds, orbitFeatureIds: [], hiddenOrbitIds: [], galaxies: input.galaxies, clusters: input.clusters, categoryFrames: Object.entries(input.categoryFrames), frozenIds: [true, true, true, true, true],
  });
  assert.equal(valid.status, 0, valid.stderr);
  assert.ok(valid.stdout.includes('IMPORT_OK'));
  const changes: [unknown, string][] = [
    [{ ...input, galaxies: { ...input.galaxies, fullDistanceM: Infinity } }, 'galaxies.fullDistanceM must be a positive number'],
    [null, 'not cssearth-world-presentation@6'], [{ ...input, schema: 'bad' }, 'not cssearth-world-presentation@6'],
    [{ ...input, moons: { major: [''], minor: [] } }, 'moons.major must list object ids'],
    [{ ...input, galaxies: null }, 'galaxies is missing'], [{ ...input, galaxies: { ...input.galaxies, fullDistanceM: 0 } }, 'galaxies.fullDistanceM must be a positive number'],
    [{ ...input, categoryFrames: null }, 'categoryFrames must map classifications'],
    [{ ...input, categoryFrames: { planet: null } }, 'categoryFrames.planet must be a box'],
    [{ ...input, categoryFrames: { planet: { ...input.categoryFrames.planet, centreM: [0, 0] } } }, 'planet.centreM must be three finite numbers'],
    [{ ...input, categoryFrames: { planet: { ...input.categoryFrames.planet, centreM: [0, 0, 0, 0] } } }, 'planet.centreM must be three finite numbers'],
    [{ ...input, categoryFrames: { planet: { ...input.categoryFrames.planet, minimumM: [2, 0, 0] } } }, 'minimum beyond its maximum'],
  ];
  for (const [value, message] of changes) { const result = importWithJson(subject, dependency, value);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(message), result.stderr); }
});

test('equal category bounds are valid and optional member, host and holder ids are checked', () => {
  const subject = new URL('./prepared-world-presentation.mts', import.meta.url);
  const dependency = new URL('./prepared/prepared-world-presentation.json', import.meta.url);
  const frame = { centreM: [1, 2, 3], minimumM: [1, 2, 3], maximumM: [1, 2, 3], memberIds: ['moon'], hostIds: ['planet'], holderIds: ['system'] };
  const result = importWithJson(subject, dependency, { ...input, categoryFrames: { planet: frame } });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('IMPORT_OK'));
  for (const field of ['memberIds', 'hostIds', 'holderIds']) {
    const invalid = importWithJson(subject, dependency, { ...input, categoryFrames: { planet: { ...frame, [field]: [''] } } });
  assert.equal(invalid.status, 1);
  assert.ok(invalid.stderr.includes(`categoryFrames.planet.${field} must list object ids`));
  }
});
