import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { createStarRemovalJobs, starRemovalJobsHandler } from './star-removal-job-server.js';
import { parseRemovalRequest } from './star-removal-preparation.js';

const request = { imageId: 'test-photo', action: 'apply' };
async function until<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) { const value = await read(); if (done(value)) return value; await delay(20); }
  throw new Error('Expected durable job side effect did not appear.');
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'nebula-removal-jobs-'));
  const png = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#245678' } }).png().toBuffer();
  let calls = 0; const pids: number[] = [];
  const options: Parameters<typeof createStarRemovalJobs>[1] = {
    parseRequest: parseRemovalRequest,
    sample: async (_request, signal, progress) => {
      const output = join(root, `output-${++calls}.png`);
      await new Promise<void>((done, reject) => {
        const child = spawn(process.execPath, ['-e', `const fs=require('node:fs');
          process.stdout.write('started\\n');
          setTimeout(()=>{fs.writeFileSync(process.argv[1],Buffer.from(process.argv[2],'base64'));},700);`, output, png.toString('base64')]);
        pids.push(child.pid!);
        child.stdout.once('data', () => progress({ stage: 'removing-stars', current: 1, total: 2, message: 'Measured first native tile.' }));
        const cancel = () => { child.kill('SIGKILL'); }; signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) cancel();
        child.once('error', reject);
        child.once('exit', (code, killed) => { signal.removeEventListener('abort', cancel);
          if (signal.aborted) reject(new DOMException('Cancelled', 'AbortError'));
          else if (code !== 0 || killed) reject(new Error('Synthetic child failed.')); else done(); });
      });
      return { output };
    },
    validateResult: async result => {
      const bytes = await readFile((result as { output: string }).output); assert.deepEqual(bytes, png);
      assert.equal((await sharp(bytes).metadata()).width, 8);
    },
  };
  const jobs = createStarRemovalJobs(root, options), server = createServer(starRemovalJobsHandler(jobs));
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/__nebula/star-removal-jobs`;
  const post = (path: string, input: unknown) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  return { root, options, jobs, url, post, pids, calls: () => calls, close: async () => {
    await jobs.shutdown(); await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    await rm(root, { recursive: true, force: true });
  } };
}

test('Apply survives a discarded HTTP response and fresh observers; persisted request identity starts exactly one real child', async () => {
  const f = await fixture(), requestId = randomUUID();
  try {
    // The client persists requestId before POST, then loses the response while navigating away.
    await new Promise<void>((done, reject) => {
      const post = httpRequest(f.url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, response => {
        assert.equal(response.statusCode, 202); response.destroy(); done();
      });
      post.once('error', reject); post.end(JSON.stringify({ requestId, request }));
    });
    const saved = JSON.parse(await readFile(join(f.root, '.local/nebula-lab/star-removal-nox-jobs', `${requestId}.json`), 'utf8'));
    assert.deepEqual(saved.request, request); assert.equal(saved.id, requestId, 'record exists before the start response');
    const read = async () => (await (await fetch(`${f.url}/${requestId}`)).json()).job;
    const progress = await until(read, job => Boolean(job.progress));
    assert.equal(progress.progress.current, 1); assert.equal(progress.progress.total, 2);
    assert.doesNotThrow(() => process.kill(f.pids[0], 0), 'the worker is still running without its first observer');
    const reattached = await f.post('', { requestId, request }); assert.equal(reattached.status, 202); await reattached.json();
    const mismatch = await f.post('', { requestId, request: { ...request, imageId: 'different-photo' } });
    assert.equal(mismatch.status, 409); await mismatch.text();
    const completed = await until(read, job => job.status === 'completed');
    assert.ok((await readFile(completed.result.output)).length > 0); assert.equal(f.calls(), 1);
    await f.jobs.idle();
    const restarted = createStarRemovalJobs(f.root, f.options);
    assert.deepEqual(await restarted.get(requestId), completed);
    assert.equal((await restarted.start({ requestId, request })).status, 'completed'); assert.equal(f.calls(), 1);
    await writeFile(completed.result.output, 'altered saved artifact');
    const unavailable = await restarted.get(requestId);
    assert.equal(unavailable.status, 'failed'); assert.match(unavailable.error!, /^Saved result unavailable:/); assert.equal(unavailable.result, undefined);
    await restarted.shutdown();
  } finally { await f.close(); }
});

test('GET of a completed job with unavailable artifacts returns a persisted terminal state without launching work', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-removal-unavailable-')), id = randomUUID();
  const directory = join(root, '.local/nebula-lab/star-removal-nox-jobs');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${id}.json`), JSON.stringify({ schema: 'cssearth-star-removal-job@1', id,
    imageId: request.imageId, request, status: 'completed', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', result: { output: 'missing.png' } }));
  let launches = 0;
  const jobs = createStarRemovalJobs(root, { parseRequest: parseRemovalRequest,
    sample: async () => { launches++; throw new Error('GET must never launch a worker.'); },
    validateResult: async () => { await readFile(join(root, 'missing.png')); } });
  const server = createServer(starRemovalJobsHandler(jobs));
  try {
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/__nebula/star-removal-jobs/${id}`;
    const response = await fetch(url); assert.equal(response.status, 200);
    const { job } = await response.json();
    assert.equal(job.id, id); assert.equal(job.status, 'failed'); assert.match(job.error, /^Saved result unavailable:/); assert.equal(job.result, undefined);
    assert.deepEqual((await (await fetch(url)).json()).job, job);
    assert.deepEqual(await jobs.start({ requestId: id, request }), job); assert.equal(launches, 0);
    const saved = JSON.parse(await readFile(join(directory, `${id}.json`), 'utf8'));
    assert.equal(saved.status, 'failed'); assert.equal(saved.result, undefined); assert.deepEqual(saved.request, request);
  } finally {
    await jobs.shutdown(); await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    await rm(root, { recursive: true, force: true });
  }
});

test('only explicit Cancel stops the child; cancellation persists and neither polling nor repeated start retries it', async () => {
  const f = await fixture(), requestId = randomUUID();
  try {
    assert.equal((await f.post('', { requestId, request })).status, 202);
    await until(() => f.jobs.get(requestId), job => Boolean(job.progress));
    const cancelled = await f.post(`/${requestId}/cancel`, {}); assert.equal(cancelled.status, 200); await cancelled.json();
    await f.jobs.idle(); assert.equal((await f.jobs.get(requestId)).status, 'cancelled');
    assert.throws(() => process.kill(f.pids[0], 0), /ESRCH/);
    await assert.rejects(readFile(join(f.root, 'output-1.png')), /ENOENT/);
    assert.equal((await f.jobs.start({ requestId, request })).status, 'cancelled'); assert.equal(f.calls(), 1);
    const saved = JSON.parse(await readFile(join(f.root, '.local/nebula-lab/star-removal-nox-jobs', `${requestId}.json`), 'utf8'));
    assert.equal(saved.status, 'cancelled');
  } finally { await f.close(); }
});

test('unfinished jobs become honestly interrupted on restart and shutdown, without automatic work', async () => {
  const f = await fixture(), requestId = randomUUID();
  try {
    await f.jobs.start({ requestId, request }); await until(() => f.jobs.get(requestId), job => Boolean(job.progress));
    await f.jobs.shutdown(); assert.equal((await f.jobs.get(requestId)).status, 'interrupted');
    assert.throws(() => process.kill(f.pids[0], 0), /ESRCH/);
    const interruptedId = randomUUID(), directory = join(f.root, '.local/nebula-lab/star-removal-nox-jobs');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, `${interruptedId}.json`), JSON.stringify({ schema: 'cssearth-star-removal-job@1', id: interruptedId,
      imageId: request.imageId, request, status: 'running', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }));
    const restarted = createStarRemovalJobs(f.root, f.options);
    assert.equal((await restarted.get(interruptedId)).status, 'interrupted');
    assert.equal((await restarted.start({ requestId: interruptedId, request })).status, 'interrupted'); assert.equal(f.calls(), 1);
    await assert.rejects(restarted.start({ requestId: randomUUID(), request: { ...request, action: 'survey' } }), TypeError);
    await assert.rejects(restarted.get('../unsafe'), TypeError);
    await restarted.shutdown();
  } finally { await f.close(); }
});

test('legacy manual job records cannot block the automatic NOX job namespace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-nox-legacy-jobs-')), id = randomUUID();
  const legacy = join(root, '.local/nebula-lab/star-removal-jobs');
  await mkdir(legacy, { recursive: true });
  await writeFile(join(legacy, `${id}.json`), '{invalid legacy request');
  const jobs = createStarRemovalJobs(root, { parseRequest: parseRemovalRequest,
    sample: async () => ({ done: true }), validateResult: async () => {} });
  try {
    await jobs.start({ requestId: id, request }); await jobs.idle();
    assert.equal((await jobs.get(id)).status, 'completed');
    assert.equal(await readFile(join(legacy, `${id}.json`), 'utf8'), '{invalid legacy request');
  } finally { await jobs.shutdown(); await rm(root, { recursive: true, force: true }); }
});
