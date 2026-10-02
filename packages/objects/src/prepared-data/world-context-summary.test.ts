import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expandWorldContextSummary, expandWorldSystem } from './world-context-summary.js';
import { PREPARED_CSS_OBJECT_FORMAT } from './object-format.js';

const summary = () => ({
  schema: 'cssearth-world-context-summary@2',
  systemNames: ['Solar System'], discoveries: [{ method: 'imaging' }],
  billboard: { size: 512, focalPixels: 256, distanceRadii: 8 },
  focus: { id: 'sun', positionM: [0, 0, 0], radiusM: 10 },
  bodies: { id: ['earth'], radiusM: [2], positionM: [[20, 0, 0]], system: [0], discovery: [0],
    billboard: [{}], orbit: [{ centerBodyId: 'sun', bounds: { centerM: [0, 0, 0], radiusM: 20 }, lod: true }], optional: [null] },
});

test('prepared format and compact world tables preserve the expanded transport shape', () => {
  assert.equal(PREPARED_CSS_OBJECT_FORMAT, 'cssearth-css-object@5');
  assert.deepEqual(expandWorldContextSummary(summary()), {
    schema: 'cssearth-world-context-summary@2', focus: { id: 'sun', positionM: [0, 0, 0], radiusM: 10 },
    bodies: [{ id: 'earth', radiusM: 2, positionM: [20, 0, 0], systemName: 'Solar System', discovery: { method: 'imaging' },
      billboard: { url: '/scenes/earth/earth-billboard.webp', size: 512, focalPixels: 256, distanceM: 16 },
      orbit: { centerBodyId: 'sun', centerPositionM: [0, 0, 0], bounds: { centerM: [0, 0, 0], radiusM: 20 },
        lod: { bounds: { centerM: [0, 0, 0], radiusM: 20 } } } }],
  });
  const expanded = { schema: 'cssearth-world-context-summary@2', bodies: [] };
  assert.equal(expandWorldContextSummary(expanded), expanded);
});

test('compact world tables reject unequal columns, missing entries and unknown orbit centres', () => {
  const unequal = summary(); unequal.bodies.id.push('mars');
  assert.throws(() => expandWorldContextSummary(unequal), /has 1 entries, not 2/);
  const missing = summary(); missing.bodies.system[0] = 1;
  assert.throws(() => expandWorldContextSummary(missing), /not an index into its 1-entry table/);
  const unknown = summary(); unknown.bodies.orbit[0]!.centerBodyId = 'missing';
  assert.throws(() => expandWorldContextSummary(unknown), /parent missing is not placed/);
});

test('a holder\'s bodies resolve shared orbit centres without overriding explicit billboard fields', () => {
  const input = { schema: 'cssearth-world-system@1', id: 'earth', systemNames: [], discoveries: [], billboard: {},
    bodies: { id: ['moon'], radiusM: [1], billboard: [{ url: '/moon.webp', size: 32, focalPixels: 16, distanceM: 12 }],
      orbit: [{ centerBodyId: 'earth' }] } };
  assert.deepEqual(expandWorldSystem(input, id => id === 'earth' ? [20, 0, 0] : undefined), {
    schema: 'cssearth-world-system@1', id: 'earth', bodies: [{ id: 'moon', radiusM: 1,
      billboard: { url: '/moon.webp', size: 32, focalPixels: 16, distanceM: 12 },
      orbit: { centerBodyId: 'earth', centerPositionM: [20, 0, 0] } }],
  });
});
