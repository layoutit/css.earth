import assert from 'node:assert/strict';
import test from 'node:test';
import { combineEvidence } from './combine.js';
import { buildRidgeGraph } from './ridge-graph.js';
import type { EvidenceInputs, EvidenceSource } from './model.js';
import { readRidgeGraphSettings } from './ridge-model.js';

function fixture(size = 64, count = 2): EvidenceInputs {
  const sources: EvidenceSource[] = Array.from({ length: count }, (_, index) => ({ id: `source-${index}`, label: `Band ${index}`, sourceSha256: 'a'.repeat(64),
    mapSha256: 'b'.repeat(64), sourcePanelSha256: 'c'.repeat(64), imageToFrame: [1, 0, 0, 1, 0, 0], workingWidth: size, workingHeight: size,
    registeredRgba: new Uint8Array(size * size * 4), footprint: new Uint8Array(size * size).fill(1),
    channels: { broad: { signal: new Float32Array(size * size), coverage: new Uint8Array(size * size).fill(1), noiseSigma: 1 },
      ridges: { signal: new Float32Array(size * size), coverage: new Uint8Array(size * size).fill(1), noiseSigma: 1 },
      compact: { signal: new Float32Array(size * size), coverage: new Uint8Array(size * size).fill(1), noiseSigma: 1 } },
    ridgeDirectionX: new Float32Array(size * size), ridgeDirectionY: new Float32Array(size * size), samplingArcseconds: 2,
  }));
  return { identity: 'synthetic-ridges', grid: { width: size, height: size, frameWidth: size, frameHeight: size, originX: 0, originY: 0, extentWidth: size, extentHeight: size,
    fieldArcminutes: [size / 30, size / 30], arcsecondsPerPixel: 2 }, sources,
    method: { version: 'test', scaleArcseconds: [2, 4, 8, 16, 32], samplingLimitation: 'fixture', normalization: 'fixture', boundary: 'fixture' } };
}
function paint(inputs: EvidenceInputs, source: number, x: number, y: number, tangent: [number, number] = [1, 0]) {
  const s = inputs.sources[source], p = y * inputs.grid.width + x; s.channels.ridges.signal[p] = 12; s.ridgeDirectionX[p] = tangent[0]; s.ridgeDirectionY[p] = tangent[1];
}
function graph(inputs: EvidenceInputs, minLengthArcseconds = 0) {
  return buildRidgeGraph(inputs, combineEvidence(inputs, { channel: 'ridges', weights: inputs.sources.map(() => 1), sensitivity: 1 }), { threshold: .2, minLengthArcseconds });
}

test('crossing ridges split into four supported branches and retain independent source tangents', () => {
  const inputs = fixture();
  for (let p = 12; p <= 52; p++) { paint(inputs, 0, p, 32); paint(inputs, 1, 32, p, [0, 1]); }
  const result = graph(inputs);
  assert.equal(result.nodes.filter(node => node.kind === 'junction').length, 1);
  assert.equal(result.nodes.filter(node => node.kind === 'endpoint').length, 4);
  assert.equal(result.polylines.length, 4);
  const center = result.nodes.find(node => node.kind === 'junction')!;
  assert.equal(center.x, 32.5); assert.equal(center.y, 32.5); assert.equal(center.supportMask, 3);
  assert.deepEqual(center.sourceTangents, [[1, 0], [0, 1]]); assert.equal(center.agreement, 0);
  assert.ok(result.polylines.every(line => line.from === center.id || line.to === center.id));
  assert.deepEqual(graph(inputs), result);
});
test('unsupported gaps and no-data strips remain disconnected, including misleading unmasked scores', () => {
  const inputs = fixture();
  for (let x = 8; x <= 55; x++) paint(inputs, 0, x, 32);
  for (let x = 30; x <= 34; x++) {
    const p = 32 * 64 + x; inputs.sources[0].channels.ridges.coverage[p] = 0; inputs.sources[0].footprint[p] = 0;
  }
  const combined = combineEvidence(inputs, { channel: 'ridges', weights: [1, 1], sensitivity: 1 });
  // Even a stale combined score cannot override its source no-data boundary.
  for (let x = 30; x <= 34; x++) { const p = 32 * 64 + x; combined.union[p] = .9; combined.planes[0][p] = .9; combined.coverage[0][p] = 1; }
  const result = buildRidgeGraph(inputs, combined, { threshold: .2, minLengthArcseconds: 0 });
  assert.equal(result.diagnostics.retainedComponents, 2); assert.equal(result.polylines.length, 2);
  for (const line of result.polylines) assert.ok(line.points.every(p => p.x < 30 || p.x > 35));
  assert.ok(result.polylines.every(line => Math.max(...line.points.map(p => p.x)) < 30 || Math.min(...line.points.map(p => p.x)) > 35));
});
test('single-band ridge remains while unavailable versus eligible zero support stays distinct', () => {
  const inputs = fixture(); for (let x = 8; x < 55; x++) paint(inputs, 0, x, 30);
  for (let x = 8; x < 32; x++) { const p = 30 * 64 + x; inputs.sources[1].footprint[p] = 0; inputs.sources[1].channels.ridges.coverage[p] = 0; }
  const result = graph(inputs), points = result.polylines[0].points;
  assert.equal(result.polylines.length, 1); assert.ok(points.every(p => p.supportMask === 1));
  assert.ok(points.filter(p => p.x < 32).every(p => p.sourceValues[1] === null && p.observedMask === 1));
  assert.ok(points.filter(p => p.x > 32).every(p => p.sourceValues[1] === 0 && p.observedMask === 3));
  assert.equal(result.polylines[0].sourceSupport[0].supportedFraction, 1);
  assert.equal(result.polylines[0].sourceSupport[1].supportedFraction, 0);
});
test('thick supports become connected pixel-center traces and closed rings retain their loops', () => {
  const inputs = fixture();
  for (let y = 28; y <= 36; y++) for (let x = 9; x <= 54; x++) paint(inputs, 0, x, y);
  const straight = graph(inputs);
  assert.equal(straight.polylines.length, 1);
  assert.ok(straight.polylines[0].points.every(p => p.y >= 31.5 && p.y <= 33.5));
  assert.ok(straight.diagnostics.skeletonPixels < straight.diagnostics.thresholdPixels / 3);
  const ring = fixture();
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const radius = Math.hypot(x - 32, y - 32); if (radius >= 16 && radius <= 20) paint(ring, 0, x, y, [-(y - 32) / radius, (x - 32) / radius]);
  }
  const closed = graph(ring); assert.equal(closed.polylines.length, 1); assert.equal(closed.nodes[0].kind, 'loop');
  assert.equal(closed.polylines[0].closed, true);
  assert.deepEqual(closed.polylines[0].points[0], closed.polylines[0].points.at(-1));
});
test('angular component pruning keeps short crossing branches and never creates polyline shortcuts', () => {
  const inputs = fixture();
  for (let x = 8; x <= 50; x++) paint(inputs, 0, x, 30);
  for (let y = 28; y <= 35; y++) paint(inputs, 0, 30, y, [0, 1]);
  for (let x = 4; x <= 8; x++) paint(inputs, 1, x, 8);
  const result = graph(inputs, 30);
  assert.equal(result.diagnostics.retainedComponents, 1); assert.equal(result.diagnostics.discardedComponents, 1);
  assert.equal(result.polylines.length, 4); assert.ok(result.polylines.some(line => line.lengthArcseconds < 30));
  for (const line of result.polylines) {
    assert.equal(line.lengthArcseconds, line.lengthPixels * 2);
    for (let i = 1; i < line.points.length; i++) assert.ok(Math.hypot(line.points[i].x - line.points[i - 1].x, line.points[i].y - line.points[i - 1].y) <= Math.SQRT2 + 1e-9);
  }
});
test('graph rejects non-ridge combinations and invalid controls', () => {
  const inputs = fixture();
  assert.throws(() => buildRidgeGraph(inputs, combineEvidence(inputs, { channel: 'all', weights: [1, 1], sensitivity: 1 })));
  for (const settings of [{ threshold: 0, minLengthArcseconds: 1 }, { threshold: .2, minLengthArcseconds: NaN }, { threshold: 1.1, minLengthArcseconds: 0 }])
    assert.throws(() => readRidgeGraphSettings(settings));
});
