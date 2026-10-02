// Entry script: node site/build/bundle-netlify-functions.mts
/**
 * Netlify packages a v2 function by tracing its files, so workspace packages stay external imports. The renderer's source
 * subpaths are TypeScript, which Node cannot load from node_modules: the deployed search function failed to load and
 * every search, dataset, settings and shared-view request answered 502 ("handler is not a function").
 *
 * Bundle each function in netlify/functions into one ES module in netlify/functions-bundled, workspace code included, and
 * let netlify.toml point Netlify at that directory. Node built-ins stay external; everything else is inlined.
 */
import { readdir, readFile, rm } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '../..');
const source = resolve(root, 'netlify/functions'), output = resolve(root, 'netlify/functions-bundled');
const entries = (await readdir(source)).filter(name => extname(name) === '.ts').map(name => resolve(source, name));
if (!entries.length) throw new Error(`No Netlify functions found in ${source}.`);
await rm(output, { recursive: true, force: true });
const result = await build({
  entryPoints: entries, outdir: output, outExtension: { '.js': '.mjs' }, absWorkingDir: root,
  bundle: true, platform: 'node', format: 'esm', target: 'node22', metafile: true, logLevel: 'warning',
  // Bundled CommonJS dependencies (linkedom's) still call require for Node built-ins.
  banner: { js: "import { createRequire as cssearthCreateRequire } from 'node:module'; const require = cssearthCreateRequire(import.meta.url);" },
});
// The functions read the Sun's world files from disk (site/world-context-plan.mts), and a deployed function holds only
// what netlify.toml `included_files` lists. Here every file is on disk, so loading a bundle proves nothing about that list:
// each world file is checked against it by name. world-index.json was left out on 2026-10-02 and every address with a
// query answered 502.
const included = /included_files\s*=\s*\[([^\]]*)\]/u.exec(await readFile(resolve(root, 'netlify.toml'), 'utf8'))?.[1];
if (included === undefined) throw new Error('netlify.toml: [functions] included_files is missing.');
for (const path of ['src/objects/sun/prepared/world-context-summary.json', 'src/objects/sun/prepared/world-index.json', 'src/objects/sun/prepared/world-systems/*.json']) {
  if (!included.includes(`"${path}"`)) throw new Error(`netlify.toml: [functions] included_files does not list ${path}, which the page function reads (site/world-context-plan.mts); a deployed function would answer 502.`);
}
for (const [file, { bytes }] of Object.entries(result.metafile.outputs)) {
  // Load each bundle as Netlify will, so a function that cannot load fails the deploy instead of answering 502.
  const loaded: unknown = await import(pathToFileURL(resolve(root, file)).href);
  if (typeof loaded !== 'object' || loaded === null || !('default' in loaded) || typeof loaded.default !== 'function')
    throw new Error(`${file}: the bundled Netlify function has no default export handler.`);
  console.log(`${file}: ${(bytes / 1e6).toFixed(2)} MB, loads`);
  // The find function reads its catalogues from disk (netlify.toml `included_files`): answer one query here, so a missing
  // or unreadable file fails the deploy instead of every search.
  if (file.endsWith('/find.mjs')) {
    const handler = loaded.default as (request: Request) => Promise<Response>;
    const answer = await handler(new Request('https://deploy.invalid/.netlify/functions/find?object=earth&q=europa'));
    const body: unknown = await answer.json();
    const objects = typeof body === 'object' && body !== null && 'objects' in body ? body.objects : null;
    const features = typeof body === 'object' && body !== null && 'features' in body ? body.features : null;
    if (!answer.ok || typeof objects !== 'object' || objects === null || !('total' in objects) || !objects.total || !Array.isArray(features) || !features.length)
      throw new Error(`${file}: a search for "europa" found no objects or features (HTTP ${answer.status}): ${JSON.stringify(body).slice(0, 300)}`);
    console.log(`${file}: a search for "europa" answers ${String(objects.total)} objects and ${features.length} features`);
  }
}
