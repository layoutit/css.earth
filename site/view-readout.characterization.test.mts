import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { createViewReadout } from './view-readout.mts';
import type { BrowserWindow, ShellCamera } from './browser/browser-types.mts';
import { navigationFixture, unusedSharedView } from './test/navigation-test-values.mts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { WorldCameraPose } from '@cssearth/engine';

function fixture() {
  const { document, window } = parseHTML('<html><body><aside></aside><div class="polycss-scene"></div><footer class="object-view-readout"><div class="object-view-date"><span data-view-date></span></div><div class="object-view-coordinates"><span data-view-latitude></span><span data-view-longitude></span></div><div class="object-view-altitude"><span data-view-distance-label></span><span data-view-altitude></span></div><div class="object-view-scale"><span data-view-scale-label></span><i class="object-view-ruler"></i><i class="object-view-measure"></i></div></footer></body></html>');
  let now = 0, next = 0, hidden = false;
  const frames = new Map<number, FrameRequestCallback>(), timers = new Map<number, { callback: () => void; wait: number }>();
  Object.defineProperty(document, 'hidden', { get: () => hidden });
  const target = { performance: { now: () => now }, addEventListener: window.addEventListener.bind(window),
    requestAnimationFrame: (callback: FrameRequestCallback) => { const id = ++next; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
    setTimeout: (callback: () => void, wait: number) => { const id = ++next; timers.set(id, { callback, wait }); return id; },
    clearTimeout: (id: number) => { timers.delete(id); } } as unknown as BrowserWindow;
  const drawer = document.querySelector<HTMLElement>('aside')!;
  const element = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  let world: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5,
    pose: { positionM: [0, 0, 3e6], orientationXyzw: [0, 0, 0, 1] } };
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0],
    presentationToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1e6 } as const;
  let notify = () => {}, unsubscribed = 0;
  const navigation = { ...navigationFixture(frame, () => world, () => ({ focalPixels: 1000, principalOffsetPixels: [0, 0], framingRadiusPixels: 200, detailHandoffDiameterPixels: 14, visibleRect: { left: -500, right: 500, top: -500, bottom: 500 } })),
    subscribe(callback: Parameters<ObjectWorldNavigation['subscribe']>[0]) { notify = () => callback(world, navigation.optics()); return () => { unsubscribed++; }; } };
  const camera: ShellCamera = { navigation, sharedView: unusedSharedView };
  const readout = createViewReadout({ drawer, documentTarget: document, windowTarget: target });
  const paint = () => { now += 100; const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(now); };
  return { document, window, drawer, readout, camera, element, frames, timers, paint, notify: () => notify(), unsubscribed: () => unsubscribed,
    hide(value: boolean) { hidden = value; document.dispatchEvent(new window.Event('visibilitychange')); },
    world(value: WorldCameraPose) { world = value; }, getWorld: () => world };
}

test('body readings, overview distance, focus distance and absent cameras update the retained footer', () => {
  const f = fixture(); f.readout.setCamera(f.camera); f.paint();
  assert.equal(f.element('[data-view-date]').textContent, '2026-09-03 00:00 TT');
  assert.equal(f.element('[data-view-altitude]').textContent, '2,000 km');
  assert.equal(f.element('[data-view-distance-label]').textContent, 'Altitude:');
  assert.equal(f.element('.object-view-scale').hidden, false);
  assert.equal(f.element('.object-view-ruler').style.width, '80px');
  f.readout.setOverviewScope('milky-way'); f.paint();
  assert.equal(f.element('[data-view-distance-label]').textContent, 'Distance from Sun:');
  f.readout.setExtendedSubject({ name: 'Focus', positionM: [0, 0, 0] }); f.paint();
  assert.equal(f.element('[data-view-distance-label]').textContent, 'Distance to Focus:');
  assert.equal(f.element('.object-view-coordinates').hidden, true);
  assert.equal(f.element('.object-view-scale').title, 'Scale at the distance of Focus. Distance is measured from the left edge to the moving tick.');
  f.world({ ...f.getWorld(), epochJdTt: NaN }); f.readout.setExtendedSubject(null); f.paint();
  assert.equal(f.element('.object-view-date').hidden, true);
  f.readout.setCamera(null); f.paint();
  assert.equal(f.element('[data-view-altitude]').textContent, '—');
  assert.equal(f.element('.object-view-scale').hidden, true);
  assert.equal(f.unsubscribed(), 1);
  f.readout.destroy();
});

test('flight, visibility and playback gates cancel frames and throttled timers and resume only when allowed', () => {
  const f = fixture(); f.readout.setCamera(f.camera); f.paint();
  f.notify(); assert.equal(f.timers.size, 1); assert.equal([...f.timers.values()][0]!.wait, 100);
  f.readout.setNavigationInFlight(true); assert.equal(f.timers.size, 0);
  assert.equal(f.element('[data-view-altitude]').textContent, '—');
  assert.equal(f.element('.object-view-date').hidden, false, 'departure preserves the date');
  f.notify(); assert.equal(f.frames.size + f.timers.size, 0);
  f.readout.setNavigationInFlight(true); f.readout.setNavigationInFlight(false); assert.equal(f.frames.size, 1);
  f.hide(true); assert.equal(f.frames.size, 0); f.notify(); assert.equal(f.timers.size, 0);
  f.hide(false); f.paint();
  f.readout.setPlaybackState({ allowed: true, reason: 'play' }); f.paint(); assert.equal(f.timers.size, 1);
  const timer = [...f.timers.values()][0]!; f.timers.clear(); timer.callback(); assert.equal(f.frames.size, 1);
  f.readout.setPlaybackState({ allowed: false, reason: 'paused' }); f.paint(); assert.equal(f.timers.size, 0);
  f.notify(); assert.equal(f.timers.size, 1);
  f.readout.setPlaybackState({ allowed: false, reason: 'new reason' }); assert.equal(f.timers.size, 0); assert.equal(f.frames.size, 1);
  f.readout.destroy(); assert.equal(f.frames.size + f.timers.size, 0); assert.equal(f.unsubscribed(), 1);
  f.readout.setOverviewScope(null); assert.equal(f.frames.size, 0);
});

test('rebinding maps parses replacement config and uses geographic axes; looking away hides the ruler', () => {
  const f = fixture();
  const config = JSON.stringify({ surfaceSelector: '.surface', prime: [0, 0, 1], east: [1, 0, 0], north: [0, 1, 0], mapLeftEdgeLongitudeDeg: 179 });
  const map = f.document.createElement('div'); map.dataset.surfaceMinimap = config;
  f.drawer.append(map); f.readout.bindObject(); assert.equal(f.frames.size, 1); f.paint();
  f.readout.bindObject(); assert.equal(f.frames.size, 0);
  const axes = { prime: [0, 0, 1], east: [1, 0, 0], north: [0, 1, 0] } as const;
  f.readout.destroy();
  const reader = { read: () => ({ axes, mapLeftEdgeLongitudeDeg: 179 }) };
  const readout = createViewReadout({ drawer: f.drawer, documentTarget: f.document,
    windowTarget: { performance: { now: () => 0 }, addEventListener() {}, requestAnimationFrame(callback: FrameRequestCallback) { f.frames.set(1, callback); return 1; }, cancelAnimationFrame() {} } as unknown as BrowserWindow,
    surfaceReader: reader as unknown as NonNullable<Parameters<typeof createViewReadout>[0]['surfaceReader']> });
  readout.setCamera(f.camera); f.paint();
  assert.equal(f.element('[data-view-latitude]').textContent, '0°00′00.00″ N');
  assert.equal(f.element('[data-view-longitude]').textContent, '179°00′00.00″ E');
  assert.equal(f.element('.object-view-coordinates').hidden, false);
  f.world({ ...f.getWorld(), pose: { ...f.getWorld().pose, orientationXyzw: [0, 1, 0, 0] } });
  readout.setOverviewScope(null); f.paint();
  assert.equal(f.element('.object-view-coordinates').hidden, true);
  assert.equal(f.element('.object-view-scale').hidden, true);
  readout.destroy();
});

test('a shell without a footer returns an inert controller, and an incomplete footer fails explicitly', () => {
  const f = fixture(); f.readout.destroy(); f.element('.object-view-readout').remove();
  const inert = createViewReadout({ drawer: f.drawer, documentTarget: f.document, windowTarget: f.window as unknown as BrowserWindow });
  assert.doesNotThrow(() => { inert.bindObject(); inert.setCamera(null); inert.setOverviewScope(null); inert.setExtendedSubject(null); inert.setPlaybackState({ allowed: false, reason: '' }); inert.setNavigationInFlight(true); inert.destroy(); });
  f.drawer.innerHTML = '<div class="object-view-readout"></div>';
  assert.throws(() => createViewReadout({ drawer: f.drawer, documentTarget: f.document, windowTarget: f.window as unknown as BrowserWindow }), /Missing shell element: \.object-view-date\./);
});

test('motion holds the old reading and refreshes exactly when the camera stops', () => {
  const f = fixture(), previous = globalThis.CustomEvent;
  globalThis.CustomEvent = f.window.CustomEvent as typeof CustomEvent;
  try {
    f.readout.setCamera(f.camera); f.paint();
    f.document.dispatchEvent(new f.window.CustomEvent('objectmotionchange', { detail: { active: true } }));
    f.world({ ...f.getWorld(), pose: { ...f.getWorld().pose, positionM: [0, 0, 5e6] } });
    f.notify(); f.readout.setOverviewScope(null); assert.equal(f.frames.size + f.timers.size, 0);
    assert.equal(f.element('[data-view-altitude]').textContent, '2,000 km');
    f.document.dispatchEvent(new f.window.CustomEvent('objectmotionchange', { detail: { active: true } }));
    assert.equal(f.frames.size, 0);
    f.document.dispatchEvent(new f.window.CustomEvent('objectmotionchange', { detail: null })); f.paint();
    assert.equal(f.element('[data-view-altitude]').textContent, '4,000 km'); f.readout.destroy();
  } finally { globalThis.CustomEvent = previous; }
});

test('calendar cache changes at midnight TT and repeated idle motion events do not schedule a reading', () => {
  const f = fixture(), previous = globalThis.CustomEvent;
  globalThis.CustomEvent = f.window.CustomEvent as typeof CustomEvent;
  try {
    f.world({ ...f.getWorld(), epochJdTt: 2461286.49 }); f.readout.setCamera(f.camera); f.paint();
    assert.equal(f.element('[data-view-date]').textContent, '2026-09-02 23:45 TT');
    f.world({ ...f.getWorld(), epochJdTt: 2461286.51 }); f.readout.setOverviewScope(null); f.paint();
    assert.equal(f.element('[data-view-date]').textContent, '2026-09-03 00:14 TT');
    f.world({ ...f.getWorld(), epochJdTt: 2461286.6 }); f.readout.setOverviewScope(null); f.paint();
    assert.equal(f.element('[data-view-date]').textContent, '2026-09-03 00:14 TT', 'time is cached for the rounded calendar day');
    f.document.dispatchEvent(new f.window.CustomEvent('objectmotionchange', { detail: { active: false } }));
    assert.equal(f.frames.size + f.timers.size, 0, 'an idle-to-idle event does not reread the camera');
    f.readout.destroy();
  } finally { globalThis.CustomEvent = previous; }
});

test('removing a valid camera hides its previously visible date', () => {
  const f = fixture(); f.readout.setCamera(f.camera); f.paint();
  assert.equal(f.element('.object-view-date').hidden, false);
  f.readout.setCamera(null); f.paint();
  assert.equal(f.element('.object-view-date').hidden, true); f.readout.destroy();
});

test('the moving ruler tick preserves hundredths of a pixel', () => {
  const f = fixture();
  f.world({ ...f.getWorld(), pose: { ...f.getWorld().pose, positionM: [0, 0, 3123456] } });
  f.readout.setCamera(f.camera); f.paint();
  assert.equal(f.element('.object-view-ruler').style.width, '80px');
  assert.equal(f.element('.object-view-measure').style.width, '47.09px');
  f.readout.destroy();
});
