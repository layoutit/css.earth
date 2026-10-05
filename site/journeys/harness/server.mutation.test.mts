/** Parent-death cleanup is qualified by killing the parent and deleting its IPC detector. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

test('preview closes after parent death; deleting disconnect cleanup leaves it alive', { timeout: 15000 }, async () => {
  await mkdir('output/journeys', { recursive: true });
  const root = await mkdtemp(resolve('output/journeys/server-mutation-'));
  try {
    const dist = resolve(root, 'dist'); await mkdir(resolve(dist, 'scenes'), { recursive: true }); await mkdir(resolve(dist, 'milky-way'), { recursive: true });
    await writeFile(resolve(dist, 'milky-way/index.html'), '<!doctype html><title>Preview fixture</title>');
    for (const deleted of [false, true]) {
      const folder = resolve(root, deleted ? 'deleted' : 'control'); await mkdir(folder);
      await writeFile(resolve(folder, 'server.mts'), await readFile(resolve(import.meta.dirname, 'server.mts'), 'utf8'));
      let childSource = await readFile(resolve(import.meta.dirname, 'server-child.mts'), 'utf8');
      childSource = childSource.replace('../../server/preview.mts', pathToFileURL(resolve(import.meta.dirname, '../../server/preview.mts')).href);
      const detector = "process.once('disconnect', async () => { await close(); process.exit(0); });";
      assert.ok(childSource.includes(detector));
      if (deleted) childSource = childSource.replace(detector, '');
      await writeFile(resolve(folder, 'server-child.mts'), childSource);
      await writeFile(resolve(folder, 'parent.mts'), `import { startServer } from './server.mts'; const server = await startServer(${JSON.stringify(dist)}); console.log(JSON.stringify({ origin: server.origin, pid: server.pid }));`);
      const parent = spawn(process.execPath, [resolve(folder, 'parent.mts')], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = ''; parent.stdout.on('data', data => { output += String(data); });
      let previewPid: number | undefined;
      try {
        const deadline = Date.now() + 5000;
        while (!output.includes('\n') && Date.now() < deadline) await delay(20);
        const payload: unknown = JSON.parse(output.trim());
        if (!payload || typeof payload !== 'object' || !('origin' in payload) || typeof payload.origin !== 'string'
          || !('pid' in payload) || typeof payload.pid !== 'number' || !Number.isSafeInteger(payload.pid) || payload.pid < 1) throw new Error('Invalid preview parent payload');
        previewPid = payload.pid; const origin = payload.origin;
        assert.equal((await fetch(origin + '/milky-way/')).status, 200);
        parent.kill('SIGKILL');
        let alive = true; const stopAt = Date.now() + 1000;
        while (alive && Date.now() < stopAt) {
          await delay(25);
          alive = await fetch(origin + '/milky-way/', { signal: AbortSignal.timeout(200) }).then(() => true, () => false);
        }
        const requireStopped = () => assert.equal(alive, false, 'Preview survived parent death');
        if (deleted) assert.throws(requireStopped, /Preview survived parent death/u); else requireStopped();
      } finally {
        parent.kill('SIGKILL');
        if (previewPid !== undefined) { try { process.kill(previewPid, 'SIGTERM'); } catch { /* Already closed. */ } }
      }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
