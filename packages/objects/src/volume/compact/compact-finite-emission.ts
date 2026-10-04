import { parseCloudAppearance } from '../emission/cloud-appearance.js';
import { validateChannelGain } from '../emission/channel-gain.js';
import { validateDatasetToneCurve } from '../emission/dataset-tone-curve.js';
import { requireRecord as record } from '@cssearth/core';
import type { CompilerPin } from '../compiler/compiler-bake.js';
const check: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new TypeError(message); };
export const COMPACT_FINITE_EMISSION_SCHEMA = 'cssearth-compact-finite-emission@2';

const readCompactFinitePin = (value: unknown, label: string): CompilerPin => {
  const pin = record(value, label);
  check(typeof pin.path === 'string', `${label} needs a path`);
  return { path: pin.path };
};
const readCompactFiniteNumbers = (value: unknown, length: number, label: string): number[] => {
  check(Array.isArray(value) && value.length === length && value.every(entry => typeof entry === 'number' && Number.isFinite(entry)), `Invalid ${label}`);
  return value as number[];
};
function readCompactFiniteBounds(value: unknown, label: string) {
  const raw = record(value, label);
  const min = readCompactFiniteNumbers(raw.min, 2, `${label} minimum`), max = readCompactFiniteNumbers(raw.max, 2, `${label} maximum`);
  check(min[0]! < max[0]! && min[1]! < max[1]!, `Invalid ${label}`);
  return { min: [min[0]!, min[1]!] as [number, number], max: [max[0]!, max[1]!] as [number, number] };
}

export const COMPACT_FINITE_EMISSION_METHOD = 'simulation-guided-finite-material@1';
export function readCompactFiniteEmission(value: unknown) {
  const input = record(value, 'compact finite emission');
  check(input.schema === COMPACT_FINITE_EMISSION_SCHEMA, 'Invalid compact finite emission schema');
  check(input.method === COMPACT_FINITE_EMISSION_METHOD, 'Invalid compact finite emission method');
  const geometry = record(input.geometry, 'delivered geometry');
  const distance = geometry.observerDistanceKpc;
  check(typeof distance === 'number' && Number.isFinite(distance) && distance > 0, 'Delivered observer distance must be positive kpc.');
  const modelTangent = readCompactFiniteBounds(geometry.tangentBoundsKpc, 'model tangent bounds');
  const material = record(input.material, 'delivered material settings');
  const exposureGain = material.exposureGain, fullChromaAlphaByte = material.fullChromaAlphaByte;
  check(typeof exposureGain === 'number' && exposureGain > 0, 'Delivered exposure gain must be positive.');
  check(typeof fullChromaAlphaByte === 'number' && fullChromaAlphaByte >= 1 && fullChromaAlphaByte <= 255, 'Delivered chroma alpha limit must be a byte.');
  const encoding = record(input.encoding, 'delivered encoding');
  check(encoding.format === 'webp', 'Invalid delivered encoding format');
  check(typeof encoding.quality === 'number' && Number.isInteger(encoding.quality), 'Delivered encoder quality must be an integer.');
  check(typeof input.neutralTextures === 'string' && input.neutralTextures.length > 0, 'Delivered neutral texture directory is missing.');
  const prior = record(input.priorCloud, 'prior cloud');
  check(Array.isArray(input.datasets) && input.datasets.length > 0, 'A delivered finite model has at least one dataset.');
  const seen = new Set<string>();
  return { distance, modelTangent, exposureGain, fullChromaAlphaByte, appearance: parseCloudAppearance(input.appearance),
    encoding: { quality: encoding.quality }, neutralTextures: input.neutralTextures,
    emissionField: readCompactFinitePin(input.emissionField, 'emission field'), neutralSlices: readCompactFinitePin(input.neutralSlices, 'neutral slices'),
    envelope: readCompactFinitePin(input.envelope, 'envelope'), priorRecipe: readCompactFinitePin(prior.recipe, 'prior recipe'),
    datasets: input.datasets.map(value => readCompactFiniteDataset(value, seen)),
    toneProjection: input.toneProjection === undefined ? undefined : readCompactToneProjection(input.toneProjection) };
}
export function readCompactFiniteDataset(value: unknown, seen: Set<string>) {
  const dataset = record(value, 'delivered dataset'), imageId = dataset.imageId;
  check(typeof imageId === 'string' && /^[a-z][a-z0-9-]*$/.test(imageId), 'Invalid delivered dataset id.');
  check(!seen.has(imageId), 'Duplicate delivered dataset.'); seen.add(imageId);
  const filter = record(dataset.densityFilter, 'delivered density filter');
  check(filter.cutoff === 0 && filter.softness === .25 && filter.showRemoved === false, 'Compact replay requires the accepted unchanged density filter.');
  return { imageId, bounds: readCompactFiniteBounds(dataset.tangentBoundsKpc, `${imageId} tangent bounds`),
    registered: readCompactFinitePin(dataset.registered, `${imageId} registered image`), coverage: readCompactFinitePin(dataset.coverage, `${imageId} coverage mask`),
    toneCurve: dataset.toneCurve === undefined ? undefined : validateDatasetToneCurve(dataset.toneCurve),
    channelGain: dataset.channelGain === undefined ? undefined : validateChannelGain(dataset.channelGain) };
}
export function readCompactToneProjection(value: unknown) {
  const grid = record(value, 'delivered tone projection'), pw = grid.width, ph = grid.height;
  check(Number.isInteger(pw) && Number.isInteger(ph) && Number(pw) > 0 && Number(ph) > 0, 'A tone projection needs its pinned grid.');
  return { width: Number(pw), height: Number(ph), bounds: readCompactFiniteBounds(grid.tangentBoundsKpc, 'tone projection bounds'),
    image: readCompactFinitePin(grid.image, 'tone projection image') };
}
