import { createObjectRuntime } from '../object-runtime.mjs';
import { createSceneLifetime } from '../scene-lifetime.mjs';
import { createPreparedResidency } from '../prepared-residency.mjs';
import { retainedPresentationFixture } from './object-runtime-package.mjs';
import { Surface, orbitFixture } from './orbit-fixture.mjs';

const definitions = new Map(await Promise.all(['mercury', 'venus', 'mars'].map(async id =>
  [id, (await import(`../../planets/${id}/runtime/definition.mjs`)).runtimeDefinition])));
const identity = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';

// Actual common mount, resources, selection, orbit and package presentation.
// Only native DOM, image decoding and input transports are controlled here.
export function materialOrbitFixture(id) {
  const definition = definitions.get(id), native = retainedPresentationFixture(definition);
  const { stage, document } = native;
  for (const name of ['listeners', 'frames', 'nextFrame', 'captured']) stage[name] = new Surface()[name];
  for (const name of Object.getOwnPropertyNames(Surface.prototype).filter(name => name !== 'constructor')) stage[name] = Surface.prototype[name];
  stage.dataset.objectId = id;
  stage.getAnimations = () => [];
  stage.getComputedStyle = element => element.style;
  document.defaultView = stage; document.readyState = 'complete';
  document.querySelector = selector => selector === '.planet-sidebar' ? null : stage;
  const shared = orbitFixture(null, false, { HTMLElement: globalThis.HTMLElement,
    createCubicSkyCameraOrientation: () => ({ scene: () => identity,
      skybox: () => ({ matrix: identity, sunViewDirection: [0, 0, 1] }),
      counterRotation: () => identity, billboardCounterRotation: () => identity,
      reset() {}, rotate() {}, snapshot: () => ({}) }) });
  const f = { ...shared, stage, errors: [], writes: 0, fail: false };
  const publish = () => { f.writes++; if (f.fail) throw new Error('material publication failed'); };
  const mount = createObjectRuntime({ ...definition, createPresentation(host, context) {
    const presentation = definition.createPresentation(host, context);
    const checked = new Set();
    for (const layer of presentation.bodyLayers) for (const overlay of layer.lightingOverlays) {
      for (const node of [overlay, ...overlay.querySelectorAll('*')]) checked.add(node);
      for (let parent = overlay.parentNode; parent && parent !== host && parent !== presentation.sceneElement && parent !== presentation.cameraElement; parent = parent.parentNode) checked.add(parent);
    }
    for (const node of checked) {
      const original = node.style;
      node.style = new Proxy(original, { set(target, key, value) { publish(); target[key] = value; return true; },
        get(target, key) { if (key === 'setProperty') return (...args) => { publish(); return original.setProperty(...args); }; return target[key]; } });
    }
    return presentation;
  } }, {
    createLifetime() { f.lifetime = createSceneLifetime(); return f.lifetime; },
    waitDocument: () => Promise.resolve(), waitPaint: () => Promise.resolve(),
    createControls: () => ({ publish() {}, setReady() {}, destroy() {} }),
    createResources(options) {
      f.ready = options.onReady;
      f.resources = createPreparedResidency({ ...options, createImage: () => ({ src: '', naturalWidth: 1, naturalHeight: 1,
        decode: () => Promise.resolve(), removeAttribute() { this.src = ''; } }) });
      return f.resources;
    },
    mountSky: () => ({ root: { isConnected: true }, setOrientation() {}, destroy() {} }),
    mountSun: () => ({ root: { isConnected: true }, state: () => ({ visible: true }), setViewDirection: () => ({ visible: true }), destroy() {} }),
    createOrbit(options) { f.orbit = shared.create(options); return f.orbit; },
  });
  f.create = async () => { f.runtime = mount(stage, { onError: error => f.errors.push(error) }); await f.runtime.ready; return f.orbit; };
  f.event = (name, orbit) => {
    if (name === 'wheel') return () => {
      try { f.callbacks.wheel.rotate({ controlPitchDelta: 0, controlYawDelta: 0, zoom: 2 }); }
      catch (error) { f.callbacks.wheel.onError(error); }
    };
    if (name === 'resize') return [...stage.listeners.get('resize')][0];
    if (name === 'invalidate') return f.ready;
    if (name === 'refresh') return () => orbit.refresh();
    if (name === 'setState') return () => orbit.setState({ zoom: 2 });
    if (name === 'media-change') return () => f.callbacks.policy.onError(new Error('material publication failed'));
    return () => {
      try { f.callbacks.drag.rotate({ controlPitchDelta: 2, controlYawDelta: 3 }); }
      catch (error) { f.callbacks.drag.onError(error); }
    };
  };
  f.restore = () => { f.fail = false; f.runtime?.destroy(); native.restore(); };
  return f;
}
