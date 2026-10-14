import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { Plugin } from 'vite';
import { staticPageStyles, compiledStyleExport } from './static-page-styles.mts';
import { preparedMotionCss } from './prepared-motion-css.mts';
import { COMPILED_PAGE_STYLES, readCompiledPageStyles } from '../server/compiled-page-styles.mts';
import { IncrementalPathInputs } from '../server/incremental-paths.mts';

const requireAstro = createRequire(import.meta.resolve('astro/package.json'));
const vite: typeof import('vite') = await import(pathToFileURL(requireAstro.resolve('vite')).href);
const astroRoot = dirname(requireAstro.resolve('astro/package.json'));
const { createBuildInternals } = await import(pathToFileURL(resolve(astroRoot, 'dist/core/build/internal.js')).href);
const { pluginIncremental } = await import(pathToFileURL(resolve(astroRoot, 'dist/core/build/plugins/plugin-incremental.js')).href);
const { vitePluginSSRAssets } = await import(pathToFileURL(resolve(astroRoot, 'dist/core/build/vite-plugin-ssr-assets.js')).href);

test('finished production CSS transport preserves Vite bytes and isolates native page hashes and transitive owner keys', { timeout: 90000 }, async t => {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), 'static-styles-'))); t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path: string, text: string) => { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), text); };
  await put('site/layouts/object-shell.css', '.shell { color: rgb(255, 0, 0); }');
  await put('src/imported.css', '.imported { color: red; }');
  await put('src/image.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path d="M0 0h2v2H0z"/></svg>');
  await put('src/alpha.css', '@import "./imported.css"; @keyframes turn { to { transform: rotate(1turn); } } .alpha { animation: turn 1s; background: url("./image.svg"); }');
  await put('src/beta.css', '.beta { color: blue; }');
  for (const id of ['alpha', 'beta']) await put(`src/objects/${id}/object.json`, JSON.stringify({ id, properties: { page: { stylesheets: [`src/${id}.css`] } } }));
  await put('src/objects/planned/README.md', 'Planned object; no descriptor or fallback scene.');
  await put('site/components/page-styles.mts', 'throw new Error("Development loader must be aliased");');
  await put('site/server/built-page-styles.mts', `import { readFile } from 'node:fs/promises'; export async function pageStyle(path: string): Promise<string> { const value: unknown = JSON.parse(await readFile(${JSON.stringify(resolve(root, COMPILED_PAGE_STYLES))}, 'utf8')); if (!value || typeof value !== 'object' || !(path in value)) throw new Error('Missing stylesheet'); const css: unknown = Reflect.get(value, path); if (typeof css !== 'string') throw new Error('Invalid stylesheet'); return css; }`);
  await put('unrelated/page-styles.mts', 'export const unrelated = 42;');
  await put('page.mts', "export { pageStyle } from './site/components/page-styles.mts'; export { unrelated } from './unrelated/page-styles.mts';");
  await put('reference.mts', "export {default as alpha} from './src/alpha.css?inline'; export {default as beta} from './src/beta.css?inline'; export {default as shell} from './site/layouts/object-shell.css?inline';");
  const native = createBuildInternals();
  native.pagesByViteID.set(resolve(root, 'page.mts'), { component: 'page.mts' });
  const virtual: Plugin = { name: 'fixture-astro-page', resolveId(id) { if (id === 'virtual:astro:page:fixture') return '\0virtual:astro:page:fixture'; }, load(id) { if (id === '\0virtual:astro:page:fixture') return `export * from ${JSON.stringify(resolve(root, 'page.mts'))};`; } };
  let suffix = 0;
  const build = async (enabled: boolean) => {
    const outDir = resolve(root, `built-${suffix++}`);
    native.ssrAssetsPerEnvironment.clear();
    const builder = await vite.createBuilder({ root, configFile: false, publicDir: false, logLevel: 'silent', css: { postcss: { plugins: [preparedMotionCss(root)] } },
      plugins: [virtual, vitePluginSSRAssets(native), staticPageStyles(root, enabled), pluginIncremental(native, pathToFileURL(`${root}/`))],
      build: { target: 'esnext', minify: false, cssMinify: true, assetsInlineLimit: 0, copyPublicDir: false },
      environments: { prerender: { consumer: 'server', build: { ssr: true, emitAssets: true, outDir,
        rollupOptions: { input: { entry: enabled ? 'virtual:astro:page:fixture' : resolve(root, 'reference.mts') }, preserveEntrySignatures: 'strict', output: { entryFileNames: '[name].mjs' } } } } },
    });
    const result = await builder.build(builder.environments.prerender);
    assert.ok(!Array.isArray(result) && 'output' in result);
    return { output: result.output, exports: await import(`${pathToFileURL(resolve(outDir, 'entry.mjs')).href}?run=${suffix}`), nativeHash: native.pageDependencyHashes?.get('page.mts'), assetsToMove: native.ssrAssetsPerEnvironment.get('prerender') };
  };
  const reference = await build(false), first = await build(true);
  const styles = await readCompiledPageStyles(root);
  for (const id of ['alpha', 'beta']) assert.equal(styles[`src/${id}.css`], reference.exports[id]);
  assert.equal(styles['site/layouts/object-shell.css'], reference.exports.shell);
  assert.equal(await first.exports.pageStyle('src/alpha.css'), reference.exports.alpha);
  assert.equal(first.exports.unrelated, 42, 'an unrelated helper with the same basename is not redirected');
  assert.doesNotMatch(styles['src/alpha.css']!, /keyframes|animation|__VITE_ASSET__/u);
  assert.match(styles['src/alpha.css']!, /assets\/image[-.]/u);
  assert.ok(first.nativeHash, 'actual Astro native page hash is produced');
  assert.ok([...first.assetsToMove].some((file: string) => /assets\/image[-.].+\.svg$/u.test(file)), 'actual Astro mover retains the stylesheet relative asset');
  const key = (id: string) => new IncrementalPathInputs(root, { CSSEARTH_STATIC_STYLES: '1' }).key({ params: { id } });
  const alpha = await key('alpha'), beta = await key('beta');
  await put('src/imported.css', '.imported { color: green; }');
  const imported = await build(true);
  assert.equal(imported.nativeHash, first.nativeHash, 'owner CSS does not change the actual native page dependency hash');
  await t.test('imported CSS bytes belong to the owner key', async () => assert.notEqual(await key('alpha'), alpha));
  assert.equal(await key('beta'), beta, 'unrelated owner key stays reusable');
  const beforeAsset = await key('alpha');
  await put('src/image.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="3"><path d="M0 0h3v3H0z"/></svg>');
  const asset = await build(true);
  assert.equal(asset.nativeHash, first.nativeHash);
  await t.test('non-inline asset URL bytes belong to the owner key', async () => assert.notEqual(await key('alpha'), beforeAsset));
  assert.equal(await key('beta'), beta);
  const beforeOwn = await key('alpha');
  await put('src/alpha.css', '.alpha { outline-offset: 1px; }');
  const own = await build(true);
  assert.equal(own.nativeHash, first.nativeHash, 'direct stylesheet edit preserves native page hash');
  assert.notEqual(await key('alpha'), beforeOwn);
  assert.equal(await key('beta'), beta);
});

test('compiled stylesheet transport and literal parser fail closed', async t => {
  for (const source of ['import x from "x"; export default x;', 'export default dynamic();']) assert.throws(() => compiledStyleExport(vite.parseAst(source)));
  const root = await mkdtemp(resolve(tmpdir(), 'static-styles-invalid-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(dirname(resolve(root, COMPILED_PAGE_STYLES)), { recursive: true });
  await writeFile(resolve(root, COMPILED_PAGE_STYLES), '{"src/a.css":3}');
  await assert.rejects(readCompiledPageStyles(root), /Invalid compiled/u);
});
