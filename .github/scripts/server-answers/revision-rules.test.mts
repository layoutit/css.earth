/** Mutations of the revision boundary, validators, rewrite storage and deployment rules must fail. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, symlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { buildRevision } from './build-revision.mts';
import { restoreInput } from './clone-restore.mts';
import { assetHeaderRules, netlifyHeaderRules, matchesRoutes, directoryRedirect, hostingHeaders } from './deployment-config.mts';
import { canonicalHtml, prepareAstroClasses, compactHtml, recordAnswer, readRecording, serialise, validateAstroReferences, object } from './model.mts';
import { expandScript, offlineDeploySteps, previewEntry, edgeEntry, loadEdge } from './revision-entries.mts';

test('restoration includes data and dependencies, excluding compiled/generated outputs', () => {
  for (const path of ['node_modules/', 'packages/core/node_modules/', 'src/objects/earth/prepared/', 'public/navigation/']) assert.equal(restoreInput(path), true, path);
  for (const path of ['packages/core/dist/', 'site/prepared-shell.mts', 'public/features/', 'public/shell/', 'public/scenes/', 'dist/', 'output/']) assert.equal(restoreInput(path), false, path);
});
test('validators keep presence and each stale rewritten header remains observable', async () => {
  for (const name of ['last-modified', 'expires', 'content-encoding']) {
    const retained = await recordAnswer('probe', new Response('x', { headers: { [name]: name === 'content-encoding' ? 'gzip' : 'clock' } }), 'https://answers.invalid');
    const removed = await recordAnswer('probe', new Response('x'), 'https://answers.invalid');
    assert.notEqual(serialise(retained), serialise(removed), name);
    if (name !== 'content-encoding') assert.equal(retained.headers[name], 'present');
  }
});
test('same-name chunks retain an ordinal and every original reference must exist', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'answer-chunks-'));
  try {
    await mkdir(resolve(root, '_astro')); await writeFile(resolve(root, '_astro/dist.abc.js'), 'a');
    const html = '<script src="/_astro/dist.abc.js"></script><script src="/_astro/dist.xyz.js"></script><a href="/_astro/dist.abc.js">x</a>';
    assert.equal(canonicalHtml(html), '<script src="/_astro/dist.HASH1.js"></script><script src="/_astro/dist.HASH2.js"></script><a href="/_astro/dist.HASH1.js">x</a>');
    await assert.rejects(validateAstroReferences(html, root), /ENOENT/u);
    await writeFile(resolve(root, '_astro/dist.xyz.js'), 'bb'); await validateAstroReferences(html, root);
    await prepareAstroClasses(root);
    assert.match(canonicalHtml(html), /dist\.SIZE1\.js.*dist\.SIZE2\.js/u);
    assert.notEqual(canonicalHtml(html), canonicalHtml(html.replace('dist.xyz.js', 'dist.abc.js')));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('rewritten regions compare decoded text regardless of gzip metadata', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'answer-regions-'));
  try {
    await writeFile(resolve(root, 'index.json'), serialise({ requests: ['probe'] }));
    await writeFile(resolve(root, 'closure.json'), '{}');
    const body = object(compactHtml('<!--search-shell:start-->new<!--search-shell:end-->', '<!--search-shell:start-->old<!--search-shell:end-->', 'index.html'));
    const region = object(object(body.regions)['search-shell']);
    for (const level of [1, 9]) {
      region.encoding = 'gzip-base64'; region.value = gzipSync('new', { level }).toString('base64');
      await writeFile(resolve(root, 'probe.json'), serialise({ id: 'probe', status: 200, headers: {}, body }));
      const decoded = object(object(object((await readRecording(root)).get('probe.json')).body).regions);
      assert.deepEqual(decoded['search-shell'], { kind: 'rewritten', value: 'new' });
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('all Netlify and asset header rules and Worker exclusions remain visible', () => {
  const rules = netlifyHeaderRules('[[headers]]\nfor = "/_astro/*"\n[headers.values]\nCache-Control = "immutable"\n[[headers]]\nfor = "/*"\n[headers.values]\nX-Frame-Options = "DENY"\n');
  assert.deepEqual(rules, [{ path: '/_astro/*', values: { 'cache-control': 'immutable' } }, { path: '/*', values: { 'x-frame-options': 'DENY' } }]);
  assert.deepEqual(assetHeaderRules('/*\n  X-Robots-Tag: noindex\n/_astro/*\n  Cache-Control: immutable\n'), [{ path: '/*', values: { 'x-robots-tag': 'noindex' } }, { path: '/_astro/*', values: { 'cache-control': 'immutable' } }]);
  assert.equal(matchesRoutes('/objects/earth/first-view.json', ['/*', '!/objects/*']), false);
  assert.equal(matchesRoutes('/earth/', ['/*', '!/objects/*']), true);
});
test('fixture revision resolves moved preview, edge, deployment and Worker build entries', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'answer-entries-'));
  try {
    await mkdir(resolve(root, 'moved')); await mkdir(resolve(root, 'dist'));
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ scripts: { preview: 'pnpm preview:entry', 'preview:entry': 'node moved/preview.mts' } }));
    await writeFile(resolve(root, 'netlify.toml'), '[functions]\ndirectory = "moved/functions"\n[edge_functions]\ndirectory = "moved"\n[[edge_functions]]\npath = "/*"\nfunction = "route"\n');
    await writeFile(resolve(root, 'wrangler.jsonc'), '{"main":"moved/worker.mjs","assets":{}}');
    await writeFile(resolve(root, 'moved/route.ts'), 'export default () => new URL("https://fixture.invalid/moved");');
    assert.equal(await previewEntry(root), resolve(root, 'moved/preview.mts'));
    assert.equal(await edgeEntry(root), resolve(root, 'moved/route.ts'));
    assert.equal((await loadEdge(root))(new Request('https://answers.invalid/earth/?q=x'))?.host, 'fixture.invalid');
    const scripts = { 'build:deploy': 'pnpm build:packages && pnpm setup:asset-data && pnpm prepare:inputs && astro build && node moved/share.mts && node moved/assemble.mts && node moved/netlify.mts', 'build:packages': 'pnpm -r build', 'setup:asset-data': 'node download.mts', 'prepare:inputs': 'node moved/inputs.mts', 'deploy:cloudflare-preview': 'node moved/worker.mts && npx deploy' };
    assert.deepEqual(offlineDeploySteps(scripts), ['node moved/inputs.mts', 'astro build', 'node moved/share.mts', 'node moved/assemble.mts', 'node moved/netlify.mts']);
    assert.equal(expandScript(scripts, 'deploy:cloudflare-preview')[0], 'node moved/worker.mts');
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('offline preload rejects network and writes into shared public scenes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'answer-offline-'));
  await mkdir(resolve(root, 'public/scenes'), { recursive: true });
  try {
  const run = (code: string) => spawnSync(process.execPath, ['--import', resolve(import.meta.dirname, 'offline.mts'), '--input-type=module', '-e', code], { encoding: 'utf8', cwd: root });
  assert.notEqual(run('await fetch("https://assets.invalid/x")').status, 0);
  assert.match(run('await import("node:fs/promises").then(fs => fs.writeFile("public/scenes/forbidden", "x"))').stderr, /read only/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('offline revision build detaches scenes for Astro, rebuilds packages and preserves every deploy stage', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'answer-build-plan-'));
  try {
    await mkdir(resolve(root, 'public')); await mkdir(resolve(root, 'shared'));
    await symlink(resolve(root, 'shared'), resolve(root, 'public/scenes'));
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ scripts: {
      'build:packages': 'pnpm -r build', 'prepare:shell': 'node moved/shell.mts', 'setup:asset-data': 'node download.mts',
      'build:deploy': 'pnpm build:packages && pnpm setup:asset-data && node moved/metadata.mts && astro build && node moved/share.mts && node moved/assemble.mts && node moved/netlify.mts',
      'deploy:cloudflare-preview': 'node moved/worker.mts --noindex && npx deploy',
    } }));
    const seen: string[] = [];
    await buildRevision(root, async (step, _index, env) => {
      seen.push(step); assert.equal(env.ASSET_ORIGIN, 'https://assets.invalid'); assert.equal(env.CSSEARTH_SKIP_DECLARATIONS, '1');
      assert.match(env.NODE_OPTIONS!, /offline\.mts/u);
      if (step === 'astro build') await assert.rejects(lstat(resolve(root, 'public/scenes')), /ENOENT/u);
      else assert.equal((await lstat(resolve(root, 'public/scenes'))).isSymbolicLink(), true);
    });
    assert.deepEqual(seen, ['pnpm build:packages', 'pnpm prepare:shell', 'node moved/metadata.mts', 'astro build', 'node moved/share.mts', 'node moved/assemble.mts', 'node moved/netlify.mts', 'node moved/worker.mts']);
    await assert.rejects(buildRevision(root, async step => { if (step === 'astro build') throw new Error('deliberate failure'); }), /deliberate failure/u);
    assert.equal((await lstat(resolve(root, 'public/scenes'))).isSymbolicLink(), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('hosting adapter redirects only configured slashless directories and negotiates encoding', () => {
  const url = new URL('https://answers.invalid/earth?q=x');
  const redirect = directoryRedirect(url, { html_handling: 'auto-trailing-slash' });
  assert.equal(redirect?.status, 307); assert.equal(redirect?.headers.get('location'), 'https://answers.invalid/earth/?q=x');
  assert.equal(directoryRedirect(new URL('https://answers.invalid/earth/'), { html_handling: 'auto-trailing-slash' }), undefined);
  assert.equal(directoryRedirect(url, { html_handling: 'none' }), undefined);
  for (const encoding of ['identity', 'gzip']) {
    const headers = hostingHeaders(new Request(url, { headers: { 'accept-encoding': encoding } }), new Headers({ expires: 'clock', 'last-modified': 'clock' }), [{ path: '/*', values: { 'x-security': 'one' } }, { path: '/earth', values: { 'x-specific': 'two' } }], true);
    assert.equal(headers.get('x-security'), 'one'); assert.equal(headers.get('x-specific'), 'two');
    assert.equal(headers.get('content-encoding'), encoding === 'gzip' ? 'gzip' : null);
    assert.equal(headers.get('expires'), 'clock'); assert.equal(headers.get('last-modified'), 'clock');
  }
  assert.equal(hostingHeaders(new Request(url, { headers: { range: 'bytes=0-63' } }), new Headers(), [], true).get('content-encoding'), null);
});
