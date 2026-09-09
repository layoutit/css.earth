import assert from 'node:assert/strict';
import test from 'node:test';
import { createSceneRouter } from '../scene-router.mjs';
import { formatSharedView } from '../../src/renderers/css/dist/index.js';

const flush = () => new Promise(setImmediate);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const saved = distance => ({ camera: { distanceKilometers: distance,
  pose: { schema: 'cssearth-camera-pose@2', scene: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' } },
  playback: { times: [1234], speed: 1, motionRequested: false } });
function harness({ prepare = async () => ({}), focus = undefined, centerTarget = undefined, factoryGate = null, contentGate = null, persistentWorldContext = null, withSun = false } = {}) {
  const documentTarget = new EventTarget(), windowTarget = new EventTarget(), media = new EventTarget();
  documentTarget.hidden = false; documentTarget.documentElement = { dataset: {} };
  documentTarget.body = { classList: { add() {}, remove() {} } };
  media.matches = false; windowTarget.matchMedia = () => media;
  windowTarget.setTimeout = setTimeout; windowTarget.clearTimeout = clearTimeout;
  let location = new URL('https://example.test/mercury/?campaign=test#vault'), index = 0;
  const entries = [{ state: { campaign: 'preserved' }, url: location.href }], writes = [];
  Object.defineProperty(windowTarget, 'location', { get: () => location });
  windowTarget.history = {
    get state() { return entries[index].state; },
    replaceState(state, _, url) { location = new URL(url, location); entries[index] = { state, url: location.href }; writes.push('replace'); },
    pushState(state, _, url) { location = new URL(url, location); entries.splice(++index); entries.push({ state, url: location.href }); writes.push('push'); },
    back() { if (index) { const entry = entries[--index]; location = new URL(entry.url); const event = new Event('popstate'); event.state = entry.state; windowTarget.dispatchEvent(event); } },
  };
  const objects = ['mercury', 'venus', 'earth'].map(id => ({ id, name: id, route: `/${id}/` }));
  if (withSun) objects.push({ id: 'sun', name: 'Sun', route: '/sun/', classification: 'star', distanceAu: 0 });
  const stage = { dataset: { objectId: 'mercury' } }, input = {}, renders = new Set(), mounts = [], errors = [], shells = [], preparations = [], disposedContent = [];
  let maxRendered = 0;
  const factory = id => (nativeStage, options) => {
    assert.equal(nativeStage, stage);
    const listeners = new Set(), mount = { id, options, value: saved(id === 'mercury' ? 10000 : 20000), calls: [], restores: 0,
      ready: Promise.resolve(),
      pause() { this.calls.push('pause'); }, resume() { this.calls.push('resume'); },
      destroy() { this.calls.push('destroy'); renders.delete(this); },
    };
    mount.sharedView = {
      capture: () => mount.value,
      async restore(value) { mount.restores++; mount.value = value; return true; },
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    };
    if (persistentWorldContext) {
      mount.navigation = {
        frame: { id },
        capture: () => ({ id }),
        apply() {},
        optics: () => ({ focalPixels: 1, principalOffsetPixels: [0, 0], framingRadiusPixels: 1, detailHandoffDiameterPixels: 1 }),
        subscribe(listener) {
          const world = { referenceFrame: 'test', epochJdTt: 1, pose: { id } };
          const viewport = { focalPixels: 10, principalOffsetPixels: [id === 'mercury' ? 1 : 2, 0] };
          listeners.add(listener); listener(world, viewport);
          return () => listeners.delete(listener);
        },
      };
    }
    mounts.push(mount); renders.add(mount); maxRendered = Math.max(maxRendered, renders.size);
    assert.equal(renders.size, 1, 'At most one detailed scene may render');
    return mount;
  };
  const router = createSceneRouter({ stage, objectId: 'mercury', objects, documentTarget, windowTarget,
    reportError: error => errors.push(error),
    mountShell(options) {
      const shell = { input, options, destroyed: 0, selected: 'mercury',
        setPlaybackState(value) { this.playback = value; },
        setMotionEnabled(value) { options.onMotionChange(value); },
        setObject(content) { assert.equal(renders.size, 0); content.apply(); this.selected = content.id; },
        destroy() { this.destroyed++; },
      };
      shells.push(shell); return shell;
    },
    async loadObject(id) { if (id === 'venus' && factoryGate) await factoryGate.promise; return factory(id); },
    async loadContent(object, { signal }) {
      if (object.id === 'venus' && contentGate) await contentGate.promise;
      return { id: object.id, apply() { assert.equal(signal.aborted, false); }, dispose() { disposedContent.push(object.id); } };
    },
    navigation: {
      focus, centerTarget,
      supports: (from, to) => from !== 'earth' && to !== 'earth',
      prepare(options) { preparations.push(options); return prepare(options); },
    },
    persistentWorldContext,
  });
  return { router, windowTarget, documentTarget, media, mounts, shells, renders, errors, writes, entries, preparations, disposedContent,
    maxRendered: () => maxRendered };
}

test('persistent world context is mounted once and follows the active physical navigation', async () => {
  const events = [], owner = {
    async mount() {
      events.push(['mount']);
      return {
        selectObject(id, frame) { events.push(['select', id, frame.id]); },
        publish(world, viewport) { events.push(['publish', world.pose.id, viewport.principalOffsetPixels[0]]); },
        destroy() { events.push(['destroy']); },
      };
    },
  };
  const h = harness({ persistentWorldContext: owner });
  await h.router.settled;
  assert.deepEqual(events, [['mount'], ['select', 'mercury', 'mercury'], ['publish', 'mercury', 1]]);
  await h.router.navigate('venus');
  assert.deepEqual(events, [
    ['mount'], ['select', 'mercury', 'mercury'], ['publish', 'mercury', 1],
    ['select', 'venus', 'venus'], ['publish', 'venus', 2],
  ]);
  h.router.destroy();
  assert.deepEqual(events.at(-1), ['destroy']);
});

test('contrast intent reaches a loading world once and survives detail navigation', async () => {
  const gate = deferred(), changes = [];
  const h = harness({ persistentWorldContext: { async mount() {
    await gate.promise;
    return { selectObject() {}, publish() {}, destroy() {}, setHighContrastSky(value) { changes.push(value); } };
  } } });
  h.shells[0].options.onSkyContrastChange(true);
  gate.resolve(); await h.router.settled;
  assert.deepEqual(changes, [true]);
  await h.router.navigate('venus');
  assert.deepEqual(changes, [true]);
  h.shells[0].options.onSkyContrastChange(false);
  assert.deepEqual(changes, [true, false]);
  h.router.destroy(); h.shells[0].options.onSkyContrastChange(true);
  assert.deepEqual(changes, [true, false]);
  assert.deepEqual(h.errors, []);
});

test('flight overlays follow the pending request through success and failure, while recentering keeps them visible', async () => {
  let visible = true, flight = deferred();
  const h = harness({ prepare: () => flight.promise, persistentWorldContext: { async mount() {
    return { selectObject() {}, publish() {}, destroy() {},
      setNavigationIndicatorsVisible(value) { visible = value; } };
  } } });
  await h.router.settled;
  const selected = h.router.navigate('venus'); await flush();
  assert.equal(visible, false);
  flight.resolve({}); assert.equal(await selected, true);
  assert.equal(visible, true);
  flight = deferred();
  const failed = h.router.navigate('mercury'); await flush();
  assert.equal(visible, false);
  flight.reject(new Error('Prepared asset unavailable'));
  assert.equal(await failed, false); assert.equal(visible, true);
  await h.router.navigate('venus', { overview: true, preserveView: true });
  assert.equal(visible, true);
  h.router.destroy();
});

test('asteroid label and orbit settings default off and reach the retained context independently', async () => {
  const labels = [], orbits = [];
  const h = harness({ persistentWorldContext: { async mount() {
    return { selectObject() {}, publish() {}, destroy() {},
      setAsteroidLabelsEnabled: value => labels.push(value),
      setAsteroidOrbitsEnabled: value => orbits.push(value) };
  } } });
  await h.router.settled;
  const settings = h.shells[0].options;
  assert.equal(settings.asteroidLabelsEnabled, false);
  assert.deepEqual(labels, [false]); assert.deepEqual(orbits, [false]);
  settings.onAsteroidLabelsChange(true);
  await h.router.navigate('venus');
  assert.equal(h.shells.length, 1);
  assert.deepEqual(labels, [false, true]); assert.deepEqual(orbits, [false]);
  settings.onAsteroidOrbitsChange(true);
  settings.onAsteroidLabelsChange(false);
  assert.deepEqual(labels, [false, true, false]); assert.deepEqual(orbits, [false, true]);
  h.router.destroy();
  settings.onAsteroidLabelsChange(true);
  assert.deepEqual(labels, [false, true, false]);
});

test('entering overview on the current object changes selection without invoking focus or restoring the camera', async () => {
  let focuses = 0;
  const h = harness({ focus: async () => { focuses++; } });
  await h.router.settled;
  const source = h.mounts[0], initial = source.value, restores = source.restores;
  await h.router.navigate('mercury', { overview: true, preserveView: true, history: 'replace' });
  assert.equal(focuses, 0);
  assert.equal(source.restores, restores);
  assert.equal(source.value, initial);
  assert.equal(h.mounts.length, 1);
  assert.equal(h.router.state().selectedObjectId, null);
  assert.equal(new URL(h.windowTarget.location.href).searchParams.get('overview'), 'solar-system');
  h.router.destroy();
});

test('flight retains the source and one shell; target readiness and handoff precede history commit', async () => {
  const flight = deferred(), attached = deferred();
  const h = harness({ prepare: () => flight.promise });
  await h.router.settled;
  h.shells[0].options.onMotionChange(true);
  const selected = h.router.navigate('venus'); await flush();
  assert.equal(h.router.state().selectedObjectId, 'venus', 'Selection changes before the destination is mounted');
  assert.equal(h.router.state().activeObjectId, 'mercury', 'The source still owns the departing camera');
  assert.equal(h.router.state().ready, false, 'A pending selection is not a completed navigation');
  assert.equal(h.renders.size, 1); assert.equal(h.mounts[0].id, 'mercury');
  assert.equal(h.shells.length, 1); assert.equal(h.writes.includes('push'), false);
  assert.equal(h.preparations[0].fromMount, h.mounts[0]);
  assert.equal(typeof await h.preparations[0].toFactory, 'function');
  flight.resolve({ mountOptions: { proof: 'handoff' }, afterMount: () => attached.promise }); await flush();
  assert.deepEqual(h.mounts.map(m => m.id), ['mercury', 'venus']);
  assert.equal(h.mounts[1].options.proof, 'handoff');
  assert.equal(h.mounts[0].calls.at(-1), 'destroy');
  assert.equal(h.router.state().ready, false); assert.equal(h.writes.includes('push'), false);
  assert.equal(h.documentTarget.documentElement.dataset.scenePresented, 'true', 'Incoming readiness cannot hide an already presented world');
  attached.resolve(); assert.equal(await selected, true);
  assert.equal(h.preparations[0].signal.aborted, false, 'Successful handoff is not cancellation');
  assert.equal(h.router.state().activeObjectId, 'venus');
  assert.equal(h.windowTarget.location.pathname, '/venus/');
  assert.equal(h.windowTarget.location.searchParams.get('campaign'), 'test');
  assert.equal(h.windowTarget.location.hash, '#vault');
  assert.equal(h.maxRendered(), 1); assert.equal(h.shells.length, 1);
  assert.equal(h.shells[0].destroyed, 0);
  h.router.destroy(); assert.equal(h.shells[0].destroyed, 1);
});

test('rapid Mercury → Venus → Mercury cancels the stale factory without replacing shell or source', async () => {
  const gate = deferred(), h = harness({ factoryGate: gate });
  await h.router.settled;
  const first = h.router.navigate('venus'); await flush();
  assert.equal(await h.router.navigate('mercury'), true);
  assert.equal(await first, false);
  assert.deepEqual(h.disposedContent, ['venus'], 'Cancelled loading releases content without waiting for the factory');
  gate.resolve(); await flush();
  assert.deepEqual(h.disposedContent, ['venus'], 'Late factory completion cannot dispose content twice');
  assert.deepEqual(h.mounts.map(m => m.id), ['mercury']);
  assert.equal(h.shells.length, 1); assert.equal(h.renders.size, 1);
  assert.equal(h.writes.includes('push'), false); assert.deepEqual(h.errors, []);
  h.router.destroy();
});

test('history back restores the departed exact view after target handoff without another push', async () => {
  const h = harness(); await h.router.settled;
  h.mounts[0].value = saved(54321);
  assert.equal(await h.router.navigate('venus'), true);
  h.mounts.at(-1).value = saved(87654);
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(h.router.state().activeObjectId, 'mercury');
  assert.equal(h.mounts.at(-1).value.camera.distanceKilometers, 54321);
  assert.equal(h.windowTarget.location.pathname, '/mercury/');
  assert.equal(h.writes.filter(write => write === 'push').length, 1);
  assert.equal(h.maxRendered(), 1); assert.equal(h.shells.length, 1);
  assert.deepEqual(h.errors, []); h.router.destroy();
});

test('saved-view anchors preserve query and hash across objects and on the already selected object', async () => {
  const h = harness(); await h.router.settled;
  const click = distance => {
    const href = `https://example.test/venus/?campaign=linked&${formatSharedView(saved(distance))}#saved-vault`;
    const event = new Event('click', { cancelable: true }); event.button = 0;
    Object.defineProperty(event, 'target', { value: { closest: () => ({ href, target: '', hasAttribute: () => false }) } });
    h.documentTarget.dispatchEvent(event); assert.equal(event.defaultPrevented, true); return href;
  };
  const first = click(23456); await h.router.settled;
  assert.equal(h.preparations[0].url, first);
  assert.equal(h.mounts.at(-1).value.camera.distanceKilometers, 23456);
  click(65432); await h.router.settled;
  assert.equal(h.mounts.at(-1).value.camera.distanceKilometers, 65432);
  assert.equal(h.mounts.length, 2); assert.equal(h.preparations.length, 1);
  assert.equal(h.windowTarget.location.searchParams.get('campaign'), 'linked');
  assert.equal(h.windowTarget.location.hash, '#saved-vault');
  assert.equal(h.writes.filter(write => write === 'push').length, 2);
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(h.mounts.at(-1).value.camera.distanceKilometers, 23456);
  assert.equal(h.mounts.length, 2); h.router.destroy();
});

test('reselecting the source cancels a running flight at its painted view without another restore or mount', async () => {
  const gate = deferred();
  const h = harness({ prepare: ({ fromMount }) => { fromMount.value = saved(43210); return gate.promise; } });
  await h.router.settled;
  const first = h.router.navigate('venus'); await flush();
  assert.equal(await h.router.navigate('mercury'), true);
  assert.equal(await first, false); gate.resolve({}); await flush();
  assert.equal(h.mounts.length, 1); assert.equal(h.mounts[0].restores, 0);
  assert.equal(h.mounts[0].value.camera.distanceKilometers, 43210);
  assert.equal(h.preparations[0].signal.aborted, true);
  assert.equal(h.writes.filter(write => write === 'push').length, 0);
  assert.deepEqual(h.errors, []); h.router.destroy();
});

test('late rejected handoff is observed after replacement and cannot publish stale readiness', async () => {
  const handoff = deferred();
  const h = harness({ prepare: async ({ toId }) => toId === 'venus' ? { afterMount: () => handoff.promise } : {} });
  await h.router.settled;
  const first = h.router.navigate('venus'); await flush();
  assert.equal(h.mounts.at(-1).id, 'venus');
  assert.equal(await h.router.navigate('mercury'), true);
  assert.equal(await first, false);
  handoff.reject(new Error('retired handoff')); await flush();
  assert.equal(h.router.state().activeObjectId, 'mercury'); assert.equal(h.router.state().ready, true);
  assert.equal(h.renders.size, 1); assert.equal(h.maxRendered(), 1); assert.deepEqual(h.errors, []);
  h.router.destroy();
});

test('navigation preserves requested playback and reduced-motion policy', async () => {
  const h = harness(); await h.router.settled;
  h.shells[0].options.onMotionChange(true); h.media.matches = true; h.media.dispatchEvent(new Event('change'));
  await h.router.navigate('venus');
  assert.deepEqual(h.router.playback(), { motionRequested: true, allowed: false, reason: 'reduced-motion' });
  assert.equal(h.mounts.at(-1).calls.includes('resume'), false);
  h.media.matches = false; h.media.dispatchEvent(new Event('change'));
  assert.equal(h.mounts.at(-1).calls.at(-1), 'resume');
  assert.equal(await h.router.navigate('earth'), false); h.router.destroy();
});

test('real input interruption preserves the last painted source view and flushes it without restoring the old URL', async () => {
  const h = harness({ prepare: async ({ fromMount }) => {
    fromMount.value = saved(123456);
    const error = new Error('User interrupted the flight');
    error.name = 'AbortError'; error.preserveView = true; throw error;
  } });
  await h.router.settled;
  assert.equal(await h.router.navigate('venus'), false);
  assert.equal(h.mounts[0].value.camera.distanceKilometers, 123456);
  assert.equal(h.router.state().activeObjectId, 'mercury');
  assert.equal(h.windowTarget.location.pathname, '/mercury/');
  assert.equal(h.writes.includes('push'), false);
  assert.ok(h.windowTarget.location.searchParams.has('v'));
  assert.deepEqual(h.errors, []); h.router.destroy();
});

test('input after the detailed handoff keeps the incoming scene and its painted pose, including saved-view links', async () => {
  const h = harness({ prepare: async ({ toId }) => toId === 'venus' ? {
    afterMount(mount) {
      mount.value = saved(34567);
      const error = new Error('User interrupted the incoming flight');
      error.name = 'AbortError'; error.preserveView = true; throw error;
    },
  } : {} });
  await h.router.settled;
  h.mounts[0].value = saved(54321);
  const url = `https://example.test/venus/?${formatSharedView(saved(98765))}#linked`;
  assert.equal(await h.router.navigate('venus', { url }), false);
  const incoming = h.mounts.at(-1);
  assert.equal(incoming.value.camera.distanceKilometers, 34567);
  assert.equal(incoming.restores, 0, 'Interruption cannot restore the originally requested arrival camera');
  assert.equal(incoming.calls.includes('destroy'), false);
  assert.equal(h.router.state().activeObjectId, 'venus');
  assert.equal(h.router.state().ready, true);
  assert.equal(h.documentTarget.documentElement.dataset.scenePresented, 'true');
  assert.equal(h.windowTarget.location.pathname, '/venus/');
  assert.equal(h.windowTarget.location.hash, '#linked');
  assert.equal(h.windowTarget.location.searchParams.get('v'), new URLSearchParams(formatSharedView(saved(34567))).get('v'));
  assert.equal(h.writes.filter(write => write === 'push').length, 1);
  assert.equal(h.renders.size, 1); assert.equal(h.maxRendered(), 1);
  h.windowTarget.history.back(); await h.router.settled;
  assert.equal(h.mounts.at(-1).value.camera.distanceKilometers, 54321);
  assert.deepEqual(h.errors, []); h.router.destroy();
});

test('navbar/search anchors and vault events share one route; modifier and unsupported links stay native', async () => {
  const h = harness(); await h.router.settled;
  const supportsLabel = objectId => {
    const event = new Event('objectnavigationquery', { cancelable: true }); event.detail = { objectId };
    h.documentTarget.dispatchEvent(event); return event.defaultPrevented;
  };
  assert.equal(supportsLabel('venus'), true);
  assert.equal(supportsLabel('earth'), false, 'A registered object also needs a supported navigation path');
  assert.equal(supportsLabel('star:123'), false, 'A catalogue name is not a registered destination');
  function click(id, extra = {}) {
    const anchor = { href: `https://example.test/${id}/`, target: '', hasAttribute: () => false, ...extra };
    const event = new Event('click', { cancelable: true });
    Object.assign(event, { button: 0, ctrlKey: extra.ctrlKey === true });
    Object.defineProperty(event, 'target', { value: { closest: () => anchor } });
    h.documentTarget.dispatchEvent(event); return event;
  }
  assert.equal(click('earth').defaultPrevented, false);
  assert.equal(click('venus', { ctrlKey: true }).defaultPrevented, false);
  assert.equal(click('venus', { target: '_blank' }).defaultPrevented, false);
  assert.equal(click('venus').defaultPrevented, true); await h.router.settled;
  const event = new Event('objectnavigate', { cancelable: true }); event.detail = { objectId: 'mercury' };
  h.documentTarget.dispatchEvent(event); await h.router.settled;
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.router.state().activeObjectId, 'mercury'); assert.equal(h.preparations.length, 2);
  h.router.destroy();
  assert.equal(supportsLabel('venus'), false, 'Teardown removes availability handling');
});

test('a failed persistent context mount can retry when the document restores', async () => {
  let attempts = 0, disposed = 0;
  const h = harness({ persistentWorldContext: { async mount() {
    if (++attempts === 1) throw new Error('Temporary context transport failure');
    return { publish() {}, destroy() { disposed++; } };
  } } });
  await h.router.settled;
  assert.equal(h.router.state().ready, false);
  assert.equal(h.errors.length, 1);
  h.windowTarget.dispatchEvent(new Event('pagehide'));
  const restored = new Event('pageshow'); restored.persisted = true;
  h.windowTarget.dispatchEvent(restored);
  await h.router.settled;
  assert.equal(attempts, 2);
  assert.equal(h.router.state().ready, true);
  h.router.destroy(); assert.equal(disposed, 1);
});

test('leaving the document releases its universe and a cached-page restore mounts one fresh owner', async () => {
  let mounted = 0, disposed = 0;
  const h = harness({ persistentWorldContext: { async mount() {
    mounted++; return { publish() {}, destroy() { disposed++; } };
  } } });
  await h.router.settled;
  h.windowTarget.dispatchEvent(new Event('pagehide'));
  assert.equal(disposed, 1);
  const restored = new Event('pageshow'); restored.persisted = true;
  h.windowTarget.dispatchEvent(restored); await h.router.settled;
  assert.equal(mounted, 2); assert.equal(h.router.state().ready, true);
  h.router.destroy(); assert.equal(disposed, 2);
});


test('selecting the current object flies the retained camera without preparing or replacing detail', async () => {
  const gate = deferred(), focuses = [];
  const h = harness({ focus(options) { focuses.push(options); return gate.promise; } });
  await h.router.settled;
  const source = h.mounts[0];
  source.value = saved(1e10);
  const selecting = h.router.navigate('mercury'); await flush();
  assert.equal(focuses.length, 1);
  assert.equal(focuses[0].mount, source);
  assert.equal(h.preparations.length, 0);
  assert.equal(h.router.playback().reason, 'unavailable');
  source.value = saved(10000); gate.resolve();
  assert.equal(await selecting, true);
  assert.equal(h.mounts.length, 1);
  assert.equal(source.restores, 0);
  assert.equal(h.shells.length, 1);
  assert.equal(h.writes.filter(write => write === 'push').length, 0);
  assert.equal(h.windowTarget.location.searchParams.get('v'), new URLSearchParams(formatSharedView(source.value)).get('v'));
  h.router.destroy();
});

test('plain current-object anchors focus but saved-view links restore their specified view', async () => {
  const focuses = [];
  const h = harness({ focus(options) { focuses.push(options); } });
  await h.router.settled;
  await h.router.navigate('mercury', { url: 'https://example.test/mercury/' });
  assert.equal(focuses.length, 1);
  assert.equal(h.mounts[0].restores, 0);
  await h.router.navigate('mercury', { url: `https://example.test/mercury/?${formatSharedView(saved(77777))}` });
  assert.equal(focuses.length, 1);
  assert.equal(h.mounts[0].value.camera.distanceKilometers, 77777);
  assert.equal(h.mounts.length, 1);
  h.router.destroy();
});


test('a coarse selection changes the card and scene at the current scale, then the next click focuses', async () => {
  const centered = { pose: 'centered' }, focuses = [];
  const h = harness({ centerTarget: () => centered, focus: async options => { focuses.push(options); } });
  await h.router.settled;
  assert.equal(await h.router.navigate('venus', { sceneSelection: true }), true);
  assert.equal(h.preparations[0].targetWorldCamera, centered);
  assert.equal(h.router.state().activeObjectId, 'venus');
  assert.equal(h.shells[0].selected, 'venus');
  assert.equal(h.mounts.length, 2);
  assert.equal(focuses.length, 0);
  assert.equal(await h.router.navigate('venus', { sceneSelection: true }), true);
  assert.equal(focuses.length, 1);
  assert.equal(focuses[0].targetWorldCamera, undefined);
  assert.equal(h.mounts.length, 2);
  h.router.destroy();
});

test('a second scene click can zoom while centering the current object is still in progress', async () => {
  const gate = deferred(), focuses = [];
  const h = harness({ centerTarget: () => ({ pose: 'centered' }), focus: options => {
    focuses.push(options); return focuses.length === 1 ? gate.promise : Promise.resolve();
  } });
  await h.router.settled;
  const centering = h.router.navigate('mercury', { sceneSelection: true });
  assert.equal(await h.router.navigate('mercury', { sceneSelection: true }), true);
  assert.equal(focuses[0].signal.aborted, true);
  assert.equal(focuses[1].targetWorldCamera, undefined);
  gate.resolve();
  assert.equal(await centering, false);
  h.router.destroy();
});

test('selection emphasis previews immediately before the next detailed owner is ready', async () => {
  const gate = deferred(), previews = [];
  const h = harness({ factoryGate: gate, persistentWorldContext: { async mount() {
    return { selectObject() {}, publish() {}, destroy() {}, previewSelection: id => previews.push(id) };
  } } });
  await h.router.settled;
  const selecting = h.router.navigate('venus', { sceneSelection: true });
  assert.equal(previews.at(-1), 'venus');
  assert.equal(h.router.state().activeObjectId, 'mercury');
  gate.resolve(); await selecting;
  assert.equal(h.router.state().activeObjectId, 'venus');
  assert.equal(previews.at(-1), undefined);
  h.router.destroy();
});

test('empty-space deselection previews the overview and recenters the Sun through the normal router', async () => {
  const previews = [], centers = [], target = { pose: 'centered-sun' };
  const h = harness({ withSun: true, centerTarget(options) { centers.push(options); return target; },
    persistentWorldContext: { async mount() {
      return { selectObject() {}, publish() {}, destroy() {}, previewSelection: id => previews.push(id) };
    } } });
  await h.router.settled;
  let cardChanged = false;
  h.shells[0].beginOverviewSelection = () => { cardChanged = true; };
  const event = new Event('objectdeselect', { cancelable: true });
  h.documentTarget.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(cardChanged, true);
  assert.equal(previews.at(-1), null);
  assert.equal(centers[0].force, true);
  assert.equal(centers[0].objectId, 'sun');
  await h.router.settled;
  assert.equal(h.router.state().activeObjectId, 'sun');
  assert.equal(h.preparations[0].targetWorldCamera, target);
  assert.equal(h.preparations[0].centerSelection, true);
  assert.equal(h.windowTarget.location.searchParams.get('overview'), 'solar-system');
  h.router.destroy();
});
