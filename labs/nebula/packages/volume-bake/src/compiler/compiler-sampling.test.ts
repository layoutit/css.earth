import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { bakeCompiler, compilerSampling, type CompilerBakeResult } from './bake.ts';
import { readCompactCompiler } from '../compact-inputs/compiler.ts';
import { validateVolumeLayerSlices, type VolumeSlices } from '@cssearth/volume-core/contracts/volume-slices';

const boundsArcsec = { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] };

test('the actual compiler default creates a bounded plan without an opt-in sampling override', () => {
  let calls = 0;
  const sampling = compilerSampling({ boundsArcsec, sampleEmission(_x, _y, _z, out) { calls++; out[0] = out[1] = out[2] = .2; } });
  assert.ok(sampling.layerPlan, 'The default authoring path must use the optimizer.');
  assert.ok(sampling.layerOptimization);
  assert.equal(sampling.layerOptimization.maximumLayers, 500);
  assert.ok(sampling.sliceCounts.x + sampling.sliceCounts.y + sampling.sliceCounts.z <= 500);
  assert.equal(calls, 192 * 3 * 64 * 64 * 4 * 4, 'The real default probes every reference cell at four depth samples and four in-plane phases.');
  assert.deepEqual(sampling.layerPlan.referenceSliceCounts, { x: 192, y: 192, z: 192 });
});

test('actual accepted M42 sampling bypasses optimization with its historical omission unchanged', async () => {
  const compact = readCompactCompiler(JSON.parse(gunzipSync(await readFile('src/objects/m42/source/bake-inputs.json.gz')).toString()));
  const saved = compact.scene.sampling, before = JSON.stringify(saved);
  assert.equal(saved.layerPlan, undefined);
  const forbidden = () => { throw new Error('Historical replay must not probe or replan the source field.'); };
  const actual = compilerSampling({ boundsArcsec: compact.scene.boundsArcsec, sampling: saved,
    sampleEmission: forbidden, samplePlanningEmission: forbidden });
  assert.equal(JSON.stringify(actual), before);
  assert.equal('layerPlan' in actual, false);
  assert.notEqual(actual, saved);
  actual.sliceCounts.x++;
  assert.equal(JSON.stringify(saved), before, 'Replay must not mutate the accepted receipt.');
});

test('saved planned sampling is replayed exactly and rejects a mismatching retained count', () => {
  const sampling: CompilerBakeResult['sampling'] = { imageWidth: 512, samplesPerSlab: 4, sliceCounts: { x: 1, y: 1, z: 2 },
    layerPlan: { schema: 'cssearth-volume-layer-plan@1', referenceSliceCounts: { x: 4, y: 4, z: 4 }, referenceSamplesPerSlab: 4,
      axes: { x: [{ startCell: 0, endCell: 4 }], y: [{ startCell: 0, endCell: 4 }],
        z: [{ startCell: 0, endCell: 3 }, { startCell: 3, endCell: 4 }] } } };
  const sampleEmission = () => { throw new Error('Saved plans must not be recomputed.'); };
  assert.deepEqual(compilerSampling({ boundsArcsec, sampling, sampleEmission }), sampling);
  assert.throws(() => compilerSampling({ boundsArcsec, sampling: { ...sampling, sliceCounts: { x: 1, y: 1, z: 3 } }, sampleEmission }), /differs from/);
});

test('a small historical compiler replay keeps unreflected source geometry, sampling and physical intervals absent', async t => {
  const root = await mkdtemp(join(tmpdir(), 'legacy-compiler-sampling-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const compiled: VolumeSlices[] = [];
  const sampling = { sliceCounts: { x: 1, y: 1, z: 2 }, imageWidth: 512 as const, samplesPerSlab: 4 as const };
  const scene = await bakeCompiler({ root, outputDirectory: 'bake', id: 'historical', fieldIdentity: 'a'.repeat(64),
    boundsArcsec: { min: [10, 20, 30], max: [12, 22, 32] }, skyBoundsArcsec: { min: [10, 20], max: [12, 22] },
    sampling, preparedPhysical: false, samplePlanningEmission() { throw new Error('Saved replay must skip the optimizer.'); },
    sampleEmission(_x, _y, _z, out) { out[0] = out[1] = out[2] = .2; },
    lenses: [{ id: 'color', label: 'Color', sampleMaterial(_x, _y, z, out) {
      out[0] = z < 31 ? 255 : 0; out[1] = 0; out[2] = z < 31 ? 0 : 255; return true;
    } }], progress() {},
  }, { compileVolume({ frame, slices }) {
    assert.equal(frame.referenceFrame, 'lab-sky-angular');
    compiled.push(structuredClone(slices));
    return { resources: slices.quads.map(q => ({ path: q.texturePath, sha256: q.sha256, bytes: q.bytes })) };
  }, async prepareStarSprites() { return {}; } });
  assert.deepEqual(scene.sampling, sampling);
  assert.equal(scene.frame.referenceFrame, 'lab-sky-angular');
  assert.equal(compiled.length, 2);
  const neutral: VolumeSlices = JSON.parse(await readFile(join(root, 'bake/neutral/volume-slices.json'), 'utf8'));
  assert.equal(JSON.stringify(compiled[0]), JSON.stringify(neutral), 'Legacy serialized compile input is the saved source manifest with no frame or metadata conversion.');
  assert.equal(validateVolumeLayerSlices(neutral), undefined);
  assert.equal('layerPlan' in neutral.approximation, false);
  assert.ok(neutral.quads.every(q => !('slab' in q)));
  assert.deepEqual(neutral.quads.filter(q => q.axis === 'z').map(q => q.center[2]), [-.5, .5]);
  for (const bank of compiled) assert.deepEqual(bank.quads.filter(q => q.axis === 'z').map(q => q.center[2]), [-.5, .5]);
});
