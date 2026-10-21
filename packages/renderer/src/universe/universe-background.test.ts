import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { cameraPoseToReferenceFrame, createSceneLifetime } from '@cssearth/engine';
import { parseDensityVolumeObjectDescriptor, parsePreparedDensityVolumeText, parsePreparedWorldContextSummary } from '@cssearth/objects';
import { createUniverseBackground } from './universe-background.js';
import { worldLayerVisibility } from './world-layers.js';

test('the galaxy background mounts all three accepted slab stacks, with one host backdrop, and retires inside', async () => {
  const object = new URL('../../../../src/objects/milky-way-volume/', import.meta.url);
  const descriptor = parseDensityVolumeObjectDescriptor(JSON.parse(await readFile(new URL('object.json', object), 'utf8')));
  const payload = parsePreparedDensityVolumeText(await readFile(new URL('prepared/volume.json', object), 'utf8'), descriptor);
  const plan = parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('../../../../src/objects/observable-universe/prepared/world.json', import.meta.url), 'utf8')));
  const { document } = parseHTML('<div id="host"><span></span></div>'), root = document.getElementById('host')!;
  const lifetime = createSceneLifetime();
  const background = createUniverseBackground({ root, end: root.firstElementChild!, lifetime, plan, payload,
    sky: false, resolveResource: path => `/prepared/${path}`, prefetchUrls: [], prefetchDistanceM: Infinity });
  try {
    background.mount();
    const host = root.querySelector<HTMLElement>('.prepared-volume-context')!;
    const projections = [...host.querySelectorAll<HTMLElement>('.css-volume-projection')];
    assert.equal(projections.length, 3);
    assert.ok(projections.every(projection => projection.style.background !== 'transparent'), 'completed far stack mattes must remain opaque for a linear dissolve');
    assert.equal(host.querySelectorAll('.css-volume-mesh s').length,
      3 * payload.stacks.reduce((sum, stack) => sum + stack.leaves.length, 0), 'all three prepared optical copies');
    assert.ok(host.querySelectorAll('*').length <= 500, 'the installed far scene respects the whole-scene cap');
    const publish = (zKpc: number) => background.publish({ referenceFrame: payload.frame.referenceFrame, epochJdTt: payload.frame.epochJdTt,
      pose: cameraPoseToReferenceFrame({ positionM: [8.277 * payload.frame.metersPerUnit, 0, zKpc * payload.frame.metersPerUnit],
        orientationXyzw: [0, 0, 0, 1] }, payload.frame) },
    { focalPixels: 900, widthPixels: 1440, heightPixels: 900, principalOffsetPixels: [0, 0] },
    Math.abs(zKpc) * payload.frame.metersPerUnit, plan.focus.positionM, 1);
    publish(35);
    assert.equal(host.style.display, ''); assert.equal(host.style.opacity, '1');
    // A Sun-centred camera, independent of the volume's Galactic-centre footprint.
    background.publish({ referenceFrame: payload.frame.referenceFrame, epochJdTt: payload.frame.epochJdTt,
      pose: { positionM: plan.focus.positionM, orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 900, widthPixels: 1440, heightPixels: 900, principalOffsetPixels: [0, 0] }, 0, plan.focus.positionM, 1);
    assert.equal(host.style.display, 'none'); assert.equal(host.style.opacity, '0');
  } finally { lifetime.destroy(); }
  assert.equal(root.querySelector('.prepared-volume-context')?.querySelectorAll('.css-volume-projection').length, 0);
});

test('an inside station preserves the owner near-object NASA fade and applies far image gain once to the far image only', async () => {
  const object = new URL('../../../../src/objects/milky-way-volume/', import.meta.url);
  const descriptor = parseDensityVolumeObjectDescriptor(JSON.parse(await readFile(new URL('object.json', object), 'utf8')));
  const payload = parsePreparedDensityVolumeText(await readFile(new URL('prepared/volume.json', object), 'utf8'), descriptor);
  const plan = parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('../../../../src/objects/observable-universe/prepared/world.json', import.meta.url), 'utf8')));
  assert.ok(payload.sky, 'the installed payload supplies the unchanged NASA background');
  const { document } = parseHTML('<div id="host"><span></span></div>'), root = document.getElementById('host')!;
  const lifetime = createSceneLifetime(), halfHeight = plan.volume.discHalfHeightM!;
  // The observed owner regime: 1.1282896 disc half-heights from the viewed body. This fixed distance independently
  // defends its .0804105 NASA fade; deriving the distance from galaxyOutsideFade itself would route around a mutation.
  const ownerDistance = halfHeight * 1.128289620711537;
  const nearWorld = { referenceFrame: payload.frame.referenceFrame, epochJdTt: payload.frame.epochJdTt,
    pose: { positionM: [0, 0, ownerDistance] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 900, widthPixels: 1440, heightPixels: 900, principalOffsetPixels: [0, 0] as const };
  const background = createUniverseBackground({ root, end: root.firstElementChild!, lifetime, plan, payload,
    sky: true, resolveResource: path => `/prepared/${path}`, prefetchUrls: [], prefetchDistanceM: Infinity,
    stations: { stations: [{ id: 'owner', positionM: nearWorld.pose.positionM }], replacesBanks: [],
      farFadeStartM: halfHeight, farFullDistanceM: 2 * halfHeight, hysteresisM: 0, fadeMs: 100, farImageOpacity: .12,
      load: async () => {
        const station = document.createElement('div') as unknown as HTMLElement;
        return { root: station, publish() {}, destroy() { station.remove(); } };
      } } });
  try {
    background.mount();
    const host = root.querySelector<HTMLElement>('.prepared-volume-context')!;
    const farImage = root.querySelector<HTMLElement>('.prepared-volume-image')!;
    const nasa = root.querySelector<HTMLElement>('.prepared-celestial-sky')!;
    background.publish(nearWorld, viewport, ownerDistance, plan.focus.positionM, 1);
    await Promise.resolve();
    background.publish(nearWorld, viewport, ownerDistance, plan.focus.positionM, 1);
    const expectedOutside = .08041051012959;
    assert.ok(Math.abs(background.inspect()!.outside - expectedOutside) < 1e-12);
    assert.equal(background.inspect()!.layers, 0, 'station selection uses physical position');
    assert.ok(Math.abs(Number(host.style.opacity) - expectedOutside) < 1e-12, 'a ready inside scene must not force brightness to one');
    assert.equal(nasa.style.opacity, '1', 'the existing NASA sky remains unfaded under the model');
    const stationHost = host.querySelector<HTMLElement>('.prepared-galaxy-stations')!;
    const station = stationHost.querySelector<HTMLElement>('[data-galaxy-station]')!;
    assert.equal(stationHost.style.opacity, '1'); assert.equal(station.style.opacity, '1', 'the far image gain must not dim the inside scene a second time');
    assert.equal(Number(farImage.style.opacity), .12, 'the prepared far display gain is applied once on its own image');
    assert.equal(farImage.parentNode, null, 'the complete far scene is detached at the station centre');
    // The inside skies stand in for the NASA band, so the Sky switch takes them with it; Galaxies takes the far scene.
    background.publish(nearWorld, viewport, ownerDistance, plan.focus.positionM, 1, null, 0, worldLayerVisibility(['sky']));
    assert.equal(stationHost.parentNode, null, 'Sky off leaves no inside sky mounted');
    background.publish(nearWorld, viewport, ownerDistance, plan.focus.positionM, 1, null, 0, worldLayerVisibility(['galaxies']));
    assert.equal(host.style.display, 'none', 'Galaxies off hides the far scene');
    assert.equal(stationHost.parentNode, host, 'Galaxies off keeps the inside sky');
    background.publish(nearWorld, viewport, ownerDistance, plan.focus.positionM, 1);
    assert.equal(host.style.display, ''); assert.equal(stationHost.parentNode, host);
    background.publish(nearWorld, viewport, ownerDistance, plan.focus.positionM, .25);
    assert.ok(Math.abs(Number(host.style.opacity) - expectedOutside * .25) < 1e-12);
    assert.ok(Math.abs(Number(nasa.style.opacity) * (1 - Number(host.style.opacity)) - (1 - expectedOutside)) < 1e-12,
      'retiring a foreground subject preserves the NASA contribution');
    const farWorld = { ...nearWorld, pose: { ...nearWorld.pose, positionM: [0, 0, 100 * halfHeight] as const } };
    background.publish(farWorld, viewport, 100 * halfHeight, plan.focus.positionM, 1);
    assert.equal(host.style.opacity, '1'); assert.equal(nasa.style.opacity, '0');
    assert.equal(Number(farImage.style.opacity), .12); assert.equal(farImage.parentNode, host);
    assert.equal(stationHost.parentNode, null, 'the station leaves the mounted scene outside its support');
  } finally { lifetime.destroy(); }
});

test('the far picture stays under a complete inside scene until the camera stops, then leaves', async () => {
  const object = new URL('../../../../src/objects/milky-way-volume/', import.meta.url);
  const descriptor = parseDensityVolumeObjectDescriptor(JSON.parse(await readFile(new URL('object.json', object), 'utf8')));
  const payload = parsePreparedDensityVolumeText(await readFile(new URL('prepared/volume.json', object), 'utf8'), descriptor);
  const plan = parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('../../../../src/objects/observable-universe/prepared/world.json', import.meta.url), 'utf8')));
  const { document } = parseHTML('<div id="host"><span></span></div>'), root = document.getElementById('host')!;
  const lifetime = createSceneLifetime(), halfHeight = plan.volume.discHalfHeightM!, distance = halfHeight * 1.128289620711537;
  const world = { referenceFrame: payload.frame.referenceFrame, epochJdTt: payload.frame.epochJdTt,
    pose: { positionM: [0, 0, distance] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 900, widthPixels: 1440, heightPixels: 900, principalOffsetPixels: [0, 0] as const };
  let now = 0;
  const frames: ((now?: number) => void)[] = [], timers: (() => void)[] = [];
  const flush = () => { for (let i = 0; i < 8; i++) { for (const callback of timers.splice(0)) callback(); for (const callback of frames.splice(0)) callback(now); } };
  const background = createUniverseBackground({ root, end: root.firstElementChild!, lifetime, plan, payload,
    sky: true, resolveResource: path => `/prepared/${path}`, prefetchUrls: [], prefetchDistanceM: Infinity,
    settle: { frame: callback => frames.push(callback), clock: () => now, later: callback => { timers.push(callback); } },
    stations: { stations: [{ id: 'inside', positionM: world.pose.positionM }], replacesBanks: [],
      farFadeStartM: halfHeight, farFullDistanceM: 2 * halfHeight, hysteresisM: 0, fadeMs: 100,
      load: async () => {
        const station = document.createElement('div') as unknown as HTMLElement;
        return { root: station, publish() {}, destroy() { station.remove(); } };
      } } });
  try {
    background.mount();
    const host = root.querySelector<HTMLElement>('.prepared-volume-context')!;
    const farImage = root.querySelector<HTMLElement>('.prepared-volume-image')!;
    // A zoom: the camera moves every frame.
    for (let step = 0; step < 12; step++) {
      const zoomed = { ...world, pose: { ...world.pose, positionM: [0, 0, distance * (1 + step / 1000)] as const } };
      background.publish(zoomed, viewport, distance, plan.focus.positionM, 1);
      await Promise.resolve();
      now += 100; flush();
      assert.ok(farImage.parentNode === host, 'removing 390 far layers mid-zoom drops frames; it waits for the camera to stop');
    }
    const view = background.inspect()!;
    assert.ok(view.layers === 0 && view.outside > 0, 'the inside scene is complete and shown');
    // Motion that keeps `positionM` bit for bit: the eye's exact anchor moves, then the principal point shifts.
    const held = distance * 1.011;
    for (let frame = 0; frame < 24; frame++) {
      const offsetM = [0, 0, Math.min(frame, 11)] as const;
      background.publish({ ...world, pose: { ...world.pose, positionM: [0, 0, held] as const, focusOffset: { originM: [0, 0, held] as const, offsetM } } },
        frame < 12 ? viewport : { ...viewport, principalOffsetPixels: [frame, 0] as const }, distance, plan.focus.positionM, 1);
      now += 100; flush();
      assert.ok(farImage.parentNode === host, 'a moving eye anchor or principal point is motion');
    }
    // Still: republications of the unchanged view do not count as motion.
    for (let frame = 0; frame < 12; frame++) { background.publish({ ...world, pose: { ...world.pose, positionM: [0, 0, held] as const } }, viewport, distance, plan.focus.positionM, 1); now += 100; flush(); }
    assert.ok(farImage.parentNode === null, 'once still, the covered far picture leaves');
  } finally { lifetime.destroy(); }
});
