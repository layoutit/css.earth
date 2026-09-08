import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSamplingControls, mergeReferenceSamples, parseReferenceState, readReferenceState, referenceStorageKey } from './star-sampling-state';
import type { SamplingResult, StarSample } from './star-sampling-types';

const context = { imageId: 'vista-infrared', sourceSha256: 'a'.repeat(64), nativeDimensions: [1000, 1000] } as SamplingResult;
function sample(index: number): StarSample {
  const point = { x: index * 10, y: index * 10 };
  const url = `/@fs/work/project/.local/nebula-lab/star-sampling/record/sample-${index}.png`;
  return { id: String(index), requestedPoint: point, point, qualified: true, cutout: { x: 0, y: 0, width: 100, height: 100 },
    metrics: { flags: [] }, images: { source: url, model: url, residual: url, comparison: url } } as unknown as StarSample;
}
test('calibration updates previews without dropping excluded references, changing order or changing replay seeds', () => {
  const found = mergeReferenceSamples([], [sample(1), sample(2), sample(3)]); found[1]!.included = false;
  const added = mergeReferenceSamples(found, [sample(4), sample(5)], true);
  const updated = mergeReferenceSamples(added, [sample(1), sample(3), sample(4), sample(5)].map(value => ({ ...value, point: { x: value.point.x + .2, y: value.point.y } })));
  assert.deepEqual(updated.map(row => row.point), added.map(row => row.point));
  assert.deepEqual(updated.map(row => row.included), [true, false, true, true, true]);
  assert.equal(updated.length, 5);
});
test('saved native crop URLs and focused references survive reload; missing metadata retains positions', () => {
  const value = { controls: defaultSamplingControls(), references: mergeReferenceSamples([], [sample(1), sample(2)]), selected: sample(2).requestedPoint };
  const restored = parseReferenceState(JSON.parse(JSON.stringify(value)), context)!;
  assert.equal(restored.references[0]!.sample!.images.source, sample(1).images.source);
  assert.deepEqual(restored.selected, value.selected);
  value.references[0]!.sample!.images.source = 'https://unrelated.example/preview.png';
  const missing = parseReferenceState(value, context)!;
  assert.equal(missing.references[0]!.sample, undefined);
  assert.deepEqual(missing.references[0]!.point, sample(1).requestedPoint);
});
test('restoration binds to source hash and dimensions and keeps legacy positions', () => {
  const value = { controls: defaultSamplingControls(), references: mergeReferenceSamples([], [sample(1)]), selected: sample(1).requestedPoint };
  const map = new Map([[referenceStorageKey(context), JSON.stringify(value)]]), storage = { getItem: (key: string) => map.get(key) ?? null };
  assert.equal(readReferenceState(context, storage)!.references.length, 1);
  assert.equal(readReferenceState({ ...context, sourceSha256: 'b'.repeat(64) }, storage), null);
  map.clear(); map.set(`cssearth-star-samples-v2:${context.imageId}:${context.sourceSha256}:1000x1000`, JSON.stringify({ controls: value.controls, selection: [{ point: value.selected, included: false }], selected: value.selected }));
  assert.deepEqual(readReferenceState(context, storage)!.references, [{ point: value.selected, included: false }]);
});
