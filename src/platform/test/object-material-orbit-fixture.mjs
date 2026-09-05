import { readFile } from 'node:fs/promises';
import { createSceneLifetime } from '../scene-lifetime.mjs';
import { Surface, orbitFixture } from './orbit-fixture.mjs';
import { PREPARED_MERCURY_SCENE } from '../../planets/mercury/runtime/preparedScene.mjs';
import { PREPARED_MERCURY_ASSETS } from '../../planets/mercury/runtime/preparedAssets.mjs';
import { PREPARED_MERCURY_SKY_SUN } from '../../planets/mercury/runtime/preparedSkySun.mjs';
import { PREPARED_MARS_SCENE } from '../../planets/mars/runtime/preparedScene.mjs';
import { PREPARED_MARS_CAMERA } from '../../planets/mars/runtime/preparedCamera.mjs';
import { PREPARED_MARS_LIGHTING } from '../../planets/mars/runtime/preparedLighting.mjs';
import { PREPARED_MARS_SKY_SUN } from '../../planets/mars/runtime/preparedSkySun.mjs';
import { PREPARED_VENUS_SCENE } from '../../planets/venus/runtime/preparedScene.mjs';
import { PREPARED_VENUS_SKY_SUN } from '../../planets/venus/runtime/preparedSkySun.mjs';

const factories = new Map();
for (const [id, name] of [['mercury', 'createMercuryOrbit'], ['mars', 'createMarsOrbit'], ['venus', 'createVenusOrbit']]) {
  const source = await readFile(new URL(`../../planets/${id}/runtime/client.mjs`, import.meta.url), 'utf8');
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(id === 'mercury' ? '\n  function publishMaterialFrame(' : '\nfunction ', start + 1);
  if (start < 0 || end < 0) throw new Error(`Missing material adapter: ${id}`);
  factories.set(id, (dependencies) => new Function(...Object.keys(dependencies),
    `${source.slice(start, end)}; return ${name};`)(...Object.values(dependencies)));
}

// Execute each real material adapter and the real shared orbit factory. Only
// native input/DOM transports are replaced, so failure ownership stays real.
export function materialOrbitFixture(id) {
  const shared = orbitFixture(null);
  const lifetime = createSceneLifetime();
  const f = { ...shared, lifetime, errors: [], writes: 0, fail: false };
  const publish = () => { f.writes += 1; if (f.fail) throw new Error('material publication failed'); };
  const checkedStyle = new Proxy({ setProperty: publish }, { set(target, key, value) {
    publish(); target[key] = value; return true;
  } });
  const node = () => { const element = new Surface(); element.closest = () => f.stage; return element; };
  const sun = { root: { isConnected: true }, state: () => ({ visible: true }), setViewDirection: () => ({ visible: true }) };
  const mounted = {
    camera: node(), scene: node(), cameraRoot: node(), sceneRoot: node(),
    cubicSky: { root: { isConnected: true }, setOrientation() {} }, skySun: sun,
    materialCounter: { style: checkedStyle }, materialLeaf: node(),
    materialRoot: { style: checkedStyle }, viewBank: { syncPitch() {} },
    publishMaterialState: publish,
  };
  if (id === 'venus') mounted.scene = { cameraEl: node(), sceneElement: node() };
  const materialCache = { onReady(callback) { f.ready = callback; }, presentation: () => null };
  const dependencies = {
    PREPARED_MERCURY_SCENE, PREPARED_MERCURY_ASSETS, PREPARED_MERCURY_SKY_SUN,
    PREPARED_MARS_SCENE, PREPARED_MARS_CAMERA, PREPARED_MARS_LIGHTING, PREPARED_MARS_SKY_SUN,
    PREPARED_VENUS_SCENE, PREPARED_VENUS_SKY_SUN,
    createRetainedCubicSkyOrbit: shared.create,
    stage: f.stage, inputSurface: f.stage, mounted, lifetime, materialCache,
    onError(error) { f.errors.push(error); lifetime.destroy(); },
    shadowsEnabled: false, shadowlessPresentation: { frameIndex: 0 }, publishShadowlessMaterial() {},
    viewSunDirectionToPreparedLightDirection: (value) => value,
    clamp: (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)),
    normalizeDegrees: (value) => value,
  };
  const factory = factories.get(id)(dependencies);
  f.create = () => id === 'mercury' ? factory() : id === 'mars'
    ? factory(f.stage, mounted, materialCache, () => false, lifetime, dependencies.onError)
    : factory({ inputSurface: f.stage, mounted, plan: PREPARED_VENUS_SCENE.camera, lifetime, onError: dependencies.onError });
  f.event = (name, orbit) => {
    if (name === 'wheel') return () => {
      try { f.callbacks.wheel.rotate({ controlPitchDelta:0, controlYawDelta:0, zoom:2 }); }
      catch (error) { f.callbacks.wheel.onError(error); }
    };
    if (name === 'resize') return [...f.stage.listeners.get('resize')][0];
    if (name === 'invalidate') return f.ready ?? orbit.invalidate;
    if (name === 'refresh') return () => orbit.refresh();
    if (name === 'setState') return () => orbit.setState({ zoom: 2 });
    if (name === 'media-change') return () => f.callbacks.policy.onError(new Error('material publication failed'));
    return () => {
      try { f.callbacks.drag.rotate({ controlPitchDelta: 2, controlYawDelta: 3 }); }
      catch (error) { f.callbacks.drag.onError(error); }
    };
  };
  return f;
}
