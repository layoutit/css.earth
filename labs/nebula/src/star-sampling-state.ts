import type { SamplePoint, SamplingControls, SamplingResult, StarSample } from './star-sampling-types';

export interface StarReference { point: SamplePoint; included: boolean; sample?: StarSample; }
export interface ReferenceState { controls: SamplingControls; references: StarReference[]; selected: SamplePoint | null; }
export const defaultSamplingControls = (): SamplingControls => ({ widthScale: 1, amplitudeScale: 1, betaOverride: null });
export const pointKey = (point: SamplePoint) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`;
export const validSamplePoint = (point: SamplePoint, dimensions: [number, number]) => point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
  point.x >= 0 && point.y >= 0 && point.x <= dimensions[0] - 1 && point.y <= dimensions[1] - 1;
const identity = (result: SamplingResult) => `${result.imageId}:${result.sourceSha256}:${result.nativeDimensions.join('x')}`;
export const referenceStorageKey = (result: SamplingResult) => `cssearth-star-samples-v3:${identity(result)}`;
function validControls(value: SamplingControls) {
  return value && Number.isFinite(value.widthScale) && value.widthScale >= .5 && value.widthScale <= 3 &&
    Number.isFinite(value.amplitudeScale) && value.amplitudeScale >= 0 && value.amplitudeScale <= 1.5 &&
    (value.betaOverride === null || Number.isFinite(value.betaOverride) && value.betaOverride >= 1.1 && value.betaOverride <= 8);
}
function validPreview(sample: StarSample, point: SamplePoint, dimensions: [number, number]) {
  return sample && sample.id && validSamplePoint(sample.requestedPoint, dimensions) && pointKey(sample.requestedPoint) === pointKey(point) &&
    validSamplePoint(sample.point, dimensions) && typeof sample.qualified === 'boolean' && sample.cutout &&
    [sample.cutout.x, sample.cutout.y, sample.cutout.width, sample.cutout.height].every(Number.isInteger) &&
    sample.cutout.x >= 0 && sample.cutout.y >= 0 && sample.cutout.width > 0 && sample.cutout.height > 0 &&
    sample.cutout.x + sample.cutout.width <= dimensions[0] && sample.cutout.y + sample.cutout.height <= dimensions[1] &&
    sample.metrics && Array.isArray(sample.metrics.flags) && sample.metrics.flags.every(flag => typeof flag === 'string') &&
    (['source', 'model', 'residual'] as const).every(kind => {
      const url = sample.images?.[kind];
      return typeof url === 'string' && /^\/@fs\/[^?#]*\/\.local\/nebula-lab\/star-sampling(?:-applied)?\/[^?#]*\.png$/.test(url) && !url.split('/').includes('..');
    });
}
export function parseReferenceState(input: unknown, result: SamplingResult): ReferenceState | null {
  const value = input as ReferenceState | null;
  if (!value || !validControls(value.controls) || !Array.isArray(value.references) || value.references.length > 50 ||
    value.references.some(row => !row || !validSamplePoint(row.point, result.nativeDimensions) || typeof row.included !== 'boolean') ||
    new Set(value.references.map(row => pointKey(row.point))).size !== value.references.length ||
    value.selected !== null && !validSamplePoint(value.selected, result.nativeDimensions)) return null;
  return { controls: value.controls, selected: value.selected, references: value.references.map(row => ({
    point: row.point, included: row.included, ...(validPreview(row.sample!, row.point, result.nativeDimensions) ? { sample: row.sample } : {}),
  })) };
}
export function readReferenceState(result: SamplingResult, storage: Pick<Storage, 'getItem'> = localStorage): ReferenceState | null {
  try {
    const saved = storage.getItem(referenceStorageKey(result));
    if (saved) return parseReferenceState(JSON.parse(saved), result);
    const legacy = JSON.parse(storage.getItem(`cssearth-star-samples-v2:${identity(result)}`) ?? 'null');
    return legacy ? parseReferenceState({ ...legacy, references: legacy.selection }, result) : null;
  } catch { return null; }
}
export function mergeReferenceSamples(references: StarReference[], incoming: StarSample[], explicitAddition = false): StarReference[] {
  const next = references.map(row => ({ ...row }));
  for (const sample of incoming) {
    const row = next.find(value => pointKey(value.point) === pointKey(sample.requestedPoint));
    if (row) { row.sample = sample; if (explicitAddition) row.included = true; }
    else {
      if (next.length >= 50) throw new Error('The reference list already has 50 stars. Use the existing references.');
      next.push({ point: sample.requestedPoint, included: explicitAddition || sample.qualified, sample });
    }
  }
  return next;
}
