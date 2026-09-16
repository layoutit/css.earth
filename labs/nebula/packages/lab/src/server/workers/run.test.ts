import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runProcessingWorker } from './run.ts';

const readResult = (value: unknown) => {
  if (value !== 'accepted') throw new TypeError('Invalid worker result.');
  return value;
};
async function fixture(source: string, run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'nebula-worker-'));
  try { await writeFile(join(root, 'worker.ts'), source); await run(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('worker completion must validate and exit successfully', async () => {
  await fixture(`process.stdout.write(JSON.stringify({type:'complete',result:'accepted'})+'\\n');`, async root => {
    assert.equal(await runProcessingWorker({ root, entry: 'worker.ts', name: 'test', request: {},
      signal: new AbortController().signal, readResult, onProgress() {} }), 'accepted');
  });
  for (const source of [
    `process.exitCode=0;`,
    `process.stdout.write(JSON.stringify({type:'complete',result:'invalid'})+'\\n');`,
    `process.stdout.write(JSON.stringify({type:'complete',result:'accepted'})+'\\n');process.exitCode=1;`,
  ]) await fixture(source, async root => {
    await assert.rejects(runProcessingWorker({ root, entry: 'worker.ts', name: 'test', request: {},
      signal: new AbortController().signal, readResult, onProgress() {} }), /no valid completion/);
  });
});

test('explicit cancellation terminates the actual worker before resolving', async () => {
  await fixture(`process.stdout.write(JSON.stringify({type:'progress',pid:process.pid})+'\\n');setInterval(()=>{},1000);`, async root => {
    const controller = new AbortController();
    let pid = 0;
    await assert.rejects(runProcessingWorker({ root, entry: 'worker.ts', name: 'test', request: {},
      signal: controller.signal, readResult, onProgress(event) {
        assert.equal(typeof event.pid, 'number'); pid = Number(event.pid); controller.abort();
      } }), { name: 'AbortError' });
    assert.ok(pid > 0);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  });
});
