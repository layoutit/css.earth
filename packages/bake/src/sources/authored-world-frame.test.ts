import assert from 'node:assert/strict';
import test from 'node:test';
import { requireAuthoredWorldFrame } from './authored-world-frame.ts';

// A scene with no surface (a cluster, a galaxy's host): its receipt records the rendered radius its solar-system source
// authors, with no surface tiles and no scene scale to repeat.
const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [1, 2, 3], presentationToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1], metersPerUnit: 4e17 / 310, bodyRadiusM: 4e17 };
const descriptor = { id: 'cluster', properties: { worldFrame: frame, recipe: { shape: { kind: 'sphere', radiusKm: 4e14 }, sources: [{ id: 'solar-system', path: 'source/presentation/solar-system.json' }] } } };
const files = (receipt: object): Record<string, string> => ({
  '/cluster/prepared/world-navigation.json': JSON.stringify({ schema: 'cssearth-world-navigation-preparation@1', id: 'cluster', frame, model: 'ecliptic-presentation-frame', ...receipt }),
  '/cluster/source/manifest.json': JSON.stringify({ documents: [{ path: 'presentation/solar-system.json' }] }),
});
const check = (receipt: object) => { const text = files(receipt); return requireAuthoredWorldFrame({ descriptor, directory: '/cluster', readText: async path => text[path]!, scene: {}, runtime: { camera: { sceneScale: 1 } } }); };

test('a surface-less scene is checked by the rendered radius its receipt records', async () => {
  await check({ renderedRadiusUnits: 310 });
  await assert.rejects(check({ renderedRadiusUnits: 248 }), /does not reproduce its authored shape/u);
  await assert.rejects(check({}), /Rendered radius/u);
});
