import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { SCENE_OBJECTS } from '../objects.mts';
import { createObjectBrowserProfile } from './object-browser-profile.mts';
import { loadPlanetBrowserProfile } from './load-browser-profile.mts';
import type { BrowserPage, CameraField } from './browser-profile-types.mts';
import objectControls from '../../src/objects/moon/prepared/controls.json' with { type: 'json' };

const state = { pitch: 37, controlPitch: 37, controlYaw: -92, zoom: 1.4 };
function nativePage(id: string, cameraState: unknown = state): BrowserPage {
  return { evaluate(fn: { toString(): string }, payload: unknown) {
    return structuredClone(runInNewContext(`(${fn.toString()})(payload)`, {
      payload, window: { [`__${id}`]: { camera: { state: () => cameraState, setState: (value: unknown) => value } } },
    }));
  } } as unknown as BrowserPage;
}

test('every actual profile reads its recorded coordinates from the shared camera endpoint', async () => {
  for (const object of SCENE_OBJECTS) {
    const profile = await loadPlanetBrowserProfile(object);
    const value = await profile.camera(nativePage(object.id));
    assert.equal(value.pitch, state.pitch); assert.equal(value.zoom, state.zoom);
    for (const [field, coordinate] of Object.entries(value)) assert.equal(coordinate, state[field as CameraField]);
  }
  for (const id of ['mars', 'jupiter']) {
    const found = SCENE_OBJECTS.find(object => object.id === id); assert.ok(found);
    const profile = await loadPlanetBrowserProfile(found);
    assert.deepEqual(await profile.camera(nativePage(id)), state);
  }
});

test('coordinate field selection is immutable reporting data, with no private camera implementation', async () => {
  const cameraFields: CameraField[] = ['pitch', 'zoom'];
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
  for (const cameraFields of [[], ['pitch'], ['pitch', 'zoom', 'zoom'], ['pitch', 'zoom', 'privateYaw']] as unknown as readonly CameraField[][]) {
    assert.throws(() => createObjectBrowserProfile({ id: 'moon', controls: objectControls, cameraFields }), /Camera observation fields/);
  }
});

test('an already ready object does not depend on a redundant browser waiter', async () => {
  for (const object of SCENE_OBJECTS) {
    const profile = await loadPlanetBrowserProfile(object);
    await profile.waitForRuntime({
      evaluate: (fn: { toString(): string }, key: unknown) => runInNewContext(`(${fn.toString()})(key)`, {
        key, window: { [`__${object.id}`]: { ready: true } },
      }),
      waitForFunction() { throw new Error('The redundant browser waiter is unavailable.'); },
    } as unknown as BrowserPage);
  }
});

test('a missing or loading object still requires successful readiness before returning', async () => {
  const moon = SCENE_OBJECTS.find(object => object.id === 'moon'); assert.ok(moon);
  const profile = await loadPlanetBrowserProfile(moon);
  for (const runtime of [undefined, { ready: false }]) {
    const window = { __moon: runtime };
    const evaluate = (fn: { toString(): string }, key: unknown) => runInNewContext(`(${fn.toString()})(key)`, { key, window });
    await assert.rejects(profile.waitForRuntime({ evaluate,
      waitForFunction: async (fn: { toString(): string }, key: unknown) => {
        assert.equal(evaluate(fn, key), false);
        throw new Error('Readiness did not arrive.');
      },
    } as unknown as BrowserPage), /Readiness did not arrive/);
  }
});

test('the actual Saturn profile observes one exclusive lens and rejects the former dual selection', async () => {
  const saturn = SCENE_OBJECTS.find(object => object.id === 'saturn'); assert.ok(saturn);
  const profile = await loadPlanetBrowserProfile(saturn);
  const pressed: string[] = [], selected: string[] = [], committed = { lensId: 'normal' };
  const page = { async evaluate(fn: { toString(): string }, payload: unknown) {
    return structuredClone(await runInNewContext(`(${fn.toString()})(payload)`, {
      payload,
      document: { querySelectorAll(selector: string) {
        assert.equal(selector, 'button[name="dataset"][aria-pressed="true"]');
        return pressed.map(value => ({ value }));
      } },
      window: { __saturn: {
        lenses: { state: () => ({ id: committed.lensId, ready: true }), select(id: string) {
          selected.push(id); committed.lensId = id; return true;
        } },
        runtime: { selection: () => ({ committed }) },
      } },
    }));
  } } as unknown as BrowserPage;
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


test('camera observations reject missing or non-finite required coordinates', () => {
  const profile = createObjectBrowserProfile({ id: 'moon', controls: objectControls });
  for (const invalid of [{ pitch: 37 }, { zoom: 1 }, { pitch: NaN, zoom: 1 }, { pitch: 0, zoom: Infinity }]) {
    assert.throws(() => profile.camera(nativePage('moon', invalid)), /finite pitch and zoom/);
  }
});
