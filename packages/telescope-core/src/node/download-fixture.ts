/** A local archive that drops a body after sending one complete MiB. */
import { createServer } from 'node:http';
export const DOWNLOAD_BYTES = Buffer.alloc(4 * 1024 * 1024).map((_, index) => index % 251);
export async function downloadFixture(mode: 'resume' | 'ignore' | 'fail' | 'invalid-range') {
  const ranges: (string | undefined)[] = [];
  const server = createServer((request, response) => {
    ranges.push(request.headers.range);
    const offset = Number(/^bytes=(\d+)-$/u.exec(request.headers.range ?? '')?.[1] ?? 0);
    const resumed = Boolean(offset && mode !== 'ignore');
    response.writeHead(resumed ? 206 : 200, {
      'Accept-Ranges': 'bytes', 'Content-Length': String(DOWNLOAD_BYTES.length - (resumed ? offset : 0)),
      ...(resumed ? { 'Content-Range': `bytes ${mode === 'invalid-range' ? offset + 1 : offset}-${DOWNLOAD_BYTES.length - 1}/${DOWNLOAD_BYTES.length}` } : {}),
    });
    const body = DOWNLOAD_BYTES.subarray(resumed ? offset : 0);
    if (ranges.length === 1 || mode === 'fail') {
      response.write(body.subarray(0, 1024 * 1024)); setTimeout(() => response.destroy(), 20);
    } else response.end(body);
  });
  await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Local archive has no port.');
  return { url: `http://127.0.0.1:${address.port}/science`, ranges,
    close: async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); } };
}
