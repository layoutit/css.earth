/** Child host: the real preview server or the bundled Worker, with a deterministic stand-in for the static assets. */
import { hostPort } from './host-port.mts';
import { assetOrigin, fetchRoute } from './asset-origin.mts';
import promises from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { previewEntry } from './revision-entries.mts';
import { object } from './model.mts';
import { publicRoot } from './public-root.mts';
import { readDeploymentConfig, matchesRoutes, directoryRedirect, hostingHeaders } from './deployment-config.mts';
let fallback = false;
const logError = console.error;
console.error = (...values: unknown[]) => { if (values.some(value => String(value).includes('page-handler-fallback'))) fallback = true; logError(...values); };
const root = await promises.realpath(process.cwd());
const target = process.argv[2], dist = process.argv[3];
const publishedOrigin = assetOrigin(process.argv[4]);
if (!dist || !['preview', 'cloudflare'].includes(target ?? '')) throw new Error('Invalid child arguments');
const config = await readDeploymentConfig(root, dist);
let preview: { close(): Promise<void> } | undefined;
let origin = 'https://answers.invalid';
const originalFetch = globalThis.fetch;
if (target === 'preview') {
  const { previewSite } = await import(pathToFileURL(await previewEntry(root)).href);
  const server = await previewSite({ root, outDir: dist, port: hostPort(target ?? '') });
  preview = server;
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('No preview port');
  origin = `http://127.0.0.1:${address.port}`;
}
const assetPaths = new Map<string, string>();
// The origin is encoded in built descriptors, not a runtime environment variable. Published filenames are inventory-owned.
async function publishedFile(path: string): Promise<string | undefined> {
  if (!assetPaths.size) {
    for (const entry of await promises.readdir(resolve(root, 'src/objects'), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const inventory = await promises.readFile(resolve(root, 'src/objects', entry.name, 'inventory.json'), 'utf8').catch(() => null);
      if (!inventory) continue;
      const assets = object(JSON.parse(inventory)).assets;
      if (!Array.isArray(assets)) throw new Error(`${entry.name}: invalid inventory`);
      for (const raw of assets) {
        const asset = object(raw);
        if (asset.location !== 'public' || typeof asset.filename !== 'string') continue;
        // Published addresses retain the object directory and content-address filename from the inventory.
        const digest = Object.entries(asset).find(([key]) => key.startsWith('sha'))?.[1];
        if (typeof digest !== 'string') throw new Error(`${entry.name}: missing content address`);
        assetPaths.set(`/runtime-assets/${digest}/${asset.filename}`, resolve(root, publicRoot(root), 'scenes', entry.name, asset.filename));
      }
    }
  }
  return assetPaths.get(path);
}
async function staticAnswer(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let file = resolve(dist!, `.${url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname}`);
  if (!file.startsWith(resolve(dist!) + sep)) return new Response(null, { status: 404 });
  // auto-trailing-slash redirects directory pages before serving their index.
  if (!extname(file) && await promises.stat(resolve(file, 'index.html')).catch(() => null)) {
    const redirect = target === 'cloudflare' ? directoryRedirect(url, config.assets) : undefined;
    if (redirect) return redirect;
    file = resolve(file, 'index.html');
  }
  if (!await promises.stat(file).catch(() => null) && url.origin === publishedOrigin) file = await publishedFile(url.pathname) ?? file;
  try {
    const bytes = await promises.readFile(file), stat = await promises.stat(file);
    const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    // Fetch-decoded static bytes carry negotiated encoding and validators to exercise rewrite cleanup.
    // The cache rule comes from dist/_headers; any other file revalidates on every request.
    const headers = new Headers({ 'content-type': types[extname(file)] ?? 'application/octet-stream', 'content-length': String(bytes.length), etag: `"${createHash('sha1').update(bytes).digest('hex')}"`, 'last-modified': stat.mtime.toUTCString(), 'cache-control': url.pathname.startsWith('/_astro/') ? config.immutableCache ?? 'public, max-age=0, must-revalidate' : 'public, max-age=0, must-revalidate' });
    headers.set('expires', stat.mtime.toUTCString());
    hostingHeaders(request, headers, config.headerRules, /\.(?:html|json|js|css)$/u.test(file));
    if (request.headers.get('if-none-match') === headers.get('etag') || (!request.headers.has('if-none-match') && request.headers.get('if-modified-since') === headers.get('last-modified'))) { headers.delete('content-type'); headers.delete('content-length'); return new Response(null, { status: 304, headers }); }
    headers.set('accept-ranges', 'bytes');
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/u.exec(range);
      const start = match ? Number(match[1]) : NaN, end = match?.[2] ? Number(match[2]) : bytes.length - 1;
      if (!Number.isSafeInteger(start) || start < 0 || start >= bytes.length || end < start) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${bytes.length}` } });
      const selected = bytes.subarray(start, Math.min(end + 1, bytes.length));
      headers.set('content-range', `bytes ${start}-${start + selected.length - 1}/${bytes.length}`); headers.set('content-length', String(selected.length));
      return new Response(request.method === 'HEAD' ? null : selected, { status: 206, headers });
    }
    return new Response(request.method === 'HEAD' ? null : bytes, { headers });
  } catch { return new Response(null, { status: 404 }); }
}
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init), url = new URL(request.url);
  if (fetchRoute(url.href, publishedOrigin, origin) === 'asset') return staticAnswer(request);
  if (preview) return originalFetch(new Request(origin + url.pathname + url.search, request));
  return staticAnswer(request);
};
let worker: ((request: Request) => Promise<Response>) | undefined;
let closing = false;
async function close() { if (closing) return; closing = true; await preview?.close(); process.exit(0); }
process.once('disconnect', () => { void close(); });
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void close(); });
process.once('uncaughtException', error => { console.error(error); void close(); });
process.once('unhandledRejection', error => { console.error(error); void close(); });
if (target === 'cloudflare') {
  const loaded = object(await import(pathToFileURL(resolve(root, config.workerMain)).href));
  const callable = object(loaded.default).fetch;
  if (typeof callable !== 'function') throw new Error('Worker missing fetch');
  worker = async request => {
    const pending: Promise<unknown>[] = [];
    // The Workers ASSETS binding reads a built-site path whatever origin the caller names (deploy/cloudflare/assets.ts uses `https://assets.invalid`); it never leaves the machine.
    const ASSETS = { fetch: (input: Request | URL | string, init?: RequestInit) => {
      const asked = new Request(input, init), url = new URL(asked.url);
      return staticAnswer(url.origin === publishedOrigin ? asked : new Request(`https://answers.invalid${url.pathname}${url.search}`, asked));
    } };
    const response: unknown = await callable(request, { ASSETS }, { waitUntil(work: Promise<unknown>) { pending.push(work); } });
    await Promise.all(pending);
    if (!(response instanceof Response)) throw new Error('Worker invalid response'); return response;
  };
}
async function answer(probe: Request): Promise<Response> {
  if (!worker) return globalThis.fetch(probe);
  const patterns = config.assets.run_worker_first;
  const workerFirst = patterns === true || (Array.isArray(patterns) && matchesRoutes(new URL(probe.url).pathname, patterns.map(String)));
  return workerFirst ? worker(probe) : staticAnswer(probe);
}
process.on('message', async (message: unknown) => {
  try {
    if (typeof message !== 'string') throw new Error('Invalid IPC message');
    const value = object(JSON.parse(message));
    if (value.command === 'warmup') {
      const found = await answer(new Request('https://answers.invalid/.netlify/functions/find?object=earth&q=europa'));
      if (!found.ok) throw new Error(`Warmup find failed: ${found.status}`);
      const loadedPage = await answer(new Request('https://answers.invalid/.netlify/functions/search?object=no-such-object'));
      if (loadedPage.status !== 404) throw new Error(`Warmup page module failed: ${loadedPage.status}`);
      process.send?.({ fallback, warmed: true }); return;
    }
    if (typeof value.path !== 'string' || typeof value.method !== 'string') throw new Error('Invalid probe');
    const headers = object(value.headers), decodedHeaders = new Headers();
    for (const [name, value] of Object.entries(headers)) { if (typeof value !== 'string') throw new Error('Invalid headers'); decodedHeaders.set(name, value); }
    const address = value.path.startsWith('https://') ? value.path : 'https://answers.invalid' + value.path;
    const probe = new Request(address, { method: value.method, redirect: 'manual', headers: decodedHeaders, ...(typeof value.body === 'string' ? { body: value.body } : {}) });
    const response = await answer(probe);
    process.send?.({ fallback, status: response.status, headers: [...response.headers], bytes: Buffer.from(await response.arrayBuffer()).toString('base64') });
  } catch (error) { process.send?.({ error: String(error) }); }
});
process.send?.({ ready: true, origin });
