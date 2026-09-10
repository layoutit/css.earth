import assert from 'node:assert/strict';
import test from 'node:test';
import { bakePhotoConstrainedEmission } from './photo-emission.js';

const voxel = (x: number, y: number, z: number, width: number, height: number): number =>
  (z * height + y) * width + x;

test('photo emission preserves column signal while particles determine depth', async () => {
  const dimensions: [number, number, number] = [3, 2, 3];
  const density = new Float64Array(18);
  density[voxel(0, 0, 0, 3, 2)] = 1;
  density[voxel(0, 0, 1, 3, 2)] = 3;
  density[voxel(1, 0, 0, 3, 2)] = 40;
  // x=2 remains empty despite the photograph having signal there.
  const rgba = new Uint8Array(3 * 2 * 4);
  for (let pixel = 0; pixel < 6; pixel++) rgba.set([128, 64, 32, 200], 4 * pixel);

  const result = await bakePhotoConstrainedEmission({
    density,
    dimensions,
    boundsKpc: { min: [-1.5, -1, -3], max: [1.5, 1, 3] },
    photo: { rgba, width: 3, height: 2 },
    projection: { centerKpc: [0, 0], spanKpc: [3, 2] },
    edgeFeatherFraction: 0,
    columnDensityFloorFraction: 0,
    columnDensityFullSignalFraction: 0.0001,
    exposureGain: 1,
  });

  const expectedDisplay = [128, 64, 32].map(channel => channel / 255 * 200 / 255);
  const expectedPeakOptical = -Math.log(1 - expectedDisplay[0]!);
  const expectedOptical = expectedDisplay.map(channel =>
    expectedPeakOptical * channel / expectedDisplay[0]!);
  for (const x of [0, 1]) {
    for (let channel = 0; channel < 3; channel++) {
      let integrated = 0;
      for (let z = 0; z < 3; z++) {
        integrated += 2 * result.emissionPerKpc[3 * voxel(x, 0, z, 3, 2) + channel]!;
      }
      assert.ok(Math.abs(integrated - expectedOptical[channel]!) < 1e-6);
      const sharedOpacityComposite = integrated / expectedPeakOptical *
        (1 - Math.exp(-expectedPeakOptical));
      assert.ok(Math.abs(sharedOpacityComposite - expectedDisplay[channel]!) < 1e-6);
    }
  }
  assert.ok(
    result.emissionPerKpc[3 * voxel(0, 0, 1, 3, 2)]! >
    result.emissionPerKpc[3 * voxel(0, 0, 0, 3, 2)]!,
  );
  assert.ok(result.emissionPerKpc[3 * voxel(1, 0, 0, 3, 2)]! > 0);
  assert.equal(result.emissionPerKpc[3 * voxel(1, 0, 1, 3, 2)]!, 0);
  for (let z = 0; z < 3; z++) {
    for (let channel = 0; channel < 3; channel++) {
      assert.equal(result.emissionPerKpc[3 * voxel(2, 0, z, 3, 2) + channel]!, 0);
    }
  }
  assert.equal(result.diagnostics.zeroDensityPhotoColumns, 4);
  assert.ok(result.diagnostics.maxColumnOpticalError < 1e-6);
});

test('optional local contrast narrows detail without changing column emission', async () => {
  const dimensions: [number, number, number] = [3, 1, 5];
  const density = new Float64Array(15).fill(1);
  const rgba = new Uint8Array([
    20, 20, 20, 255,
    200, 200, 200, 255,
    20, 20, 20, 255,
  ]);
  const common = {
    density,
    dimensions,
    boundsKpc: { min: [0, 0, -2.5] as [number, number, number], max: [3, 1, 2.5] as [number, number, number] },
    photo: { rgba, width: 3, height: 1 },
    projection: { centerKpc: [1.5, .5] as [number, number], spanKpc: [2, 1] as [number, number] },
    edgeFeatherFraction: 0,
    columnDensityFloorFraction: 0,
    columnDensityFullSignalFraction: .0001,
  };
  const broad = await bakePhotoConstrainedEmission(common);
  const concentrated = await bakePhotoConstrainedEmission({
    ...common,
    detail: { spatialSigmaKpc: .5, depthSigmaKpc: .5, contrastStrength: 4 },
  });
  const column = (result: typeof broad, x: number): number[] => Array.from({ length: 5 }, (_, z) =>
    result.emissionPerKpc[3 * voxel(x, 0, z, 3, 1)]!);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const variance = (values: number[]) => values.reduce((total, value, z) =>
    total + value * (z - 2) ** 2, 0) / sum(values);
  assert.ok(Math.abs(sum(column(broad, 1)) - sum(column(concentrated, 1))) < 1e-6,
    'detail redistribution preserves the optical column target');
  assert.ok(variance(column(concentrated, 1)) < .5 * variance(column(broad, 1)),
    'positive local contrast follows a narrower density-supported depth profile');
  for (let z = 0; z < 5; z++) {
    assert.ok(Math.abs(column(concentrated, 0)[z]! - column(broad, 0)[z]!) < 1e-7,
      'non-positive local contrast retains the broad conditional density');
  }
  assert.ok((concentrated.diagnostics.detail?.activeColumns ?? 0) > 0);
  assert.ok((concentrated.diagnostics.detail?.opticalFraction ?? 0) > 0);
});

test('photo emission softly gates image edges and low-density tails', async () => {
  const dimensions: [number, number, number] = [5, 3, 1];
  const density = new Float64Array(15).fill(1);
  density[voxel(4, 1, 0, 5, 3)] = 0.001;
  const rgba = new Uint8Array(5 * 3 * 4).fill(255);
  const result = await bakePhotoConstrainedEmission({
    density,
    dimensions,
    boundsKpc: { min: [-2.5, -1.5, -0.5], max: [2.5, 1.5, 0.5] },
    photo: { rgba, width: 5, height: 3 },
    projection: { centerKpc: [0, 0], spanKpc: [5, 3] },
    edgeFeatherFraction: 0.2,
    columnDensityFloorFraction: 0.005,
    columnDensityFullSignalFraction: 0.02,
  });
  const edge = result.emissionPerKpc[3 * voxel(0, 1, 0, 5, 3)]!;
  const centre = result.emissionPerKpc[3 * voxel(2, 1, 0, 5, 3)]!;
  assert.ok(edge > 0 && edge < centre);
  assert.equal(result.emissionPerKpc[3 * voxel(4, 1, 0, 5, 3)]!, 0);
  assert.ok(Number.isFinite(result.diagnostics.recommendedEncodingScale));
  assert.ok(result.diagnostics.recommendedEncodingScale >= 1);
});

test('photo emission rejects invalid density instead of producing non-finite output', async () => {
  await assert.rejects(
    bakePhotoConstrainedEmission({
      density: new Float64Array([Number.NaN]),
      dimensions: [1, 1, 1],
      boundsKpc: { min: [0, 0, 0], max: [1, 1, 1] },
      photo: { rgba: new Uint8Array([255, 255, 255, 255]), width: 1, height: 1 },
      projection: { centerKpc: [0.5, 0.5], spanKpc: [1, 1] },
    }),
    /finite nonnegative/,
  );
});
