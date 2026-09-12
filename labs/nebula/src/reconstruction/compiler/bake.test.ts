import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { sha256 } from '../../../../../src/preparation/volume/source.js';
import type { VolumeSliceQuad, VolumeSlices } from '../../../../../src/preparation/volume/slices.js';
import { compilerAlphaDigest, compilerFrame, compilerSliceCounts, verifyCompilerAlphaIdentity } from './bake.js';

function slices(path: string, bytes: Buffer): VolumeSlices {
  const quad: VolumeSliceQuad = { id: 'z-0', axis: 'z', sliceIndex: 0, texturePath: path, widthPx: 2, heightPx: 1,
    vertices: [[-1, 1, 0], [1, 1, 0], [1, -1, 0], [-1, -1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
    center: [0, 0, 0], normal: [0, 0, -1], sha256: sha256(bytes), bytes: bytes.length, alphaCoverage: .5 };
  return { quads: [quad], boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] }, provenance: {}, approximation: {
    method: 'fixture', radialEmission: 'None.', limitations: [], samplesPerSlab: 1, opticalWeight: 1, exposureGain: 1,
    sliceCounts: { x: 1, y: 1, z: 1 }, slabPitchUnits: { x: 2, y: 2, z: 2 } } };
}

test('compiler frame centers absolute west/north/away coordinates without changing their span', () => {
  const result = compilerFrame({ min: [10, -22, 80], max: [34, 8, 92] });
  assert.deepEqual(result.origin, [22, -7, 86]);
  assert.deepEqual(result.localBounds, { min: [-12, -15, -6], max: [12, 15, 6] });
  assert.deepEqual(result.frame.boundsUnits, result.localBounds);
  assert.equal(result.frame.referenceFrame, 'lab-sky-angular');
  assert.throws(() => compilerFrame({ min: [0, 0, 0], max: [1, 0, 1] }), /finite increasing/);
});

test('thin supported features receive finer equally spaced banks without an unbounded slice count', () => {
  const bounds = { min: [0, 0, 0] as [number, number, number], max: [960, 480, 120] as [number, number, number] };
  const baseline = compilerSliceCounts(bounds), fine = compilerSliceCounts(bounds, 2);
  assert.deepEqual(baseline, { x: 192, y: 96, z: 24 });
  assert.deepEqual(fine, { x: 512, y: 256, z: 64 });
  assert.equal(bounds.max[0] / fine.x, bounds.max[2] / fine.z);
  assert.ok(fine.z > baseline.z * 2, 'Thin fronts must not retain the coarse depth stack.');
  assert.deepEqual(compilerSliceCounts(bounds, 1000), baseline);
  for (const scale of [0, -1, NaN, Infinity]) assert.throws(() => compilerSliceCounts(bounds, scale), /sampling/);
});

test('compiler alpha handoff checks decoded bytes, including transparent texels', async t => {
  const root = await mkdtemp(join(tmpdir(), 'compiler-alpha-')); t.after(() => rm(root, { recursive: true, force: true }));
  const reference = join(root, 'reference'), same = join(root, 'same'), changed = join(root, 'changed');
  for (const directory of [reference, same, changed]) await mkdir(join(directory, 'slices'), { recursive: true });
  const image = (secondAlpha: number) => sharp(Buffer.from([255, 255, 255, 0, 10, 20, 30, secondAlpha]),
    { raw: { width: 2, height: 1, channels: 4 } }).png().toBuffer();
  const expected = await image(173), identical = await image(173), mutation = await image(172);
  await writeFile(join(reference, 'slices/a.png'), expected); await writeFile(join(same, 'slices/a.png'), identical);
  await writeFile(join(changed, 'slices/a.png'), mutation);
  const digest = await compilerAlphaDigest(reference, slices('slices/a.png', expected));
  assert.match(digest, /^[a-f0-9]{64}$/);
  await verifyCompilerAlphaIdentity(digest, same, slices('slices/a.png', identical));
  await assert.rejects(verifyCompilerAlphaIdentity(digest, changed, slices('slices/a.png', mutation)), /changed the shared alpha/);
});
