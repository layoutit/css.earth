import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { createSceneLifetime, cssCameraAxesFromOrientation, presentPhysicalPoseInVolume, eyeDistanceM, type WorldCameraPose } from '@cssearth/engine';
import { parseCatalogueProximity, parseDensityVolumeObjectDescriptor, parsePreparedDensityVolumeText, parsePreparedGalaxyStations, parsePreparedWorldContextSummary } from '@cssearth/objects';
import { createUniverseBackground } from './universe-background.js';
import { fetchPreparedCatalogueBank } from './catalogue-point-transport.js';
import { axisWeights, STACK_OPACITY_CEILING } from '../volume/prepared-volume-runtime.js';
import { centralFlightTile, sheetSeparations, measureFlight, type FlightSample } from './galaxy-flight-metrics.test-support.js';
import type { FlightPath } from './galaxy-flight-paths.test-support.mts';
import { watchFlightWrites } from './galaxy-flight-writes.test-support.mts';

const object = new URL('../../../../src/objects/milky-way-volume/', import.meta.url);
const json = async (file: URL): Promise<unknown> => JSON.parse(await readFile(file, 'utf8')) as unknown;
export async function flightInputs() {
  const descriptor = parseDensityVolumeObjectDescriptor(await json(new URL('object.json', object)));
  const payload = parsePreparedDensityVolumeText(await readFile(new URL('prepared/volume.json', object), 'utf8'), descriptor);
  return { payload, plan: parsePreparedWorldContextSummary(await json(new URL('../../../../src/objects/observable-universe/prepared/world.json', import.meta.url))),
    tuner: parsePreparedGalaxyStations(await json(new URL('prepared/galaxy-stations/tuner.json', object))),
    proximity: parseCatalogueProximity(await json(new URL('prepared/catalogue-proximity.json', object))) };
}
export const flightFetcher: typeof fetch = async input => {
  const file = String(input).split('/').at(-1)!;
  if (!/^dots-level-[0-5]\.bin$/u.test(file)) throw new Error('Unexpected harness fetch: ' + file);
  return new Response(await readFile(new URL('prepared/' + file, object)));
};
export const flightViewport = { focalPixels: 887, widthPixels: 1024, heightPixels: 640, principalOffsetPixels: [0, 0] as const };
type Inputs = Awaited<ReturnType<typeof flightInputs>>;

export async function walkGalaxyFlight(inputs: Inputs, path: FlightPath, coasting = false, warm = false) {
  const { payload, plan, tuner, proximity } = inputs;
  const { document } = parseHTML('<div id="host"><span></span></div>'), root = document.getElementById('host')!;
  const watcher = watchFlightWrites(document);
  const lifetime = createSceneLifetime();
  const background = createUniverseBackground({ root, end: root.firstChild!, lifetime, plan, payload, sky: true,
    resolveResource: file => file, prefetchUrls: [], prefetchDistanceM: Infinity,
    catalogueProximity: { host:'milky-way', plan: proximity, resolve: file => file },
    // Station imagery cannot affect numerical coefficients. A complete opaque calibrated sentinel makes
    // source-over light observable independently of texture noise; all selection/fade code is production code.
    stations: { ...tuner,  load: async () => {
      const node = document.createElement('div') as unknown as HTMLElement;
      return { root: node, publish() {}, destroy() { node.remove(); } };
    } } });
  const banks = await Promise.all(proximity.levels.map(l => fetchPreparedCatalogueBank(l.file, flightFetcher)));
  const samples: FlightSample[] = [];
  let previous = new Set<string>(), older = new Set<string>(), blinks = 0, blinkStep = 0, maximumDots = 0;
  const publish = (world: WorldCameraPose) => background.publish(world, flightViewport, eyeDistanceM(world.pose, plan.focus.positionM), plan.focus.positionM, 1);
  try {
    background.mount();
    const image = root.querySelector<HTMLElement>('.prepared-volume-image')!;
    const host = root.querySelector<HTMLElement>('.prepared-volume-context')!;
    if (warm) {
      publish(path.cameras.at(-1)!);
      for (let attempt = 0; attempt < 500; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2));
        publish(path.cameras.at(-1)!);
        if (root.querySelectorAll('[data-catalogue-points]').length === proximity.levels.length && !root.querySelector('[data-catalogue-points="loading"]')) break;
        if (attempt === 499) throw new Error('Warm catalogue preparation did not complete');
      }
    }
    publish(path.cameras[0]!); await new Promise(resolve => setImmediate(resolve)); publish(path.cameras[0]!);
    background.setCoasting(coasting);
    if (coasting) watcher.start();
    for (const [step, world] of path.cameras.entries()) {
      publish(world); await new Promise(resolve => setImmediate(resolve));
      const local = presentPhysicalPoseInVolume(world.pose, payload.frame);
      const roots = [...image.querySelectorAll<HTMLElement>('.css-volume-projection')];
      const opacity = roots.map(n => Number(n.style.opacity));
      let front = 1;
      const shares = opacity.map(() => 0);
      for (let i = opacity.length - 1; i >= 0; i--) { shares[i] = front * opacity[i]!; front *= 1 - opacity[i]!; }
      const total = shares.reduce((sum, v) => sum + v, 0);
      const weights = shares.map(v => total ? v / total : 0);
      const expected = axisWeights(local, payload.stacks, payload.frame.boundsUnits);
      if (weights.some((v, i) => Math.abs(v - expected[i]!.weight / expected.reduce((s, w) => s + w.weight, 0)) > 1e-10)) throw new Error('Published weights differ from runtime selection');
      const station = host.querySelector<HTMLElement>('.prepared-galaxy-stations');
      const stationAlpha = Number(station?.style.opacity ?? 0), hostAlpha = Number(host.style.opacity || 0), imageAlpha = Number(image.style.opacity || 1);
      const far = image.parentNode === host ? hostAlpha * imageAlpha * (1 - stationAlpha) : 0;
      const tile = centralFlightTile(local, payload.frame.boundsUnits);
      const dots = new Set<string>();
      for (const [level, bank] of banks.entries()) {
        const group = root.querySelector<HTMLElement>(`[data-catalogue-points="${bank.id}"]`);
        if (!group || group.style.display === 'none' || Number(group.style.opacity || 1) === 0) continue;
        const centers = new Set([...group.querySelectorAll('path')].flatMap(p => [...(p.getAttribute('d') ?? '').matchAll(/M(-?[\d.]+) (-?[\d.]+)h\.01/gu)].map(m => `${Math.floor(Number(m[1]))},${Math.floor(Number(m[2]))}`)));
        const camera = presentPhysicalPoseInVolume(world.pose, bank.frame), r = cssCameraAxesFromOrientation(camera.orientationXyzw);
        for (let index = 0; index < bank.count; index++) {
          const dx = bank.positions[3 * index]! - camera.positionUnits[0], dy = bank.positions[3 * index + 1]! - camera.positionUnits[1], dz = bank.positions[3 * index + 2]! - camera.positionUnits[2];
          const depth = -(dx * r[2]! + dy * r[5]! + dz * r[8]!); if (depth <= 0) continue;
          const x = flightViewport.focalPixels * (dx * r[0]! + dy * r[3]! + dz * r[6]!) / depth;
          const y = flightViewport.focalPixels * (dx * r[1]! + dy * r[4]! + dz * r[7]!) / depth;
          if (Math.abs(x) > 500 || Math.abs(y) > 308) continue;
          // A named catalogue row is present only if its actual written center exists. Coincident rows share a
          // pixel; this test diagnoses center disappearance, not subpixel luminance (the browser owns that gate).
          let found = false;
          const px = Math.floor(x), py = Math.floor(y);
          for (let ix = -1; ix <= 1 && !found; ix++) for (let iy = -1; iy <= 1 && !found; iy++) found = centers.has(`${px + ix},${py + iy}`);
          if (found) dots.add(`${level}:${index}`);
        }
      }
      for (const id of dots) if (older.has(id) && !previous.has(id)) { blinks++; blinkStep = step; }
      older = previous; previous = dots; maximumDots = Math.max(maximumDots, dots.size);
      samples.push({ camera: local, weights: weights.map(w => w * far), separation: tile ? sheetSeparations(local, payload.stacks, flightViewport.focalPixels, tile) : [0, 0, 0],
        // Observe completed-image contributions. A detached station resetting its inline opacity is invisible,
        // and must not manufacture a full-light jump. All three sentinel pictures have the same calibrated light.
        fades: [far, hostAlpha * stationAlpha, 1 - hostAlpha, background.dotOpacity(world)],
        light: .37 * (far * total + STACK_OPACITY_CEILING * (hostAlpha * stationAlpha + 1 - hostAlpha)), dots: new Set(),
        coastWrites: watcher.take() });
    }
    const metrics = measureFlight(samples, path.approach);
    metrics.blink = { value: blinks, step: blinkStep };
    return { name: path.name, coasting, steps: samples.length, maximumDots, metrics,
      worst: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, { ...value, sample: samples[value.step], world: path.cameras[value.step] }])) };
  } finally { watcher.destroy(); lifetime.destroy(); }
}
