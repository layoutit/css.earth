import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareMarkerBindings } from './prepare-marker-bindings.mjs';

test('atlas insertions rebind semantic ids while preserving object-owned sprites', () => {
  const local = { url: '/scenes/moon/earth.webp', index: 0, count: 1, size: 9 };
  const definition = { id: 'moon', heliocentricView: {
    bodyMarker: { url: '/navigation/planet-markers@2x.webp', index: 1, count: 2, size: 3 },
    systemMarkers: { url: '/navigation/planet-markers.webp', sun: { index: 0, count: 2, size: 8 }, bodies: { earth: local, moon: { index: 1, count: 2, size: 5 } } },
  } };
  const result = prepareMarkerBindings(definition, { sun: { index: 0, count: 3 }, moon: { index: 2, count: 3 } }).heliocentricView;
  assert.deepEqual(result.bodyMarker, { url: '/navigation/planet-markers@2x.webp', index: 2, count: 3, size: 3 });
  assert.deepEqual(result.systemMarkers.sun, { index: 0, count: 3, size: 8 });
  assert.equal(result.systemMarkers.bodies.earth, local);
  assert.deepEqual(result.systemMarkers.bodies.moon, { index: 2, count: 3, size: 5 });
  assert.equal(definition.heliocentricView.bodyMarker.count, 2);
});
