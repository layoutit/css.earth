import { loadObjectTestDefinition } from '../../tools/object-test-data.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { OBJECTS } from '../objects.mts';
import { createObjectBrowserProfile } from './object-browser-profile.mjs';
import { loadPlanetBrowserProfile } from './load-browser-profile.mjs';
const { controls: objectControls } = await loadObjectTestDefinition('moon');

const state = { pitch: 37, controlPitch: 37, controlYaw: -92, zoom: 1.4 };
function nativePage(id) {
  return { evaluate(fn, payload) {
    return structuredClone(runInNewContext(`(${fn.toString()})(payload)`, {
      payload, window: { [`__${id}`]: { camera: { state: () => state, setState: value => value } } },
    }));
  } };
}

test('every actual profile reads its recorded coordinates from the shared camera endpoint', async () => {
  for (const object of OBJECTS) {
    const profile = await loadPlanetBrowserProfile(object);
    const value = await profile.camera(nativePage(object.id));
    assert.equal(value.pitch, state.pitch); assert.equal(value.zoom, state.zoom);
    for (const [field, coordinate] of Object.entries(value)) assert.equal(coordinate, state[field]);
  }
  for (const id of ['mars', 'jupiter']) {
    const profile = await loadPlanetBrowserProfile(OBJECTS.find(object => object.id === id));
    assert.deepEqual(await profile.camera(nativePage(id)), state);
  }
});

test('coordinate field selection is immutable reporting data, with no private camera implementation', async () => {
  const cameraFields = ['pitch', 'zoom'];
  const profile = createObjectBrowserProfile({ id: 'moon', controls: objectControls, cameraFields });
  cameraFields.push('controlYaw');
  assert.deepEqual(await profile.camera(nativePage('moon')), { pitch: 37, zoom: 1.4 });
});

test('restoring a complete camera observation preserves yaw and the pitch alias', async () => {
  const profile = createObjectBrowserProfile({ id: 'moon', controls: objectControls });
  assert.deepEqual(await profile.setCamera(nativePage('moon'), state), { controlPitch: 37, controlYaw: -92, zoom: 1.4 });
  assert.deepEqual(await profile.setCamera(nativePage('moon'), { ...state, pitch: state.pitch + 80 }), { controlPitch: 117, controlYaw: -92, zoom: 1.4 });
  assert.deepEqual(await profile.setCamera(nativePage('moon'), { pitch: 42, zoom: 2 }), { controlPitch: 42, zoom: 2 });
});

test('camera reporting rejects missing, repeated and unsupported coordinates', () => {
  for (const cameraFields of [[], ['pitch'], ['pitch', 'zoom', 'zoom'], ['pitch', 'zoom', 'privateYaw']]) {
    assert.throws(() => createObjectBrowserProfile({ id: 'moon', controls: objectControls, cameraFields }), /Camera observation fields/);
  }
});

test('an already ready object does not depend on a redundant browser waiter', async () => {
  for (const object of OBJECTS) {
    const profile = await loadPlanetBrowserProfile(object);
    await profile.waitForRuntime({
      evaluate: (fn, key) => runInNewContext(`(${fn.toString()})(key)`, {
        key, window: { [`__${object.id}`]: { ready: true } },
      }),
      waitForFunction() { throw new Error('The redundant browser waiter is unavailable.'); },
    });
  }
});

test('a missing or loading object still requires successful readiness before returning', async () => {
  const profile = await loadPlanetBrowserProfile(OBJECTS.find(object => object.id === 'moon'));
  for (const runtime of [undefined, { ready: false }]) {
    const window = { __moon: runtime };
    const evaluate = (fn, key) => runInNewContext(`(${fn.toString()})(key)`, { key, window });
    await assert.rejects(profile.waitForRuntime({ evaluate,
      waitForFunction: async (fn, key) => {
        assert.equal(evaluate(fn, key), false);
        throw new Error('Readiness did not arrive.');
      },
    }), /Readiness did not arrive/);
  }
});

test('the actual Saturn profile observes one exclusive lens and rejects the former dual selection', async () => {
  const profile = await loadPlanetBrowserProfile(OBJECTS.find(object => object.id === 'saturn'));
  const pressed = [], selected = [], committed = { lensId: 'normal' };
  const page = { async evaluate(fn, payload) {
    return structuredClone(await runInNewContext(`(${fn.toString()})(payload)`, {
      payload,
      document: { querySelectorAll(selector) {
        assert.equal(selector, 'button[name="lens"][aria-pressed="true"]');
        return pressed.map(value => ({ value }));
      } },
      window: { __saturn: {
        lenses: { state: () => ({ id: committed.lensId, ready: true }), select(id) {
          selected.push(id); committed.lensId = id; return true;
        } },
        runtime: { selection: () => ({ committed }) },
      } },
    }));
  } };
  assert.equal(await profile.pressedLens(page), null);
  for (const id of ['cross-section', 'cross-section', 'ultraviolet', 'normal']) {
    assert.equal(await profile.selectLens(page, id), true);
    pressed.splice(0, pressed.length, id);
    assert.equal((await profile.lens(page)).id, id);
    assert.equal(await profile.pressedLens(page), id);
  }
  assert.deepEqual(selected, ['cross-section', 'cross-section', 'ultraviolet', 'normal']);
  pressed.splice(0, pressed.length, 'ultraviolet', 'cross-section');
  await assert.rejects(profile.pressedLens(page), /exclusive.*multiple pressed buttons/);
});
