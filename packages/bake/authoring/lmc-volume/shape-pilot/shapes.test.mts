import test from 'node:test';
import assert from 'node:assert/strict';
import { volumeObject, planarBasis } from '../catalogue-volume.mts';
import { outsideCamera } from '../render.mts';
import { makeRaster } from '../inputs.mts';
import type { CatalogueScene } from '../catalogue-scene.mts';
import type { Grade } from '../grade.mts';
import { partitionEmitters, effectiveEmitters, shapeBounds, type Shape } from './source.mts';
import { projectCatalogue, catalogueBasis } from '../catalogue-render.mts';
import { gradedPrediction } from '../grade.mts';
import { finiteEmission } from './project.mts';
import { shapeSpec, backgroundSpec, mergeVolumes } from './build.mts';
import { PREPARED_CSS_VOLUME_SCHEMA, validatePreparedCssVolume } from '@cssearth/objects';
import { slabDomain } from '../../milky-way-dust/galaxy-slab-domain.mts';

const object = (id = 'gas', kind: 'ball' | 'shell' = 'ball') => volumeObject({ id, owner: id, component: 4, kind, center: [0, 0, 0], axes: [.12, .12, .12], basis: planarBasis(0), inner: kind === 'shell' ? .72 : 0, color: [1, .3, .5], weight: .001, source: 'Numerical fixture' });
const shape = (kind: 'ball' | 'shell' = 'ball'): Shape => ({ id: 'cloud', label: 'Numerical fixture', box: { min: [-.15, -.15, -.15], max: [.15, .15, .15] }, emitters: [{ object: object('gas', kind), amplitude: 1 }] });
const grade: Grade = { coefficients: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], stretch: 0, saturation: 1, dustStrength: 1, dustTint: [1, 1, 1], score: 0 };

test('only selected finite emitters move; the continuous stellar and dust fields retain one owner', () => {
  const map = makeRaster(4, 10), cloud = shape(), gas = cloud.emitters[0]!.object, other = object('other'), dust = object('dust');
  const scene: CatalogueScene = { objects: [gas, other], dust: [dust], owners: [], sources: { warp: map, dust: map, young: [map, map, map], youngCoverage: map, youngFraction: 0, oldColor: [1, 1, 1], gas: map, metadata: {} }, colors: [[1, 1, 1]], dustArea: 1, molecularFraction: .2, metadata: {}, youngDensity: map };
  const background = partitionEmitters(scene, [cloud]);
  assert.deepEqual(background.objects, [other]); assert.strictEqual(background.objects[0], other);
  for (const key of ['dust', 'sources', 'colors', 'youngDensity', 'metadata'] as const) assert.strictEqual(background[key], scene[key]);
  assert.equal(background.dustArea, scene.dustArea); assert.equal(background.molecularFraction, scene.molecularFraction);
  assert.throws(() => partitionEmitters(scene, [cloud, cloud]), /exactly one owner/);
});

test('finite clouds remain round through rotation, and their cropped boundary emits no rectangle', () => {
  const images = [0, 45, 90].map(t => finiteEmission(shape(), outsideCamera(t, 32, .35), grade));
  for (const image of images) { assert.ok(image.tau.every(v => v === 0)); for (let x = 0; x < 32; x++) assert.equal(image.rgb[x * 3], 0); }
  for (const image of images.slice(1)) for (let i = 0; i < image.rgb.length; i++) assert.ok(Math.abs(image.rgb[i]! - images[0]!.rgb[i]!) < 1e-10);
});

test('a hollow shell has a bright rim, and finite slab emission partitions its complete luminosity', () => {
  const s = shape('shell'), camera = outsideCamera(0, 64, .2), whole = finiteEmission(s, camera, grade), center = whole.linear[(32 * 64 + 32) * 3]!;
  assert.ok(Math.max(...whole.linear) > center * 1.6, 'The shell must retain its cavity and bright rim');
  const near = finiteEmission(s, camera, grade, slabDomain(2, -.2, 0)), far = finiteEmission(s, camera, grade, slabDomain(2, 0, .2));
  for (let i = 0; i < whole.linear.length; i++) assert.ok(Math.abs(whole.linear[i]! - near.linear[i]! - far.linear[i]!) < 1e-12);
});

test('the diffuse background and two independently encoded shapes fit the 33-layer budget', () => {
  const plans = [backgroundSpec(), shapeSpec(shape()), shapeSpec({ ...shape('shell'), id: 'shell' })];
  assert.equal(plans.reduce((s, p) => s + p.counts.reduce((a, b) => a + b) + p.hybrid!.densePerAxis.reduce((a, b) => a + b), 0), 33);
  assert.deepEqual([0, 1, 2].map(a => plans.reduce((n, p) => n + p.counts[a]!, 0)), [10, 10, 7]);
  assert.throws(() => shapeSpec(shape(), 512), /tiny shape pilot/);
});

test('the local texture bounds follow the actual finite shape with a transparent guard', () => {
  const o = object(), b = shapeBounds([o]);
  for (let a = 0; a < 3; a++) { assert.ok(b.min[a]! < -.12 && b.max[a]! > .12); assert.ok(b.max[a]! - b.min[a]! < .26); }
  assert.throws(() => shapeBounds([]));
});

test('isolating a gas shape preserves the original projector luminosity, including the global gas gain', () => {
  const map = makeRaster(4, 10), o = object(), camera = outsideCamera(45, 24, .3);
  const scene: CatalogueScene = { objects: [o], dust: [], owners: [{ id: 'gas', kind: 'region', component: 4, prior: 1, maximum: 2, measuredAge: false, logAge: null, aliases: [] }], sources: { warp: map, dust: map, young: [map, map, map], youngCoverage: map, youngFraction: 0, oldColor: [1, 1, 1], gas: map, metadata: {} }, colors: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], dustArea: 0, molecularFraction: 0, ionizedGain: .37, metadata: {} }, amplitudes = Float64Array.from([.8]);
  const original = gradedPrediction(catalogueBasis(projectCatalogue(scene, camera, .06, undefined, undefined, { objectSubpixels: 4 }), scene, amplitudes), grade);
  const finite = finiteEmission({ ...shape(), emitters: effectiveEmitters(scene, amplitudes, [o]) }, camera, grade).rgb;
  for (let i = 0; i < original.length; i++) assert.ok(Math.abs(original[i]! - finite[i]!) < 1e-11, 'Finite shape extraction must preserve source emission');
});

test('a standalone cloud keeps its local bounds and does not inherit the galaxy thin-disc axis policy', () => {
  const local = { min: [-.15, -.15, -.15] as [number, number, number], max: [.15, .15, .15] as [number, number, number] };
  const volume = validatePreparedCssVolume({ schema: PREPARED_CSS_VOLUME_SCHEMA, id: 'lmc-volume', frame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: local }, anchors: [], stacks: [{ axis: 'x', leaves: [] }, { axis: 'y', leaves: [] }, { axis: 'z', leaves: [] }], resources: [] });
  assert.deepEqual(mergeVolumes([{ id: 'cloud', volume }]).frame.boundsUnits, local);
});
