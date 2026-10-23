import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createGalaxyStationSelection } from './galaxy-station-selection.js';
import { createGalaxyStationClouds } from './galaxy-station-clouds.js';
import { mountGalaxyStations, type PreparedGalaxyStationScene } from './galaxy-stations.js';
import { createGalaxyStationScene } from './galaxy-station-scene.js';
import type { VolumeCameraPublication } from '../../volume/types.js';
import type { PreparedCloudPatches, PreparedCssSky } from '@cssearth/objects';

const at = (x: number, angle = 0): VolumeCameraPublication => ({
  world: { referenceFrame: 'sun-icrf', epochJdTt: 2451545,
    pose: { positionM: [x, 0, 0], orientationXyzw: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)] } },
  viewport: { focalPixels: 800, widthPixels: 1200, heightPixels: 900, principalOffsetPixels: [0, 0] },
});
const stations = [{ id: 'a', positionM: [0, 0, 0] as const }, { id: 'b', positionM: [100, 0, 0] as const }];
const frame: PreparedCloudPatches['frame'] = { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
  metersPerUnit: 1, boundsUnits: { min: [-200, -200, -200], max: [200, 200, 200] } };

test('station selection is unchanged through a full rotation; lens and image extent cannot change membership', () => {
  const owner = createGalaxyStationSelection(stations, { hysteresisM: 10, fadeMs: 100 });
  const ready = new Set(['a', 'b']);
  const initial = owner.publish(at(49), 0, false, ready);
  for (let degree = 0; degree <= 360; degree++) {
    const publication = at(49, degree * Math.PI / 180);
    assert.deepEqual(owner.publish({ ...publication, viewport: { ...publication.viewport, focalPixels: degree + 1, widthPixels: 20 } }, degree + 1, false, ready), initial);
  }
});
test('position hysteresis, decode readiness and coast hold the previous complete station', () => {
  const owner = createGalaxyStationSelection(stations, { hysteresisM: 10, fadeMs: 100 });
  assert.deepEqual(owner.publish(at(0), 0, false, new Set(['a'])).residentIds, ['a']);
  assert.equal(owner.publish(at(54), 10, false, new Set(['a', 'b'])).requestedId, 'a');
  assert.deepEqual(owner.publish(at(90), 20, false, new Set(['a'])).residentIds, ['a']);
  assert.deepEqual(owner.publish(at(90), 30, true, new Set(['a', 'b'])).residentIds, ['a']);
  assert.deepEqual(owner.publish(at(90), 40, false, new Set(['a', 'b'])).residentIds, ['a', 'b']);
  assert.equal(owner.publish(at(90), 90, true, new Set(['a', 'b'])).frontOpacity, .5);
  assert.deepEqual(owner.publish(at(90), 150, true, new Set(['a', 'b'])).residentIds, ['a', 'b']);
  assert.deepEqual(owner.publish(at(90), 160, false, new Set(['a', 'b'])).residentIds, ['b']);
});
test('fixed galaxy-frame piece transforms and membership remain identical through 360 degrees', () => {
  const { document } = parseHTML('<html><body></body></html>');
  const payload: PreparedCloudPatches = { id: 'station-a', frame, count: 2, cellPx: 8, atlas: { file: 'clouds.webp', width: 16, height: 8 },
    matrices: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 4, 5, 1, 0, 0, 0, 1, 0, 0, 0, 1, -3, -4, -5]), cells: new Uint16Array([0, 0, 8, 0]) };
  const bank = createGalaxyStationClouds({ document: document as unknown as Document, payload, resolveResource: file => file });
  document.body.append(bank.root);
  assert.equal(bank.root.style.background, 'transparent', 'the cloud projection must not cover its station sky with the shared projection matte');
  const pieces = [...bank.root.querySelectorAll('[data-station-cloud-piece]')];
  const transforms = pieces.map(piece => piece.getAttribute('style'));
  for (let degree = 0; degree <= 360; degree++) {
    bank.publish(at(1, degree * Math.PI / 180));
    assert.deepEqual([...bank.root.querySelectorAll('[data-station-cloud-piece]')], pieces);
    assert.deepEqual(pieces.map(piece => piece.getAttribute('style')), transforms, 'camera transforms only their shared scene, never their galaxy-frame placement');
  }
});
test('complete opaque stations blend without a brightness dip and never attach undecoded roots', async () => {
  const { document } = parseHTML('<html><body><div id="host"></div></body></html>');
  const host = document.getElementById('host') as unknown as HTMLElement;
  let now = 0, coast = false;
  const mount = mountGalaxyStations({ host, stations, hysteresisM: 10, fadeMs: 100, clock: () => now, coasting: () => coast,
    load: async id => { const root = document.createElement('div') as unknown as HTMLElement; root.textContent = id;
      return { root, publish() {}, destroy() { root.remove(); } } satisfies PreparedGalaxyStationScene; } });
  mount.publish(at(0)); assert.equal(host.childNodes.length, 0);
  await Promise.resolve(); mount.publish(at(0)); assert.equal(host.childNodes.length, 1);
  now = 10; mount.publish(at(90)); await Promise.resolve();
  coast = true; mount.publish(at(90)); assert.equal(host.childNodes.length, 1);
  coast = false; mount.publish(at(90)); assert.equal(host.childNodes.length, 2);
  now = 60; mount.publish(at(90));
  const roots = [...host.children] as HTMLElement[];
  assert.ok(roots.every(root => root.style.background === '#000'), 'each complete station has an opaque matte');
  assert.equal(roots[0]!.style.opacity, '1'); assert.equal(roots[1]!.style.opacity, '0.5');
  const original = .12, foregroundOpacity = Number(roots[1]!.style.opacity), rearOpacity = Number(roots[0]!.style.opacity);
  const sourceOver = original * foregroundOpacity + original * rearOpacity * (1 - foregroundOpacity);
  assert.equal(sourceOver, original, 'the actual mounted roots preserve equal-brightness complete skies');
  now = 120; coast = true; mount.publish(at(90)); assert.equal(host.childNodes.length, 2);
  coast = false; mount.publish(at(90)); assert.equal(host.childNodes.length, 1);
  mount.destroy(); assert.equal(host.childNodes.length, 0);
});
test('long travel holds at most three decoded scenes and one pending load', async () => {
  const { document } = parseHTML('<html><body><div id="host"></div></body></html>');
  const host = document.getElementById('host') as unknown as HTMLElement;
  const locations = Array.from({ length: 10 }, (_, i) => ({ id: `station-${i}`, positionM: [i * 100, 0, 0] as const }));
  let now = 0, destroyedScenes = 0;
  const mount = mountGalaxyStations({ host, stations: locations, hysteresisM: 0, fadeMs: 10, clock: () => now,
    load: async () => { const root = document.createElement('div') as unknown as HTMLElement;
      return { root, publish() {}, destroy() { root.remove(); destroyedScenes++; } }; } });
  for (let i = 0; i < locations.length; i++) {
    mount.publish(at(i * 100)); await Promise.resolve(); mount.publish(at(i * 100)); now += 20; mount.publish(at(i * 100));
    assert.ok(mount.stats().loaded <= 3); assert.ok(mount.stats().pending <= 1); assert.ok(host.childNodes.length <= 2);
  }
  assert.ok(destroyedScenes >= 7);
  mount.destroy(); assert.equal(host.childNodes.length, 0);
  assert.throws(() => mountGalaxyStations({ host, stations, hysteresisM: 0, fadeMs: 10, maximumLoadedStations: 2,
    load: async () => { throw new Error('unused'); } }), /prepared replacement/u);
});

const skyBases = [
  ['px', [1, 0, 0], [0, -1, 0], [0, 0, 1]], ['nx', [-1, 0, 0], [0, 1, 0], [0, 0, 1]],
  ['py', [0, 1, 0], [1, 0, 0], [0, 0, 1]], ['ny', [0, -1, 0], [-1, 0, 0], [0, 0, 1]],
  ['pz', [0, 0, 1], [0, -1, 0], [-1, 0, 0]], ['nz', [0, 0, -1], [0, -1, 0], [1, 0, 0]],
] as const;
const skyFixture = (): PreparedCssSky => ({ schema: 'cssearth-css-sky@1', referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, radiusUnits: 1,
  faces: skyBases.map(([id, forwardIcrf, rightIcrf, upIcrf]) => ({ id, forwardIcrf, rightIcrf, upIcrf, texturePath: `${id}.webp`, widthPx: 4, heightPx: 4,
    style: { width: '100px', height: '100px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,-50,-50,-50,1)', backgroundSize: '100px 100px', backgroundPosition: '0px 0px' } })), provenance: {}, approximation: {} });
const cloudFixture = (): PreparedCloudPatches => ({ id: 'cloud-fixture', frame, count: 1, cellPx: 4, atlas: { file: 'clouds.webp', width: 4, height: 4 },
  matrices: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -50]), cells: new Uint16Array([0, 0]) });

test('complete scene readiness waits for all seven actual image decodes', async t => {
  const { document } = parseHTML('<html><body></body></html>');
  let release!: () => void, finished = false;
  const gate = new Promise<void>(resolve => { release = resolve; }), decoded: string[] = [];
  const prototype = document.defaultView!.Image.prototype, prior = Object.getOwnPropertyDescriptor(prototype, 'decode');
  Object.defineProperty(prototype, 'decode', { value: function(this: { src: string }) { decoded.push(this.src); return gate; }, configurable: true });
  t.after(() => { if (prior) Object.defineProperty(prototype, 'decode', prior); else Reflect.deleteProperty(prototype, 'decode'); });
  const sky = skyFixture(), resources = sky.faces.map(face => ({ path: face.texturePath, width: 4, height: 4, bytes: 32 }));
  const loading = createGalaxyStationScene({ document: document as unknown as Document, sky, resources, clouds: cloudFixture(), imageOpacity: .12, exposureOpacity: .16, resolveResource: file => file }).then(scene => { finished = true; return scene; });
  await assert.rejects(createGalaxyStationScene({ document: document as unknown as Document, sky, resources,
    clouds: { ...cloudFixture(), frame: { ...frame, epochJdTt: frame.epochJdTt + 1 } }, resolveResource: file => file }), /share their reference frame and epoch/u);
  await Promise.resolve(); assert.equal(decoded.length, 7); assert.equal(finished, false);
  release(); const scene = await loading;
  assert.equal(scene.root.parentNode, null); assert.equal(scene.root.style.background, '#000');
  const image = scene.root.querySelector<HTMLElement>('[data-galaxy-station-image]')!;
  assert.equal(image.style.opacity, '0.12', 'the fixed display gain follows complete sky/cloud composition once');
  scene.setExposure!(.32); assert.ok(Math.abs(Number(image.style.opacity)-.24)<1e-14, 'one absolute frame exposure is normalized against the baked reference');
  scene.setExposure!(.16); assert.ok(Math.abs(Number(image.style.opacity)-.12)<1e-14, 'the inside anchor preserves the baked image exactly');
  assert.equal(image.querySelectorAll('.prepared-celestial-sky,[data-galaxy-station-clouds]').length, 2);
  assert.equal(scene.root.style.opacity, '', 'the outer station remains opaque for its dissolve');
  assert.equal((scene.root.querySelector('[data-galaxy-station-clouds]') as HTMLElement).style.background, 'transparent');
  scene.destroy();
});
test('a failed real replacement decode keeps the old station mounted', async t => {
  const { document } = parseHTML('<html><body><div id="host"></div></body></html>');
  const prototype = document.defaultView!.Image.prototype, prior = Object.getOwnPropertyDescriptor(prototype, 'decode');
  Object.defineProperty(prototype, 'decode', { value: async function(this: { src: string }) { if (this.src.endsWith('clouds.webp')) throw new Error('atlas decode failed'); }, configurable: true });
  t.after(() => { if (prior) Object.defineProperty(prototype, 'decode', prior); else Reflect.deleteProperty(prototype, 'decode'); });
  const host = document.getElementById('host') as unknown as HTMLElement, errors: unknown[] = [], sky = skyFixture();
  const resources = sky.faces.map(face => ({ path: face.texturePath, width: 4, height: 4, bytes: 32 }));
  const mount = mountGalaxyStations({ host, stations, hysteresisM: 10, fadeMs: 100, clock: () => 0, onError: error => errors.push(error),
    load: async id => {
      if (id === 'b') return createGalaxyStationScene({ document: document as unknown as Document, sky, resources, clouds: cloudFixture(), resolveResource: file => file });
      const root = document.createElement('div') as unknown as HTMLElement;
      return { root, publish() {}, destroy() { root.remove(); } };
    } });
  mount.publish(at(0)); await Promise.resolve(); mount.publish(at(0));
  const previous = host.firstChild;
  mount.publish(at(90)); for (let i = 0; i < 10; i++) await Promise.resolve(); mount.publish(at(90));
  assert.equal(errors.length, 1); assert.match(String(errors[0]), /atlas decode failed/u); assert.deepEqual(mount.stats().failed, ['b']); assert.equal(host.firstChild, previous); assert.equal(host.childNodes.length, 1);
  mount.destroy();
});

test('one transient load failure retries after backoff and recovers without dropping the previous station', async () => {
  const { document } = parseHTML('<html><body><div id="host"></div></body></html>');
  const host = document.getElementById('host') as unknown as HTMLElement;
  let now = 0, calls = 0, publications = 0;
  const timers: (() => void)[] = [];
  const mount = mountGalaxyStations({ host, stations, hysteresisM: 0, fadeMs: 10, clock: () => now, onError() {},
    later: callback => { timers.push(callback); }, requestPublication: () => { publications++; },
    load: async id => {
      if (id === 'b' && ++calls === 1) throw new Error('transient');
      const root = document.createElement('div') as unknown as HTMLElement;
      return { root, publish() {}, destroy() { root.remove(); } };
    } });
  mount.publish(at(0)); await Promise.resolve(); mount.publish(at(0)); const previous = host.firstChild;
  mount.publish(at(100)); for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(calls, 1); assert.equal(host.firstChild, previous); assert.equal(mount.stats().failures[0]!.terminal, false);
  now = 499; mount.publish(at(100)); assert.equal(calls, 1);
  now = 500; const before = publications; timers.shift()!(); assert.equal(publications, before + 1);
  mount.publish(at(100)); await Promise.resolve(); mount.publish(at(100)); now = 520; mount.publish(at(100));
  assert.equal(calls, 2); assert.deepEqual(mount.stats().failed, []); assert.deepEqual(mount.stats().resident, ['b']);
  mount.destroy();
});
test('three persistent failures stop retrying and report a terminal failure while keeping the old station', async () => {
  const { document } = parseHTML('<html><body><div id="host"></div></body></html>');
  const host = document.getElementById('host') as unknown as HTMLElement;
  let now = 0, calls = 0;
  const mount = mountGalaxyStations({ host, stations, hysteresisM: 0, fadeMs: 10, clock: () => now, onError() {}, later() {},
    load: id => {
      if (id === 'b') { calls++; throw new Error('persistent'); }
      const root = document.createElement('div') as unknown as HTMLElement;
      return Promise.resolve({ root, publish() {}, destroy() { root.remove(); } });
    } });
  mount.publish(at(0)); await Promise.resolve(); mount.publish(at(0)); const previous = host.firstChild;
  for (const time of [0, 500, 1500, 4000, 8000]) { now = time; mount.publish(at(100)); for (let i = 0; i < 5; i++) await Promise.resolve(); }
  assert.equal(calls, 3); assert.equal(mount.stats().failures[0]!.terminal, true); assert.equal(host.firstChild, previous);
  mount.destroy();
});
