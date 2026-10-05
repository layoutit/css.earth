/** A stable native failure must fail capture acceptance even when repeat comparison is identical. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const exec = promisify(execFile);
test('current lane refuses stable native errors and retains zero coverage credit', { skip: process.env.JOURNEY_MUTATIONS !== '1', timeout: 60000 }, async () => {
  const root = await mkdtemp(resolve('output/journeys/run-acceptance-'));
  const dist = resolve(root, 'dist');
  try {
    await mkdir(resolve(root, 'site/server'), { recursive: true });
    for (const path of ['_astro', 'scenes', 'milky-way']) await mkdir(resolve(dist, path), { recursive: true });
    await writeFile(resolve(root, 'site/server/preview.mts'), `import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
export async function previewSite({ port, outDir }: { port: number; outDir: string }) {
  const server = createServer(async (request, response) => {
    if (request.url?.startsWith('/objects/')) { response.setHeader('content-type', 'application/json'); response.end('{}'); return; }
    response.setHeader('content-type', 'text/html'); response.end(await readFile(outDir + '/milky-way/index.html'));
  });
  await new Promise<void>(done => server.listen(port, '127.0.0.1', done));
  return { printUrls() {}, close() { return new Promise<void>(done => { server.closeAllConnections(); server.close(() => done()); }); } };
}`);
    const page = (fault: boolean) => `<!doctype html><html data-ready="true"><title>Stable capture acceptance</title><body><main class="object-stage" data-prepared-object="milky-way"><div class="object-input-surface"><s>Native control</s></div></main><script>fetch('/objects/milky-way/first-view.json');${fault ? 'queueMicrotask(() => { throw new Error("stable native failure"); });' : ''}</script></body></html>`;
    for (const fault of [false, true]) {
      await writeFile(resolve(dist, 'milky-way/index.html'), page(fault));
      const out = resolve(root, fault ? 'fault' : 'control');
      let code = 0, stdout = '';
      try { ({ stdout } = await exec(process.execPath, ['site/journeys/run.mts', '--dist', dist, '--checkout', root, '--out', out, '--journey', 'milky-way', '--profile', 'chromium-desktop', '--repeat', '2'], { timeout: 45000, env: { ...process.env, TMPDIR: resolve('output/tmp') } })); }
      catch (error) {
        if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'number' || !('stdout' in error) || typeof error.stdout !== 'string') throw error;
        code = error.code; stdout = error.stdout;
      }
      assert.equal(code, fault ? 1 : 0, stdout);
      assert.ok(stdout.includes(fault ? 'JOURNEY ERRORS FAILED' : 'DETERMINISTIC: exact repeats match'), stdout);
      const lane: unknown = JSON.parse(await readFile(resolve(out, 'run-observations.json'), 'utf8'));
      if (!Array.isArray(lane)) throw new Error('Missing current lane artifact');
      assert.equal(lane.length, fault ? 0 : 1);
      assert.ok((await readFile(resolve(out, 'run-1/chromium-desktop/milky-way/milky-way.trace.json'), 'utf8')).length > 0);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
