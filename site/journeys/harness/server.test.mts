/** Preview ownership and local scenes are required independently of the harness checkout. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startServer } from './server.mts';
test('page-limited distribution uses its own checkout preview', async () => {
  await mkdir('output/journeys', { recursive: true });
  const root = await mkdtemp(resolve('output/journeys/preview-owner-'));
  try {
    const checkout = resolve(root, 'checkout'), dist = resolve(checkout, 'dist');
    await mkdir(resolve(checkout, 'site/server'), { recursive: true });
    await mkdir(resolve(dist, 'scenes'), { recursive: true }); await mkdir(resolve(dist, 'dione'), { recursive: true });
    await writeFile(resolve(dist, 'dione/index.html'), '<title>Page-limited distribution</title>');
    await writeFile(resolve(checkout, 'site/server/preview.mts'), `import { createServer } from 'node:http';
      export async function previewSite({ port, root }) {
        const server = createServer((request, response) => { response.setHeader('x-owner', root); response.end('own-checkout'); });
        await new Promise(done => server.listen(port, '127.0.0.1', done));
        return { printUrls() {}, close() { return new Promise(done => server.close(done)); } };
      }`);
    const server = await startServer(dist, checkout);
    try { const response = await fetch(server.origin + '/dione/'); assert.equal(response.headers.get('x-owner'), checkout); }
    finally { await server.close(); }
    const inferred = await startServer(dist);
    try { assert.equal((await fetch(inferred.origin + '/dione/')).headers.get('x-owner'), checkout); }
    finally { await inferred.close(); }
    await rm(resolve(dist, 'scenes'), { recursive: true });
    await assert.rejects(startServer(dist, checkout), /local scenes/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
