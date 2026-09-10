import assert from 'node:assert/strict';
import test from 'node:test';
import { decomposeStructures, linkStructureParents, type StructureRegion,
  type WaveletSettings } from './structure-wavelets.js';

const settings: WaveletSettings = {
  scales: 5,
  significanceSigma: 3,
  compactMaxScale: 2,
  elongatedAxisRatio: 2.5,
  minRegionPixels: 4,
  connectivity: 8,
  noiseSigma: .01,
};

test('starlet analysis and conservative assignments reconstruct nonnegative luminance', () => {
  const width = 31;
  const height = 23;
  const source = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    source[y * width + x] = .05 + .003 * x + .002 * y + ((x * 17 + y * 11) % 7 - 3) * .001;
  }
  source[7 * width + 9] += 2;
  source[7 * width + 10] += 1;
  const result = decomposeStructures(source, width, height, settings);
  assert.equal(result.waveletPlanes.length, settings.scales);
  for (let pixel = 0; pixel < source.length; pixel++) {
    let analysis = result.coarse[pixel]!;
    for (const plane of result.waveletPlanes) analysis += plane[pixel]!;
    assert.ok(Math.abs(analysis - source[pixel]!) < 2e-6);
    const { diffuse, compact, elongated, residual } = result.components;
    assert.ok(diffuse[pixel]! >= 0 && compact[pixel]! >= 0 && elongated[pixel]! >= 0);
    assert.ok(Math.abs(diffuse[pixel]! + compact[pixel]! + elongated[pixel]! + residual[pixel]! -
      source[pixel]!) < 2e-6);
  }
  assert.ok(result.diagnostics.assignedSum > 0);
  assert.ok(Math.abs(result.diagnostics.assignedSum + result.diagnostics.residualSum -
    result.diagnostics.inputSum) < 1e-4);
});

test('automatic regions distinguish a compact knot and an elongated filament deterministically', () => {
  const width = 64;
  const height = 48;
  const source = new Float32Array(width * height).fill(.02);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    source[y * width + x] += 4 * Math.exp(-.5 * ((x - 14) ** 2 + (y - 13) ** 2));
    if (x >= 28 && x <= 55) source[y * width + x] += 2.5 * Math.exp(-.5 * ((y - 32) / .7) ** 2);
  }
  const first = decomposeStructures(source, width, height, settings);
  const second = decomposeStructures(source, width, height, settings);
  const compact = first.catalog.find(region => region.morphology === 'compact' &&
    Math.hypot(region.centroid[0] - 14, region.centroid[1] - 13) < 3);
  const filament = first.catalog.find(region => region.morphology === 'elongated' &&
    region.bounds.minX <= 30 && region.bounds.maxX >= 53 && Math.abs(region.centroid[1] - 32) < 2);
  assert.ok(compact, 'compact knot is catalogued near its source coordinates');
  assert.ok(filament, 'long connected filament is catalogued as elongated morphology');
  assert.ok(filament.axisLengths[0] / Math.max(.5, filament.axisLengths[1]) >= 2.5);
  assert.deepEqual(first.catalog.map(region => [region.id, region.parentId, region.morphology,
    region.bounds, region.centroid]), second.catalog.map(region => [region.id, region.parentId,
    region.morphology, region.bounds, region.centroid]));
  assert.ok(first.components.compact.reduce((sum, value) => sum + value, 0) > 0);
  assert.ok(first.components.elongated.reduce((sum, value) => sum + value, 0) > 0);
});

test('reflection keeps boundary structure local and translated features retain coordinates', () => {
  const width = 40;
  const height = 20;
  const atEdge = new Float32Array(width * height);
  for (let y = 7; y <= 10; y++) for (let x = 0; x <= 3; x++) atEdge[y * width + x] = 1;
  const edge = decomposeStructures(atEdge, width, height, { ...settings, scales: 3 });
  assert.ok(edge.catalog.some(region => region.bounds.minX === 0 && region.centroid[0] < 4));
  assert.ok(edge.catalog.every(region => region.bounds.maxX < width - 4), 'reflection does not wrap support');

  const shifted = new Float32Array(width * height);
  for (let y = 7; y <= 10; y++) for (let x = 9; x <= 12; x++) shifted[y * width + x] = 1;
  const translated = decomposeStructures(shifted, width, height, { ...settings, scales: 3 });
  const edgeFine = edge.catalog.find(region => region.scale === 0)!;
  const shiftedFine = translated.catalog.find(region => region.scale === 0)!;
  assert.ok(Math.abs((shiftedFine.centroid[0] - edgeFine.centroid[0]) - 9) < 1);
  assert.ok(edge.diagnostics.maxAnalysisReconstructionError < 1e-6);
});

test('parent links require actual support overlap rather than bounding-box containment', () => {
  const region = (id: string, scale: number, support: number[], bounds: StructureRegion['bounds']): StructureRegion => ({
    id,
    scale,
    support: Uint32Array.from(support),
    bounds,
    morphology: 'compact',
    centroid: [2, 2],
    axisLengths: [1, 1],
    orientationDeg: 0,
    peakCoefficient: 1,
    integratedCoefficient: 1,
  });
  const child = region('s0-0000', 0, [12], { minX: 2, minY: 2, maxX: 2, maxY: 2 });
  const hollow = region('s1-0000', 1, [0, 4, 20, 24], { minX: 0, minY: 0, maxX: 4, maxY: 4 });
  linkStructureParents([child, hollow]);
  assert.equal(child.parentId, undefined);
  const overlapping = region('s1-0001', 1, [7, 12, 17], { minX: 2, minY: 1, maxX: 2, maxY: 3 });
  linkStructureParents([child, hollow, overlapping]);
  assert.equal(child.parentId, overlapping.id);
});
