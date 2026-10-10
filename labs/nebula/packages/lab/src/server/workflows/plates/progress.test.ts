import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appendFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { foldProgress, progressPath, progressTail, progressWriter, withProgress } from './progress.ts';

const temporary = () => mkdtemp(join(tmpdir(), 'lab-progress-'));
const events = (root: string) => readFileSync(progressPath(root, 'demo'), 'utf8').trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);

test('a step writes its start, its stages and its result to the object\'s progress file', async () => {
  const root = await temporary();
  try {
    await withProgress(root, 'demo', 'draft', async stage => { stage('Baking a draft', .2); stage('Baking a draft', .2); stage('Baking a draft', .9); return { leaves: 3 }; });
    const lines = events(root);
    assert.deepEqual(lines.map(line => [line.stage ?? line.state, line.percent]), [['Starting', 0], ['Baking a draft', 20], ['Baking a draft', 90], ['done', 100]]);
    assert.ok(lines.every(line => line.object === 'demo' && line.step === 'draft' && line.pid === process.pid && line.job === lines[0]!.job));
    assert.deepEqual(lines.at(-1)!.result, { leaves: 3 });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a failed step and a cancelled step say so', async () => {
  const root = await temporary();
  try {
    await assert.rejects(withProgress(root, 'demo', 'bake', () => Promise.reject(new Error('prepare-image-layers failed (1).\nlong output'))));
    await assert.rejects(withProgress(root, 'demo', 'bake', () => Promise.reject(new DOMException('Plate bake cancelled.', 'AbortError'))));
    const ends = events(root).filter(line => line.state);
    assert.deepEqual(ends.map(line => [line.state, line.error]), [['failed', 'prepare-image-layers failed (1).'], ['cancelled', 'Plate bake cancelled.']]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the server tail folds only appended lines, keeps finished jobs briefly, and fails a job whose process is gone', async () => {
  const root = await temporary();
  try {
    const read = progressTail(root, () => ['demo', 'absent']);
    const writer = progressWriter(root, 'demo', 'draft');
    writer.stage('Restoring the registered photograph', .03);
    let jobs = await read();
    assert.deepEqual(jobs.map(job => [job.object, job.step, job.stage, job.percent, job.state]), [['demo', 'draft', 'Restoring the registered photograph', 3, 'running']]);
    writer.stage('Baking a draft', .2); writer.finish('done', { result: { leaves: 1 } });
    jobs = await read();
    assert.deepEqual(jobs.map(job => [job.percent, job.state]), [[100, 'done']]);
    assert.equal((await read(Date.now() + 60_000)).length, 0, 'a finished job leaves the strip');
    // A process that died mid-run (pid 0 is never alive) shows as failed once its death is seen.
    await appendFile(progressPath(root, 'demo'), JSON.stringify({ job: 'ghost', object: 'demo', step: 'bake', pid: 2 ** 30, at: new Date().toISOString(), stage: 'Baking', percent: 40 }) + '\n');
    jobs = await read();
    assert.deepEqual(jobs.filter(job => job.job === 'ghost').map(job => job.state), ['failed']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('malformed lines are skipped', () => {
  const jobs = foldProgress(new Map(), ['not json', '{"job":1}', JSON.stringify({ job: 'a', object: 'demo', step: 'verify', pid: 1, at: new Date().toISOString(), state: 'done' })]);
  assert.deepEqual([...jobs.values()].map(job => job.state), ['done']);
});
