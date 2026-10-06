import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { parseHTML } from 'linkedom';
import type { PreparedWorldCameraFrame } from '@cssearth/objects';
import type { createCameraViewport } from '@cssearth/renderer/navigation';

// The standard preload substitutes this owner for router cases; this file owns an isolated real import.
mock.restoreAll();
const renderer = await import('@cssearth/renderer');
const universe = await import('@cssearth/renderer/universe');
let loaded: Promise<unknown>;
const effects: unknown[] = [];
let resourceReady = Promise.resolve();
let shellResult: Promise<unknown[]> = Promise.resolve([]);
let startup: (() => void) | undefined;
let orbitLoaded: (() => void) | undefined;
let frameOptions: { layer: unknown; planner: unknown; heliosphereEnabled(): boolean; onFrame(world: { pose: { positionM: readonly number[] } }): void };
let ancestorResult: Promise<readonly string[]> = Promise.resolve(['outer']);
const layer = {
  publish() {}, inspect() {}, roots: [], opacityClock: {}, depthBase: 1,
  setLabelBlockers: (value: unknown) => effects.push(['blockers', value]),
  previewSelection: (...args: unknown[]) => effects.push(['preview', ...args]),
  selectObject: (...args: unknown[]) => effects.push(['select', ...args]),
  setSelectionHolders: (ids: unknown) => effects.push(['holders', ids]),
  setBodyVisibility: () => {}, addShell: (shell: unknown) => effects.push(['shell', shell]),
  destroy: () => effects.push(['layer-destroy']),
};
const planner = { onOrbitsLoaded(callback: () => void) { orbitLoaded = callback; return () => effects.push(['orbits-unsubscribe']); }, destroy: () => effects.push(['planner-destroy']) };
const prepared = { assets: {}, mount: (_stage: unknown, options: { requestPublication(): boolean }) => { effects.push(['initial-publication', options.requestPublication()]); return layer; },
  createFramePlanner: () => planner,
  loadShells: () => shellResult,
};
mock.module(new URL('../world/application/application-world-resources.mts', import.meta.url).href, { namedExports: { loadApplicationUniverse: () => loaded } });
mock.module('@cssearth/renderer/universe', { namedExports: { ...universe,
  prepareObjectResources: () => ({ ready: resourceReady, destroy: () => effects.push(['resources-destroy']) }) } });
mock.module('@cssearth/renderer', { namedExports: { ...renderer,
  labelOcclusionFor: () => ({ read: () => ['sidebar'], subscribe: () => () => effects.push(['occlusion-unsubscribe']) }) } });
mock.module('@cssearth/renderer/rendering/loading/startup-gate.ts', { namedExports: { afterStartup: (_target: unknown, callback: () => void) => { startup = callback; } } });
mock.module(new URL('../world/application/world-approach.mts', import.meta.url).href, { namedExports: { createWorldApproach: () => ({ start: () => effects.push(['approach-start']), observe(position: unknown) { effects.push(['observe', position]); } }) } });
mock.module(new URL('../world/application/moon-orbit-policy.mts', import.meta.url).href, { namedExports: { suppressMinorMoonOrbitPaint: () => () => effects.push(['orbit-paint-destroy']) } });
mock.module(new URL('../world/application/catalogue-moon-labels.mts', import.meta.url).href, { namedExports: { mountCatalogueMoonLabels: (_host: unknown, bodies: () => unknown, _focus: unknown, _clock: unknown, refresh: () => boolean) => { assert.ok(Array.isArray(bodies())); effects.push(['initial-label-refresh', refresh()]); return ({ selectObject: (id: string) => effects.push(['moon-select', id]), destroy: () => effects.push(['labels-destroy']) }); } } });
mock.module(new URL('../world/application/application-world-frames.mts', import.meta.url).href, { namedExports: { createApplicationWorldFrames: (options: typeof frameOptions) => { frameOptions = options; return ({ refresh: () => { effects.push(['refresh']); return true; },
  stats: {}, present() {}, createFramePresenter() {}, setNavigationInFlight() {},
  setRotationActive: (active: boolean) => effects.push(['rotation', active]), setCoasting: (active: boolean) => effects.push(['coasting', active]), destroy: () => effects.push(['frames-destroy']) }); } } });
mock.module(new URL('../world/application/application-world-visibility.mts', import.meta.url).href, { namedExports: { worldVisibilityPolicy: { minorMoonIds: [] },
  createApplicationWorldVisibility: () => ({ selectObject: (id: string) => effects.push(['visibility-select', id]), setSurrounding: (ids: readonly string[]) => effects.push(['surrounding', ids]), setIllustrationModelsEnabled() {}, setHighlightedClassification() {} }) } });
// One holder's picture lies on walls: the bank of 'known' says so.
mock.module(new URL('../prepared/prepared-context-objects.mts', import.meta.url).href, { namedExports: { CONTEXT_OBJECT_DESCRIPTORS: { 'known-layers': { properties: { surrounds: true, host: 'known' } }, 'outer-layers': { properties: { host: 'mars-parent' } } } } });
mock.module(new URL('../directory/object-directory.mts', import.meta.url).href, { namedExports: { knownAncestors: (...args: unknown[]) => { effects.push(['known-ancestors', ...args]); return [{ id: 'known' }]; }, ancestorIds: (...args: unknown[]) => { effects.push(['ancestor-ids', ...args]); return ancestorResult; } } });
mock.module(new URL('../world/application/context-availability.mts', import.meta.url).href, { namedExports: { CONTEXT_AVAILABILITY: {} } });
mock.module(new URL('../browser/diagnostics-policy.mts', import.meta.url).href, { namedExports: { DIAGNOSTICS_ENABLED: true } });
const { createApplicationWorldContext } = await import('./application-world-context.mts');
const viewport = { read() {}, subscribe() {}, destroy() {} } as unknown as ReturnType<typeof createCameraViewport>;
const frame = {} as PreparedWorldCameraFrame;
const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
function fixture() {
  effects.length = 0; loaded = Promise.resolve(prepared); resourceReady = Promise.resolve(); shellResult = Promise.resolve([]); ancestorResult = Promise.resolve(['outer']);
  const { document, window } = parseHTML('<html><body><section class="object-world-stage"><div class="object-input-surface"></div><div id="stage"></div></section></body></html>');
  const errors: unknown[] = [];
  Object.defineProperty(window, 'reportError', { value: (error: unknown) => errors.push(error), configurable: true });
  const stage = document.getElementById('stage')!;
  return { document, window, stage, errors, context: createApplicationWorldContext() };
}

test('world context rejects missing windows and pre-aborted mounts with the original reason', async () => {
  const f = fixture();
  await assert.rejects(f.context.mount({ stage: f.stage, viewport, windowTarget: null }), /World context requires a window\./);
  const failure = new Error('cancelled by caller');
  await assert.rejects(f.context.mount({ stage: f.stage, viewport, signal: AbortSignal.abort(failure) }), error => error === failure);
});

test('context selections publish known holders immediately, ignore stale asynchronous holders, and retire with the mount', async () => {
  const f = fixture(), request = new AbortController();
  const context = await f.context.mount({ stage: f.stage, viewport, signal: request.signal });
  assert.equal(frameOptions.layer, layer); assert.equal(frameOptions.planner, planner);
  assert.equal('publish' in context, false); assert.equal(context.viewport, viewport);
  assert.ok(effects.some(effect => JSON.stringify(effect) === '["blockers",["sidebar"]]')); assert.ok(Reflect.has(f.window, '__cssEarthUniverse')); assert.equal(frameOptions.heliosphereEnabled(), false); frameOptions.onFrame({ pose: { positionM: [1, 2, 3] } }); assert.deepEqual(effects.at(-1), ['observe', [1, 2, 3]]); startup!(); assert.ok(effects.some(effect => JSON.stringify(effect) === '["approach-start"]'));
  let resolve!: (ids: readonly string[]) => void;
  ancestorResult = new Promise(done => { resolve = done; });
  context.selectObject('earth', frame, 2); context.previewSelection('mars', 3);
  ancestorResult = Promise.resolve(['mars-parent']); context.selectObject('mars', frame); await settle();
  resolve(['stale-earth']); await settle();
  assert.deepEqual(effects.filter(effect => Array.isArray(effect) && ['known-ancestors', 'ancestor-ids'].includes(effect[0])), [['known-ancestors', 'earth'], ['ancestor-ids', 'earth'], ['known-ancestors', 'mars'], ['ancestor-ids', 'mars']]);
  assert.deepEqual(effects.filter(effect => Array.isArray(effect) && effect[0] === 'holders'), [['holders', ['known']], ['holders', ['known']], ['holders', ['mars-parent']]]);
  // A holder whose walls stand around the selected body is not marked; one whose picture is not on walls is.
  assert.deepEqual(effects.filter(effect => Array.isArray(effect) && effect[0] === 'surrounding'), [['surrounding', ['known']], ['surrounding', ['known']], ['surrounding', []]]);
  assert.ok(effects.some(effect => Array.isArray(effect) && effect[0] === 'visibility-select' && effect[1] === 'earth'));
  assert.ok(effects.some(effect => Array.isArray(effect) && effect[0] === 'moon-select' && effect[1] === 'earth'));
  orbitLoaded!(); assert.deepEqual(effects.at(-1), ['refresh']);
  request.abort();
  const count = effects.length; context.previewSelection('earth'); context.selectObject('earth', frame); context.setHeliosphereEnabled(true); startup!();
  assert.equal(effects.length, count);
  for (const owner of ['resources', 'layer', 'planner', 'labels', 'frames']) assert.ok(effects.some(effect => JSON.stringify(effect) === `["${owner}-destroy"]`), owner);
});

test('heliosphere shells load only on first enable, refresh on transitions, and report failed loading', async () => {
  const f = fixture(), context = await f.context.mount({ stage: f.stage, viewport });
  effects.length = 0; shellResult = Promise.resolve(['shell-a', 'shell-b']);
  context.setHeliosphereEnabled(true); await settle();
  assert.deepEqual(effects.filter(effect => Array.isArray(effect) && effect[0] === 'shell'), [['shell', 'shell-a'], ['shell', 'shell-b']]);
  assert.deepEqual(effects, [['refresh'], ['shell', 'shell-a'], ['shell', 'shell-b'], ['refresh']]);
  const count = effects.length; context.setHeliosphereEnabled(true); assert.equal(effects.length, count);
  context.setHeliosphereEnabled(false); context.setHeliosphereEnabled(true); await settle();
  assert.equal(effects.filter(effect => Array.isArray(effect) && effect[0] === 'shell').length, 2); context.destroy();
  const failed = fixture(), other = await failed.context.mount({ stage: failed.stage, viewport });
  const error = new Error('shell unavailable'); shellResult = Promise.reject(error); other.setHeliosphereEnabled(true); await settle();
  assert.deepEqual(failed.errors, [error]); other.destroy();
});

test('cancellation while data is pending prevents mounting and rejection of resources disposes them', async () => {
  const f = fixture(), request = new AbortController(); let resolve!: (value: unknown) => void;
  loaded = new Promise(done => { resolve = done; });
  const mounting = f.context.mount({ stage: f.stage, viewport, signal: request.signal }); request.abort(); resolve(prepared);
  await assert.rejects(mounting, { name: 'AbortError' }); assert.deepEqual(effects, []);
  const failed = fixture(), error = new Error('decode failed'); resourceReady = Promise.reject(error);
  await assert.rejects(failed.context.mount({ stage: failed.stage, viewport }), failure => failure === error);
  assert.deepEqual(effects, [['resources-destroy']]);
});

test('rotation and coasting events read only true booleans; disposed shell loads publish nothing', async () => {
  const f = fixture(), previous = globalThis.CustomEvent;
  globalThis.CustomEvent = f.window.CustomEvent as typeof CustomEvent;
  try {
    const context = await f.context.mount({ stage: f.stage, viewport });
    const surface = f.document.querySelector('.object-input-surface')!;
    surface.dispatchEvent(new f.window.CustomEvent('objectrotationchange', { detail: { active: true } }));
    assert.deepEqual(effects.at(-1), ['rotation', true]);
    surface.dispatchEvent(new f.window.CustomEvent('objectmotionchange', { detail: { coasting: true } }));
    assert.deepEqual(effects.at(-1), ['coasting', true]);
    surface.dispatchEvent(new f.window.CustomEvent('objectmotionchange', { detail: null }));
    assert.deepEqual(effects.at(-1), ['coasting', false]);
    let resolve!: (shells: unknown[]) => void; shellResult = new Promise(done => { resolve = done; });
    context.setHeliosphereEnabled(true); assert.equal(frameOptions.heliosphereEnabled(), true);
    context.destroy(); resolve(['late']); await settle();
    assert.ok(!effects.some(effect => Array.isArray(effect) && effect[0] === 'shell'));
    assert.equal(Reflect.has(f.window, '__cssEarthUniverse'), false);
    const count = effects.length; surface.dispatchEvent(new f.window.CustomEvent('objectrotationchange', { detail: { active: true } })); assert.equal(effects.length, count);
  } finally { globalThis.CustomEvent = previous; }
});

test('a stage without a world wrapper carries diagnostics without a separate geometry snapshot', async () => {
  const f = fixture(); f.document.body.append(f.stage);
  const context = await f.context.mount({ stage: f.stage, viewport });
  const diagnostics: unknown = Reflect.get(f.window, '__cssEarthUniverse'); assert.ok(diagnostics && typeof diagnostics === 'object'); assert.equal('geometry' in diagnostics, false);
  Reflect.set(f.window, '__cssEarthUniverse', 'new owner'); context.destroy(); assert.equal(Reflect.get(f.window, '__cssEarthUniverse'), 'new owner');
});
