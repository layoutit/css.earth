import assert from 'node:assert/strict';
import test from 'node:test';
import { projectCatalogue } from '../catalogue-render.mts';
import { volumeObject } from '../catalogue-volume.mts';
import { add, bodyToIcrs, cross, DISTANCE, mul, normalize, rayInBody, dot, type V3 } from '../geometry.mts';
import type { Grade } from '../grade.mts';
import { makeRaster, type Raster } from '../inputs.mts';
import type { Camera } from '../render.mts';
import type { CatalogueScene, LmcModel } from '../scene.mts';
import { slabDomain } from './slab-domain.mts';
import { projectLmcSlab } from './slab-source.mts';

const empty = (): Raster => {
  const map = makeRaster(4, 20);
  map.mask.fill(1);
  return map;
};
const BASIS: [V3, V3, V3] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const GRADE: Grade = {
  coefficients: [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
  ],
  dustStrength: 1,
  dustTint: [1, 1, 1],
  stretch: 20,
  saturation: 0.5,
  score: 0,
};
function faceOnCamera(tiltDegrees: number, size: number, half = 8): Camera {
  const angle = (tiltDegrees * Math.PI) / 180,
    eye: V3 = [0, Math.sin(angle), Math.cos(angle)],
    up: V3 = [0, Math.cos(angle), -Math.sin(angle)];
  return {
    name: `tilt-${tiltDegrees}-half-${half}`,
    width: size,
    height: size,
    foreground: false,
    pixelOf: p => [((p[0] / half + 1) * size) / 2, ((1 - dot(p, up) / half) * size) / 2],
    areaAt: () => ((2 * half) / size) ** 2,
    ray(col, row) {
      const x = ((col / size) * 2 - 1) * half,
        y = (1 - (row / size) * 2) * half;
      return { origin: add(add([x, 0, 0], mul(up, y)), mul(eye, 30)), direction: mul(eye, -1) };
    },
  };
}
function fixture(center: V3, dustCenter: V3): CatalogueScene & { source: ReturnType<typeof volumeObject> } {
  const source = volumeObject({
      id: 'source',
      owner: 'source',
      kind: 'ball',
      component: 3,
      center,
      basis: BASIS,
      axes: [0.1, 0.1, 0.1],
      inner: 0,
      color: [1, 1, 1],
      weight: 1,
      source: 'fixture',
    }),
    dust = volumeObject({
      ...source,
      id: 'dust',
      owner: 'dust',
      kind: 'dust',
      center: dustCenter,
      axes: [0.3, 0.3, 0.1],
    });
  return {
    source,
    objects: [source],
    owners: [
      {
        id: 'source',
        kind: 'cluster',
        component: 3,
        prior: 1,
        maximum: 2,
        measuredAge: false,
        logAge: null,
        aliases: [],
      },
      {
        id: 'young',
        kind: 'population',
        component: 3,
        prior: 1,
        maximum: 2,
        measuredAge: false,
        logAge: null,
        aliases: [],
      },
    ],
    warp: empty(),
    colors: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    barSigmaZ: 0.1,
    innerDiscColor: [0, 0, 0],
    oldPopulation: {
      disc: empty(),
      bar: empty(),
      points: { count: 0, positions: new Float64Array(), rgb: new Float32Array(), components: new Uint8Array() },
      oldFraction: 0,
      youngFraction: 0,
    },
    dustLayer: { column: empty(), strength: 1, clouds: [dust], extinctionRgb: [0.75, 1, 1.3] },
    youngDensity: empty(),
    youngOwner: 'young',
    youngTint: [1, 1, 1],
    outskirtsGain: 1,
    innerDiscGain: 1,
    barGain: 1,
  };
}
const light = (scene: CatalogueScene, camera: Camera, domain?: ReturnType<typeof slabDomain>) =>
  projectCatalogue(scene, camera, 0.06, undefined, domain).objects[0]!.rgb.reduce((a, b) => a + b, 0);

test('a slab holds only the light and dust inside its own interval', () => {
  const scene = fixture([0, 0, -0.5], [0, 0, 0.5]),
    camera = faceOnCamera(0, 16, 1),
    domain = slabDomain(2, -1, 0),
    local = light(scene, camera, domain);
  assert.ok(light(scene, camera) < local * 0.9, 'The cloud attenuates the whole model');
  scene.dustLayer.clouds = [];
  assert.equal(light(scene, camera, domain), local, 'A cloud beyond the interval cannot tint the slab');
  assert.equal(light(scene, camera, slabDomain(2, 0, 1)), 0, 'An emitter belongs only to its own interval');
});

test('the far-picture shortcuts change no pixel of a finite nebula', () => {
  const scene = fixture([0, 0, 5], [0, 0, 6]),
    camera = faceOnCamera(0, 16, 1),
    plain = projectCatalogue(scene, camera, 0.015),
    cut = projectCatalogue(scene, camera, 0.015, undefined, undefined, {
      objectSubpixels: 2,
      cacheFinishedDust: true,
      gaussianTailSigma: 10,
    }),
    jump = projectCatalogue(scene, camera, 0.015, undefined, undefined, {
      objectSubpixels: 2,
      cacheFinishedDust: true,
      gaussianTailSigma: 10,
      skipEmptyGaussianRuns: true,
    });
  assert.deepEqual(cut.objects, plain.objects);
  assert.ok(Number(cut.metadata.finishedDustCacheHits) > 0);
  assert.deepEqual(jump.objects, cut.objects);
  assert.deepEqual(jump.smooth.planes, cut.smooth.planes);
  assert.ok(cut.objects[0]!.rgb.some(v => v > 0));
});

test('a plane rendered in strips equals the whole plane', () => {
  const scene = fixture([0, 0, -0.5], [0, 0, -0.2]),
    model: Pick<LmcModel, 'scene' | 'amplitudes' | 'grade'> = {
      scene,
      amplitudes: Float64Array.from([1, 1]),
      grade: GRADE,
    },
    camera = faceOnCamera(0, 16, 1),
    domain = slabDomain(2, -1, 0),
    whole = projectLmcSlab(model, domain, camera);
  const strip = (from: number) => {
    const part = new Uint8Array(16 * 16);
    for (let y = 0; y < 16; y++) part.fill(1, y * 16 + from, y * 16 + from + 8);
    return { part, slab: projectLmcSlab(model, domain, camera, part) };
  };
  for (const { part, slab } of [strip(0), strip(8)])
    for (let p = 0; p < part.length; p++)
      if (part[p]) {
        assert.equal(slab.tau[p], whole.tau[p]);
        for (let c = 0; c < 3; c++) assert.equal(slab.rgb[p * 3 + c], whole.rgb[p * 3 + c]);
      }
  assert.ok(whole.rgb.some(v => v > 0));
});
