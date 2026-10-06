// Entry script: node deploy/cloudflare/bundle-worker.mts [--noindex]
/**
 * Cloudflare serves the built site (`dist`) as a Worker's static assets and runs deploy/cloudflare/worker.ts for the addresses a
 * static file cannot answer: the find and report endpoints, and a page address carrying a query. Run after build:deploy.
 *
 * The Worker runs the handlers Netlify's functions run, and it has no disk. Two modules that read one are swapped for the
 * Worker's own (deploy/cloudflare/search-data.ts, deploy/cloudflare/project-files.ts); the project files the page handler reads go into
 * the script, and the catalogues the search reads are staged beside the built pages. `import.meta.url` is a `file:`
 * address, so site/directory/world-context-plan.mts reads the whole world as it does in Node.
 *
 * `--noindex` marks every response as not to be indexed: a preview address must not compete with the site.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { build } from 'esbuild';
import { hasErrorCode } from '@cssearth/core';
import { FUNCTION_PROJECT_FILES } from '../handlers/function-project-files.mts';

const { values: { noindex } } = parseArgs({ options: { noindex: { type: 'boolean', default: false } } });
const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist'), output = resolve(root, 'deploy/cloudflare/bundled');
const objects = resolve(root, 'src/objects');

/** The project files the page handler reads, each as compact JSON text under its project path. */
async function projectFiles(): Promise<Record<string, string>> {
  const ids = (await readdir(objects, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const files: Record<string, string> = {};
  for (const pattern of FUNCTION_PROJECT_FILES) {
    const every = pattern.includes('*');
    for (const path of every ? ids.map(id => pattern.replace('*', id)) : [pattern]) {
      // An object without the file has none to carry; a file named outright must exist.
      const text = await readFile(resolve(root, path), 'utf8').catch((error: unknown) => {
        if (every && hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
      });
      if (text !== undefined) files[path] = JSON.stringify(JSON.parse(text));
    }
  }
  return files;
}

const files = await projectFiles();
const swapped = new Map([
  [resolve(root, 'site/server/search-data.mts'), resolve(root, 'deploy/cloudflare/search-data.ts')],
  [resolve(root, 'site/prepared/prepared-world-context-node-source.mts'), resolve(root, 'deploy/cloudflare/project-files.ts')],
]);
await rm(output, { recursive: true, force: true });
const result = await build({
  entryPoints: [resolve(root, 'deploy/cloudflare/worker.ts')], outfile: resolve(output, 'worker.mjs'), absWorkingDir: root,
  bundle: true, platform: 'neutral', format: 'esm', target: 'es2022', metafile: true, logLevel: 'warning',
  mainFields: ['module', 'main'], conditions: ['workerd', 'worker', 'import'],
  // linkedom's main entry reaches Node built-ins through its CommonJS dependencies; its worker build has none.
  alias: { linkedom: 'linkedom/worker' },
  define: { 'import.meta.url': JSON.stringify('file:///cssearth/site/worker.mts'), CSSEARTH_PROJECT_FILES: JSON.stringify(files) },
  plugins: [{ name: 'cssearth-worker-hosts', setup(bundle) {
    // esbuild compiles the filter as a Go regular expression, which has no `u` flag.
    bundle.onResolve({ filter: /(?:search-data|prepared-world-context-node-source)\.mts$/ }, ({ path, resolveDir }) => {
      const host = swapped.get(resolve(resolveDir, path));
      return host === undefined ? undefined : { path: host };
    });
  } }],
});
// A Node built-in left in the script would fail the Worker as it loads; name the module that brought it.
const [script] = Object.values(result.metafile.outputs);
if (!script) throw new Error('deploy/cloudflare/worker.ts bundled to nothing.');
const external = script.imports.filter(entry => entry.external).map(entry => entry.path);
if (external.length) {
  const importers = Object.entries(result.metafile.inputs).filter(([, input]) => input.imports.some(entry => external.includes(entry.path))).map(([path]) => path);
  throw new Error(`deploy/cloudflare/bundled/worker.mjs imports ${external.join(', ')}, which a Worker does not have (from ${importers.join(', ')}).`);
}

// What the handlers read from the built site that the build does not publish there.
const staged: string[] = [];
const scenes = resolve(root, 'public/scenes');
for (const id of await readdir(scenes)) {
  const names = await readdir(resolve(scenes, id)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOTDIR')) return []; throw error; });
  for (const name of names.filter(name => name.endsWith('-places.json'))) {
    const to = resolve(dist, 'scenes', id, name);
    await mkdir(dirname(to), { recursive: true });
    await cp(resolve(scenes, id, name), to);
    staged.push(`/scenes/${id}/${name}`);
  }
}
// The rule netlify.toml gives Netlify: Astro names every file under /_astro/ by its content hash.
const headers = ['/_astro/*', '  Cache-Control: public, max-age=31536000, immutable', ...(noindex ? ['/*', '  X-Robots-Tag: noindex'] : []), ''];
await writeFile(resolve(dist, '_headers'), headers.join('\n'));

// Answer one search and one page from the bundle with the built site as its assets, so a file the bundle or the staging
// left out fails here instead of on every address with a query.
const TYPES: Readonly<Record<string, string>> = { '.html': 'text/html; charset=utf-8', '.json': 'application/json' };
const assets = { async fetch(input: Request | URL | string, init?: RequestInit): Promise<Response> {
  const { pathname } = new URL(new Request(input, init).url);
  const file = resolve(dist, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
  if (!file.startsWith(dist + sep)) return new Response(null, { status: 404 });
  return readFile(file).then(bytes => new Response(bytes, { headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' } }),
    () => new Response(null, { status: 404 }));
} };
const loaded: unknown = await import(pathToFileURL(resolve(output, 'worker.mjs')).href);
const worker = typeof loaded === 'object' && loaded !== null && 'default' in loaded ? loaded.default : undefined;
if (typeof worker !== 'object' || worker === null || !('fetch' in worker) || typeof worker.fetch !== 'function')
  throw new Error('deploy/cloudflare/bundled/worker.mjs has no default export with a fetch handler.');
const ask = (address: string) => (worker.fetch as (request: Request, env: unknown, context: unknown) => Promise<Response>)(
  new Request(`https://deploy.invalid${address}`), { ASSETS: assets }, { waitUntil() {} });

const found = await ask('/.netlify/functions/find?object=earth&q=europa');
const body: unknown = await found.json();
const foundObjects = typeof body === 'object' && body !== null && 'objects' in body ? body.objects : null;
const foundFeatures = typeof body === 'object' && body !== null && 'features' in body ? body.features : null;
if (!found.ok || typeof foundObjects !== 'object' || foundObjects === null || !('total' in foundObjects) || !foundObjects.total || !Array.isArray(foundFeatures) || !foundFeatures.length)
  throw new Error(`deploy/cloudflare/bundled/worker.mjs: a search for "europa" found no objects or features (HTTP ${found.status}): ${JSON.stringify(body).slice(0, 300)}`);
const searched = await ask('/earth/?q=europa');
const html = await searched.text();
if (!searched.ok || !html.includes('data-search-submitted'))
  throw new Error(`deploy/cloudflare/bundled/worker.mjs: the page /earth/?q=europa did not render its search (HTTP ${searched.status}): ${html.slice(0, 300)}`);

console.log(`deploy/cloudflare/bundled/worker.mjs: ${(script.bytes / 1e6).toFixed(2)} MB with ${Object.keys(files).length} project files; staged ${staged.join(', ')} and _headers${noindex ? ' (noindex)' : ''}`);
console.log(`deploy/cloudflare/bundled/worker.mjs: a search for "europa" answers ${String(foundObjects.total)} objects and ${foundFeatures.length} features; /earth/?q=europa renders`);
