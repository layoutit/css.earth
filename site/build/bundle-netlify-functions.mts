// Entry script: node site/build/bundle-netlify-functions.mts
/**
 * Netlify packages a v2 function by tracing its files, so workspace packages stay external imports. The renderer's source
 * subpaths are TypeScript, which Node cannot load from node_modules: the deployed search function failed to load and
 * every search, dataset, settings and shared-view request answered 502 ("handler is not a function").
 *
 * Bundle each function in netlify/functions into one ES module in netlify/functions-bundled, workspace code included, and
 * let netlify.toml point Netlify at that directory. Node built-ins stay external; everything else is inlined.
 */
import { readdir, rm } from 'node:fs/promises';
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
for (const [file, { bytes }] of Object.entries(result.metafile.outputs)) {
  // Load each bundle as Netlify will, so a function that cannot load fails the deploy instead of answering 502.
  const loaded: unknown = await import(pathToFileURL(resolve(root, file)).href);
  if (typeof loaded !== 'object' || loaded === null || !('default' in loaded) || typeof loaded.default !== 'function')
    throw new Error(`${file}: the bundled Netlify function has no default export handler.`);
  console.log(`${file}: ${(bytes / 1e6).toFixed(2)} MB, loads`);
}
