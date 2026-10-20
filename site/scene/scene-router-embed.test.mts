import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { parseHTML } from 'linkedom';
import type { SceneFactory, BrowserWindow } from '../browser/browser-types.mts';
import type { WorldContextOwner } from './session/scene-world.mts';
import type { WorldCameraPose } from '@cssearth/engine';
import type { WorldLayerVisibility } from '@cssearth/renderer/universe/world-layers.ts';

// Exercise the real router, sessions, world mounting and navigation guards. Stub the scene, registry and camera work.
const effects: string[] = [], hidden: WorldLayerVisibility[] = [], zoomOpen: boolean[] = [];
let frameChanged: ((world: WorldCameraPose) => void) | undefined;
let releaseBridge!: () => void;
const bridgeGate = () => new Promise<void>(resolve => { releaseBridge = resolve; });
let bridgeReady = Promise.resolve();
const worldPose: WorldCameraPose = { referenceFrame: 'ICRF', epochJdTt: 2451545,
  pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } };
const no = () => {};
async function waitForBridge() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (effects.includes('connect-bridge')) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('bridge did not connect');
}
const navigation = { capture: () => worldPose, optics: () => ({ focalPixels: 1000, principalOffsetPixels: [0, 0] }),
  frame: {}, subscribe(callback: typeof frameChanged) { frameChanged = callback; return no; },
  setZoomOutCentering: no, setZoomOutOpen(open: boolean) { zoomOpen.push(open); } };
const scene = { ready: Promise.resolve(), pause: no, resume: no, destroy: no, navigation };
const objects = ['earth', 'mars'].map(id => ({ id, name: id, classification: 'planet' }));
const registry = {
  loadObject: async (id: string) => objects.find(object => object.id === id),
  knownObject: (id: string) => objects.find(object => object.id === id),
  systemViewLoaded: () => true, loadSystemView: async () => {}, worldHolds: () => false,
  SCENE_OBJECTS: objects, WORLD_OBJECTS: objects, SYSTEM_CENTERS: new Set(),
  createPreparedWorldNavigation: () => ({ supports: () => true, destroy: no }),
  createSceneSelection: () => ({ current: { objectId: 'earth' }, context: {},
    zoomOutOpen: () => true, ownScene: () => true,
    followCamera() { effects.push('follow-camera'); return null; } }),
  selectionTargetFromUrl: () => ({ objectId: 'earth' }),
  createSceneActivation: () => ({ frameInitialView: async () => true, restore: async () => ({ interrupted: false }), connectControls: no }),
  mountObjectShell: () => ({ presentSelection: no, destroy: no }),
  createShowcaseController: () => ({ destroy: no }),
  watchCameraSelection: () => { effects.push('watch-camera'); return Object.assign(no, { refresh: no }); },
  resolveNavigation: () => ({ destination: { subject: { objectId: 'mars' }, scene: 'reuse', camera: { kind: 'preserve' },
    history: { history: 'push' }, url: 'http://site.test/mars/', origin: 'selection' } }),
};
mock.module(new URL('./scene-imports.mts', import.meta.url).href, { namedExports: {
  importSceneRegistry: async () => registry, importPackagedObjectRuntime: async () => ({}),
  importEmbedBridge: async () => { effects.push('import-bridge'); await bridgeReady; return import('./embed-bridge.mts'); } } });
mock.module(new URL('./object-adapter.mts', import.meta.url).href, { namedExports: { objectAdapter: {} } });
mock.module(new URL('./startup-billboard.mts', import.meta.url).href, { namedExports: { prepareStartupBillboard: async () => null } });
mock.module(new URL('../world/systems/inside-view.mts', import.meta.url).href, { namedExports: {
  restoredViewBody: () => null, insideBody: () => null, pastCentreGalaxy: () => false, setZoomCentre: no, zoomStepOf: () => null,
  worldSubject: (id: string) => id, worldSubjectFrame: (_id: string, frame: unknown) => frame } });
mock.module(new URL('../navigation/navigation-history.mts', import.meta.url).href, { namedExports: {
  createNavigationHistory: () => ({ destroy: no, checkpoint: no, remember: no, keep: no }), bindNavigationLinks: () => no,
  navigationHref: (window: Window) => window.location.href, replaceNavigationUrl: no } });
mock.module(new URL('./session/scene-view.mts', import.meta.url).href, { namedExports: {
  createSceneView: () => ({ arrive: async () => true, capture: () => null, syncDataset: no }) } });
mock.module(new URL('./session/scene-transition.mts', import.meta.url).href, { namedExports: {
  focusExistingScene: async () => { effects.push('navigate'); return true; }, prepareSceneReplacement: no } });
mock.module(new URL('../directory/startup-requests.mts', import.meta.url).href, { namedExports: {
  releaseStartupRequests: no, startFlightRequest: no, startupFetch: no } });
mock.module(new URL('./embed-bridge.mts', import.meta.url).href, { namedExports: {
  connectEmbedBridge() {
    effects.push('connect-bridge');
    return { worldMounted: () => effects.push('bridge-world'), sceneMounted: no, destroy: no };
  },
} });

const { createSceneRouter } = await import('./scene-router.mts');

async function fixture(query: string, framed = true) {
  effects.length = 0; hidden.length = 0; zoomOpen.length = 0;
  const { document } = parseHTML('<html><body><div class="object-stage"></div></body></html>');
  const stage = document.querySelector<HTMLElement>('div')!;
  stage.getBoundingClientRect = () => ({ width: 800, height: 600 }) as DOMRect;
  const windowTarget = {
    document, location: { href: `http://site.test/earth/${query}` },
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(1), 0), cancelAnimationFrame: clearTimeout,
    addEventListener: no, removeEventListener: no, parent: framed ? {} : null,
  };
  if (!framed) Reflect.set(windowTarget, 'parent', windowTarget);
  const errors: unknown[] = [];
  const owner = {
    createViewport: () => ({ destroy: no }),
    mount: async () => ({ destroy: no, setLayerVisibility: (value: WorldLayerVisibility) => { hidden.push(value); effects.push('layers'); },
      createFramePresenter: () => { effects.push('presenter'); return ({ present: no, enable: no, warm: () => false, destroy: no }); } }),
  };
  const router = createSceneRouter({ stage, objectId: 'earth', documentTarget: document, windowTarget: windowTarget as unknown as BrowserWindow,
    persistentWorldContext: owner as unknown as WorldContextOwner,
    loadObject: async () => (() => scene) as unknown as SceneFactory, reportError: error => errors.push(error) });
  assert.equal(await router.settled, true, `initial mount: ${errors.map(String).join(', ')}`);
  assert.deepEqual(errors, []);
  return { router, document };
}

test('public and wiki pages never connect a bridge, and all navigation guards stay open', async () => {
  for (const query of ['', '?embed', '?bridge=http://lab.test']) {
    const { router, document } = await fixture(query);
    assert.equal('embedLock' in document.documentElement.dataset, false);
    assert.equal(effects.includes('import-bridge'), false);
    assert.equal(effects.includes('connect-bridge'), false);
    assert.ok(effects.includes('follow-camera'), 'camera following is enabled');
    assert.ok(effects.includes('watch-camera'), 'camera selection watcher is connected');
    assert.ok(zoomOpen.includes(true), 'zoom out may leave this object');
    assert.equal(await router.navigate('mars'), true, 'cross-object navigation reaches its transition');
    router.destroy();
  }
});

test('a framed bridge locks cross-object navigation, camera following, zoom out and camera selection', async () => {
  const { router, document } = await fixture('?embed&bridge=http://lab.test');
  await waitForBridge();
  assert.equal('embedLock' in document.documentElement.dataset, true);
  assert.equal(effects.filter(effect => effect === 'connect-bridge').length, 1);
  assert.equal(effects.includes('follow-camera'), false);
  assert.equal(effects.includes('watch-camera'), false);
  assert.ok(zoomOpen.length > 0 && zoomOpen.every(open => !open));
  frameChanged?.(worldPose);
  assert.equal(effects.includes('follow-camera'), false, 'world camera subscription cannot leave the subject');
  assert.equal(await router.navigate('mars'), false);
  assert.equal(effects.includes('navigate'), false);
  assert.equal(await router.navigate('earth', { kind: 'link', url: 'http://site.test/earth/?dataset=night' }), true, 'same-object dataset links remain usable');
  router.destroy();
});

test('invalid origins and top-level bridge URLs stay unlocked and navigable', async () => {
  for (const [query, framed] of [['?embed&bridge=bad', true], ['?embed&bridge=javascript:alert(1)', true],
    ['?embed&bridge=http://lab.test/path', true], ['?embed&bridge=http://lab.test', false]] as const) {
    const { router, document } = await fixture(query, framed);
    assert.equal('embedLock' in document.documentElement.dataset, false);
    assert.equal(effects.includes('import-bridge'), false);
    assert.equal(effects.includes('connect-bridge'), false);
    assert.equal(await router.navigate('mars'), true);
    router.destroy();
  }
});

test('URL layers reach the world before its first presenter even while the bridge import is waiting', async () => {
  bridgeReady = bridgeGate();
  try {
    const { router } = await fixture('?embed&bridge=http://lab.test&hide=stars,nebulae');
    assert.ok(effects.includes('import-bridge'));
    assert.equal(effects.includes('connect-bridge'), false, 'the asynchronous bridge has not arrived');
    assert.equal(hidden.length, 1);
    assert.ok(effects.indexOf('layers') < effects.indexOf('presenter'));
    assert.equal(hidden[0]!.stars, false); assert.equal(hidden[0]!.nebulae, false); assert.equal(hidden[0]!.subject, true);
    releaseBridge(); await waitForBridge();
    assert.ok(effects.includes('connect-bridge'));
    router.destroy();
  } finally { releaseBridge(); bridgeReady = Promise.resolve(); }
});
