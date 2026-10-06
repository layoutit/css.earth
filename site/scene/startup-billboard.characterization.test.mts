import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { parseHTML } from 'linkedom';
import { parseSharedView } from '@cssearth/renderer/navigation';
import type { SceneFactory } from '../browser/browser-types.mts';
import type { CameraViewport } from '@cssearth/renderer/navigation/camera-viewport.ts';

const calls: unknown[][] = [];
let coverAvailable = true, prepareFails = false, initialFails = false;
const cover = { publish(...args: unknown[]) { calls.push(['publish', ...args]); } };
const handoff = { mountOptions: { arriving: true } };
mock.module(new URL('../navigation/arrival-billboard.mts', import.meta.url).href, { namedExports: { async prepareArrivalBillboard(...args: unknown[]) { calls.push(['cover', ...args]); return coverAvailable ? cover : null; } } });
mock.module(new URL('../navigation/prepared-arrival.mts', import.meta.url).href, { namedExports: {
  createPreparedArrival(signal: AbortSignal, value: unknown, reveal: () => void, input: unknown) {
    calls.push(['arrival', signal, value, input]);
    return {
      async prepare(...args: unknown[]) { calls.push(['prepare', ...args]); if (prepareFails) throw new Error('prepare rejected'); reveal(); },
      handoff(view: () => unknown, options: unknown, hooks: unknown, activation: string) { calls.push(['handoff', view(), activation, options, hooks]); return handoff; },
      dispose() { calls.push(['dispose']); },
    };
  },
} });
mock.module('@cssearth/renderer/rendering/startup-gate.ts', { namedExports: { releaseStartup(window: unknown) { calls.push(['release', window]); } } });
const { prepareStartupBillboard } = await import('./startup-billboard.mts');
const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const discovery = { featured: true, imagery: true, illustration: false,
  arrival: { defaultDataset: 'surface', datasetIds: ['surface'], rotation,
    billboard: { url: '/scenes/earth/arrival.webp', size: 1024, distanceM: 10, focalPixels: 900, dataset: 'surface', rotation } } };
const saved = 'UcO-LVLcltOqqz4XrhR64UeuwOjqIxJul5dBQsczQAAAAEAFN-vvz-Gxv9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAA';
function mount(metadata: unknown = discovery) {
  calls.length = 0; coverAvailable = true; prepareFails = initialFails = false;
  const { document, window } = parseHTML(`<html><body><div class="stage"></div><div class="object-input-surface"></div>
    <img data-startup-billboard><span class="startup-loading"></span><div class="explorer-navigation-progress" aria-hidden="true"></div>
    ${metadata === null ? '' : '<script data-startup-discovery></script>'}</body></html>`);
  const stage = document.querySelector<HTMLElement>('.stage')!;
  const script = document.querySelector('script');
  if (script) script.textContent = JSON.stringify(metadata);
  const marks: string[] = [];
  Object.assign(window, { matchMedia: () => ({ matches: true }), performance: {
    mark(name: string) { marks.push(name); }, getEntriesByName: (name: string) => marks.filter(value => value === name),
  } });
  const view = { world: { object: 'earth' }, viewport: { widthPixels: 390 } };
  const factory = Object.assign(() => { throw new Error('No mount in this test.'); }, { navigation: {
    frame: {}, async initialView(...args: unknown[]) { calls.push(['initial', ...args]); if (initialFails) throw new Error('initial rejected'); return view; },
  } }) as unknown as SceneFactory;
  const viewport = { read: () => ({}), subscribe: () => () => {}, destroy() {} } as unknown as CameraViewport;
  return { document, stage, factory, viewport, marks, view, window };
}

test('default startup publishes the cover before preparation and hands off whole activation', async () => {
  const f = mount(), abort = new AbortController();
  const result = await prepareStartupBillboard(f.stage, f.factory, f.viewport, 'https://css.earth/earth/', 'earth', abort.signal,
    () => { calls.push(['onCover']); assert.equal(f.document.querySelector('.startup-loading') === null, true); });
  assert.equal(result, handoff);
  const arrivalCall = calls.find(call => call[0] === 'arrival');
  assert.equal(arrivalCall?.[1], abort.signal);
  assert.equal(arrivalCall?.[2], cover);
  assert.equal(arrivalCall?.[3] === f.document.querySelector('.object-input-surface'), true);
  assert.deepEqual(calls.filter(call => call[0] === 'release'), [['release', f.window]]);
  assert.ok(calls.findIndex(call => call[0] === 'release') > calls.findIndex(call => call[0] === 'prepare'));
  assert.ok(calls.findIndex(call => call[0] === 'release') < calls.findIndex(call => call[0] === 'handoff'));
  assert.deepEqual(calls[0], ['initial', f.viewport, true, { rotation, distanceM: 10 }, abort.signal]);
  assert.deepEqual(calls.find(call => call[0] === 'publish'), ['publish', f.view.world, f.view.viewport]);
  assert.equal(calls.findIndex(call => call[0] === 'onCover') < calls.findIndex(call => call[0] === 'prepare'), true);
  assert.deepEqual(calls.at(-1), ['handoff', f.view, 'whole', {}, {}]);
  assert.deepEqual(f.marks, ['cssearth:startup-billboard', 'cssearth:startup-detail-ready']);
  assert.equal(f.document.querySelector('.explorer-navigation-progress')?.getAttribute('aria-hidden'), 'false');
  assert.ok(f.document.querySelector('img'));
});

test('saved and unavailable covers remove the photograph and pace detail activation', async () => {
  for (const custom of [true, false]) {
    const f = mount();
    coverAvailable = false;
    const result = await prepareStartupBillboard(f.stage, f.factory, f.viewport, `https://css.earth/earth/${custom ? `?v=${saved}` : ''}`, 'earth', new AbortController().signal);
    assert.equal(result, handoff);
    assert.equal(f.document.querySelector('img') === null, true);
    assert.deepEqual(calls.at(-1), ['handoff', f.view, 'paced', {}, {}]);
    assert.equal(f.document.querySelector('.explorer-navigation-progress')?.getAttribute('aria-hidden'), 'true');
    assert.equal(calls.some(call => call[0] === 'cover'), !custom);
    assert.equal('saved' in (calls[0]![3] as object), custom);
  }
});

test('unsupported starts remove the image without preparing a scene', async () => {
  for (const mode of ['custom', 'missing-navigation', 'missing-metadata', 'missing-image', 'missing-billboard']) {
    const metadata = mode === 'missing-metadata' ? null : mode === 'missing-billboard'
      ? { ...discovery, arrival: { defaultDataset: 'surface', datasetIds: ['surface'], rotation } } : discovery;
    const f = mount(metadata);
    if (mode === 'missing-navigation') f.factory.navigation = null;
    if (mode === 'missing-image') f.document.querySelector('img')!.remove();
    const result = await prepareStartupBillboard(f.stage, f.factory, f.viewport, `https://css.earth/earth/${mode === 'custom' ? '?dataset=x' : ''}`, 'earth', new AbortController().signal);
    assert.equal(result, null, mode);
    assert.equal(f.document.querySelector('img') === null, true, mode);
    assert.deepEqual(calls, [], mode);
  }
});

test('initial and detail failures propagate and remove loaders, disposing only an acquired arrival', async () => {
  for (const initial of [true, false]) {
    const f = mount();
    initialFails = initial; prepareFails = !initial;
    await assert.rejects(prepareStartupBillboard(f.stage, f.factory, f.viewport, 'https://css.earth/earth/', 'earth', new AbortController().signal), initial ? /initial rejected/ : /prepare rejected/);
    assert.equal(f.document.querySelector('.startup-loading') === null, true);
    assert.equal(calls.some(call => call[0] === 'dispose'), !initial);
  }
});

test('abort removes the pending loader and existing startup marks are not duplicated', async () => {
  const f = mount();
  f.marks.push('cssearth:startup-billboard');
  const abort = new AbortController();
  coverAvailable = false;
  await prepareStartupBillboard(f.stage, f.factory, f.viewport, 'https://css.earth/earth/', 'earth', abort.signal,
    () => { abort.abort(); assert.equal(f.document.querySelector('.startup-loading') === null, true); });
  assert.deepEqual(f.marks, ['cssearth:startup-billboard', 'cssearth:startup-detail-ready']);
});


test('prepared saved camera wins over a different query camera in initial-view arguments', async () => {
  const f = mount(), abort = new AbortController();
  const query = 'UcM-I2wcRENV2b3fvnbItDlXwOej1wo9cZ5BQsczQAAAAEAFN-vvz-Gyv9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAA';
  const prepared = parseSharedView(`v=${saved}`);
  assert.ok(prepared);
  assert.notDeepEqual(prepared, parseSharedView(`v=${query}`));
  f.stage.dataset.preparedView = saved;
  await prepareStartupBillboard(f.stage, f.factory, f.viewport, `https://css.earth/earth/?v=${query}`, 'earth', abort.signal);
  assert.deepEqual(calls[0], ['initial', f.viewport, true, { saved: prepared }, abort.signal]);
  assert.deepEqual(calls.find(call => call[0] === 'arrival')?.slice(1, 3), [abort.signal, null]);
});
