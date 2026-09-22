import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import type { FootprintSample, ObservationFrame } from './contract.mts';
import { bandSetFrame, stripFrame, type Strip } from './composite.mts';

const accepted = (radiance: number): FootprintSample => ({ radiance, gain: 1, separationMeters: 0, maximumEmissionDegrees: 10, maximumIncidenceDegrees: 20 });
/** Strip `index` holds scene rows 100 * index to 100 * index + 128, so neighbours share 28 rows; it answers with its own index. */
function strip(index: number, answer: (point: readonly number[]) => FootprintSample = () => accepted(index)): Strip & { asked: number } {
  const state = { asked: 0 };
  const frame = { id: `strip-${index}`, startTime: `t${index}`, filter: 'GREEN', positionKm: [index, 0, 0], cameraKind: 'kernels', geometrySource: 'source-mesh-rays',
    footprint: { pixelAngleMicroradians: 675, nadirMedianMeters: 1000 + index, nadirMinimumMeters: 900 + index, sampledPixels: 10 }, sample: (point: readonly number[]) => { state.asked++; return answer(point); },
    visible: (point: readonly number[]) => point[0] < 500, report: { id: `strip-${index}` } } as ObservationFrame;
  return { frame, camera: { project: point => [point[0], point[1] - 100 * index, point[2]] }, width: 1000, height: 128, get asked() { return state.asked; } };
}

test('a point is sampled in the strip that holds it deepest, and in its neighbour only when that one withholds it', () => {
  const band = stripFrame('green', [strip(0), strip(1), strip(2)], 'kernels');
  assert.equal(band.sample([10, 50, 1]).radiance, 0, 'rows 0 to 99 belong to the first strip alone');
  // Scene row 110 is 10 rows inside strip 1 and 17 from the far edge of strip 0: strip 0 holds it deeper.
  assert.equal(band.sample([10, 110, 1]).radiance, 0);
  assert.equal(band.sample([10, 120, 1]).radiance, 1, 'row 120 is 20 rows inside strip 1 and 7 from the edge of strip 0');
  assert.equal(band.sample([10, 250, 1]).radiance, 2);
  assert.deepEqual(band.sample([10, 400, 1]), { reason: 'outside-detector' }, 'no strip holds row 400');
  assert.deepEqual(band.sample([10, 50, -1]), { reason: 'outside-detector' }, 'behind every camera');
  const withholding = stripFrame('green', [strip(0, () => ({ reason: 'quality' })), strip(1)], 'kernels');
  assert.equal(withholding.sample([10, 110, 1]).radiance, 1, 'the neighbour answers where the deeper strip withholds the point');
  assert.deepEqual(withholding.sample([10, 50, 1]), { reason: 'quality' }, 'the withholding reason is kept when no other strip holds the point');
});

test('a band reports one frame for its strips', () => {
  const strips = [strip(0), strip(1), strip(2)], band = stripFrame('green', strips, 'kernels');
  assert.deepEqual(band.footprint, { pixelAngleMicroradians: 675, nadirMedianMeters: 1001, nadirMinimumMeters: 900, sampledPixels: 30 });
  assert.deepEqual([band.cameraKind, band.filter, band.positionKm, band.detector], ['kernels', 'GREEN', [1, 0, 0], undefined]);
  assert.equal(band.visible([10, 50, 1]), true); assert.equal(band.visible([600, 50, 1]), false); assert.equal(band.visible([10, 400, 1]), false);
  assert.throws(() => stripFrame('green', [], 'kernels'), /no strip that sees the body/u);
  // Neighbouring points are found from the strip that answered last, without asking every strip again.
  band.sample([10, 250, 1]); band.sample([11, 251, 1]);
  assert.deepEqual(strips.map(s => s.asked), [0, 0, 2]);
});

test('three bands make one colour sample, and one withheld band withholds the point', () => {
  const band = (value: number, reason?: string) => stripFrame(`b${value}`, [strip(0, () => reason ? { reason } : accepted(value))], 'kernels');
  const colour = bandSetFrame('image', [band(0.3), band(0.2), band(0.1)], 'kernels').sample([10, 50, 1]);
  assert.ok(colour.reason === undefined);
  assert.deepEqual(colour.color, [0.3, 0.2, 0.1]); assert.ok(Math.abs(colour.radiance - 0.2) < 1e-12);
  assert.deepEqual(bandSetFrame('image', [band(0.3), band(0.2, 'grazing'), band(0.1)], 'kernels').sample([10, 50, 1]), { reason: 'grazing' });
  assert.equal(bandSetFrame('image', [band(0.3), band(0.2), band(0.1)]).cameraKind, 'control-network', 'the controlled colour format keeps its camera kind');
});
