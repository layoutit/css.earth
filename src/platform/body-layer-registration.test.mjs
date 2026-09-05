import assert from 'node:assert/strict';
import test from 'node:test';
import { assertBodyLayerRegistrations } from './body-layer-registration.mjs';
import { requireObjectPresentation, invokeRuntimeHook } from './object-runtime-contract.mjs';
import { bodyLayerFixture } from './test/body-layer-fixture.mjs';

test('retained body and overlay registration allows a sibling overlay within the same stage', () => {
  const f = bodyLayerFixture(); assert.equal(f.sceneElement.contains(f.overlay), false);
  assert.equal(assertBodyLayerRegistrations(f.bodyLayers, f.sceneElement), true);
});
test('missing, empty, duplicate, forged and foreign-scene layer records cannot satisfy the presentation contract', () => {
  const f = bodyLayerFixture(), foreign = bodyLayerFixture();
  for (const layers of [undefined, [], {}, [f.bodyLayers[0], f.bodyLayers[0]], [{ sceneElement: f.sceneElement, assertRegistered: () => true }], foreign.bodyLayers]) {
    assert.throws(() => assertBodyLayerRegistrations(layers, f.sceneElement), /body-layer registrations/);
  }
});
for (const name of ['commitSelection', 'publishFrame']) test(`${name} cannot detach or move a registered layer behind a successful return`, () => {
  const f = bodyLayerFixture();
  const presentation = requireObjectPresentation({ cameraElement: f.cameraElement, sceneElement: f.sceneElement, bodyLayers: f.bodyLayers,
    commitSelection() {}, publishFrame() {}, [name]() { f.sceneElement.append(f.overlay); } });
  assert.throws(() => invokeRuntimeHook(presentation, name, [{}]), /parent identity/);
});
test('the publication boundary refuses an already detached body before invoking rendering', () => {
  const f = bodyLayerFixture(); let called = false;
  const presentation = requireObjectPresentation({ cameraElement: f.cameraElement, sceneElement: f.sceneElement, bodyLayers: f.bodyLayers,
    commitSelection() {}, publishFrame() { called = true; } });
  f.body.remove(); assert.throws(() => invokeRuntimeHook(presentation, 'publishFrame', [{}]), /left its camera scene/);
  assert.equal(called, false);
});
