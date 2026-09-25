import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseReconstructionRequest, reconstructionCatalogue } from './density-reconstruction.ts';
import { defaultOverlayPlacement } from '@cssearth/bake/volume';
import { createStarRemovalJobs } from '../jobs/operation-jobs.ts';

const request = { action: 'apply', subjectId: 'lmc-clouds', imageId: 'horalek-widefield',
  removalResultId: `${'a'.repeat(64)}.${'b'.repeat(64)}`, placement: defaultOverlayPlacement() };
test('the catalogue restores the newest completed placement, independent of hash ordering', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-reconstruction-order-'));
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  async function save(path: string, value: unknown) {
    const text = JSON.stringify(value), full = join(root, path);
    await mkdir(dirname(full), { recursive: true }); await writeFile(full, text); return hash(text);
  }
  try {
    const source = 'c'.repeat(64), removal = 'd'.repeat(64), overlay = 'labs/nebula/models/lmc/candidates';
    await save('labs/nebula/packages/lab/src/state/subjects.json', [{ id: request.subjectId, density: { overlays: `${overlay}/overlays.json`, processingPlan: 'processing/plan.json' } }]);
    await save('catalogue.json', { targets: [{ directory: overlay, images: [{ id: request.imageId, label: 'Test', sha256: source }] }] });
    const alignmentSha = await save('alignment.json', { pass: false });
    await save('processing/plan.json', { catalogue: 'catalogue.json', alignmentReport: { path: 'alignment.json', sha256: alignmentSha } });
    await save(`${overlay}/overlays.json`, { overlays: [{ id: request.imageId, style: { transform: '' } }] });
    const removalPath = `.local/nebula-lab/star-removal-nox-applied/${removal}`;
    await save(`${removalPath}/request.json`, { source: { sha256: source } });
    const removalSha = await save(`${removalPath}/result.json`, { operation: 'apply' });
    const newest = '1'.repeat(64), oldest = 'f'.repeat(64);
    for (const id of [newest, oldest]) {
      const directory = `.local/nebula-lab/reconstructions/${id}`;
      const sha256 = await save(`${directory}/volume.json`, { data: { resources: [] } });
      await save(`${directory}/object.json`, { id: `reconstruction-${id}`, type: 'density-volume', prepared: { url: 'volume.json', sha256 } });
      await save(`${directory}/result.json`, { schema: 'cssearth-nebula-reconstruction@1', resultId: id, imageId: request.imageId,
        removalResultId: `${removal}.${removalSha}`, placement: { ...request.placement, scale: id === newest ? 2 : 1 },
        subject: { id: `reconstruction-${id}`, directory } });
      const time = new Date(id === newest ? '2026-09-09' : '2026-09-08');
      await utimes(join(root, directory, 'result.json'), time, time);
    }
    const candidate = (await reconstructionCatalogue(root, request.subjectId)).candidates[0]!;
    assert.equal(candidate.prepared?.resultId, newest);
    assert.equal(candidate.prepared?.placement.scale, 2);
    await save('labs/nebula/packages/lab/src/state/subjects.json', [{ id: request.subjectId, density: { overlays: `${overlay}/overlays.json` } }]);
    await assert.rejects(reconstructionCatalogue(root, request.subjectId), /no configured density processing plan/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('reconstruction requires an explicit operation, a completed removal identity and finite alignment', () => {
  assert.deepEqual(parseReconstructionRequest(request), request);
  const appearance = { brightness: 1, gamma: 1, saturation: 1.3, detailStrength: 1, detailScale: 24 };
  assert.deepEqual(parseReconstructionRequest({ ...request, appearance }).appearance, appearance);
  assert.throws(() => parseReconstructionRequest({ ...request, appearance: { ...appearance, detailScale: NaN } }));
  for (const invalid of [{ ...request, action: 'overview' }, { ...request, removalResultId: '' },
    { ...request, placement: { ...request.placement, scale: 0 } }, { ...request, source: '/arbitrary/photo.png' }])
    assert.throws(() => parseReconstructionRequest(invalid), TypeError);
});
test('reconstruction jobs survive observers independently of the star-removal job namespace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-reconstruction-jobs-')); let calls = 0;
  const options = { namespace: 'reconstruction', parseRequest: parseReconstructionRequest,
    sample: async () => { calls++; return { ready: true }; }, validateResult: async () => {} };
  const jobs = createStarRemovalJobs(root, options);
  try {
    const input = { requestId: randomUUID(), request };
    const first = await jobs.start(input); await jobs.idle();
    assert.equal((await jobs.get(first.id)).status, 'completed');
    const restored = createStarRemovalJobs(root, options);
    assert.equal((await restored.start(input)).status, 'completed'); assert.equal(calls, 1);
    const removal = createStarRemovalJobs(root, { ...options, namespace: 'star-removal-nox' });
    await assert.rejects(removal.get(first.id), /unavailable/);
    await restored.shutdown(); await removal.shutdown();
  } finally { await jobs.shutdown(); await rm(root, { recursive: true, force: true }); }
});
