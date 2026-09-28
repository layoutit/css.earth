/** The import graph built from a small throwaway repository: workspace exports through tsup entries, `.astro`
 * imports through the cruise's resolver, and the errors that stop an incomplete graph. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { buildImportGraph, IncompleteGraphError, UnresolvedImportError, type ImportGraph } from './graph.mts';
import { evaluateRules } from './rules.mts';

const FILES: Readonly<Record<string, string>> = {
  'package.json': JSON.stringify({ name: 'fixture', private: true, type: 'module', scripts: {},
    imports: { '#prep/*': { types: './tools/objects/*.ts', default: './tools/objects/dist/*.js' } } }),
  // `paths` without `baseUrl`: aliases resolve from the tsconfig's directory.
  'tsconfig.json': JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', allowImportingTsExtensions: true, noEmit: true,
    paths: { '~prepare/*': ['./tools/prepare/cli/*'] } } }),
  '.gitignore': 'dist/\nnode_modules/\n',
  // A package with subpath entries only and no src/index.ts, like @cssearth/bake.
  'packages/bake/package.json': JSON.stringify({ name: '@x/bake', type: 'module', exports: {
    './volume': { types: './dist/volume.d.ts', import: './dist/volume.js' },
    './volume/node': { types: './dist/volume/node.d.ts', import: './dist/volume/node.js' },
    './gone': { types: './dist/gone.d.ts', import: './dist/gone.js' },
  } }),
  'packages/bake/tsup.config.ts': "import { defineConfig } from 'tsup';\n"
    + "const entry: Record<string, string> = { volume: 'src/volume/index.ts', 'volume/node': 'src/volume/node/index.ts' };\n"
    + 'export default defineConfig({ entry, format: [\'esm\'] });\n',
  'packages/bake/src/volume/index.ts': 'export const volume = 1;\n',
  'packages/bake/src/volume/node/index.ts': 'export interface Volume { readonly size: number }\n',
  // A package with URL-built entries and a wildcard export, like @cssearth/renderer.
  'packages/renderer/package.json': JSON.stringify({ name: '@x/renderer', type: 'module', exports: {
    '.': { types: './dist/index.d.ts', import: './dist/index.js' },
    './platform/*': { types: './dist/platform/*.d.ts', import: './dist/platform/*.js' },
    './navigation/*': './src/navigation/*',
  } }),
  'packages/renderer/tsup.config.ts': "import { fileURLToPath } from 'node:url';\nexport default {\n  entry: {\n"
    + "    index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),\n"
    + "    'platform/orbit': fileURLToPath(new URL('./src/navigation/orbit.ts', import.meta.url)),\n  },\n};\n",
  'packages/renderer/src/index.ts': 'export const renderer = 1;\n',
  'packages/renderer/src/navigation/orbit.ts': 'export const orbit = 1;\n',
  'packages/renderer/src/navigation/camera.ts': 'export const camera = 1;\n',
  'tools/prepare/cli/prepare-x.mts': 'export default function run(): void {}\n',
  'tools/objects/lens.ts': 'export const lens = 1;\n',
  'site/Card.astro': '---\nconst title = 1;\n---\n<p>{title}</p>\n',
  'site/Page.astro': [
    '---',
    "import Card from './Card.astro';",
    "import run from '~prepare/prepare-x.mts';",
    "import { lens } from '#prep/lens';",
    "import { renderer } from '@x/renderer';",
    "import { camera } from '@x/renderer/navigation/camera.ts';",
    "type Orbit = typeof import('@x/renderer/platform/orbit');",
    "type Volume = import('@x/bake/volume/node').Volume;",
    '---',
    '<Card />',
  ].join('\n'),
  'site/uses.mts': "import { volume } from '@x/bake/volume';\nexport const used = volume;\n",
};

/** A git repository with FILES added to its index; `@x/bake` is built and linked, `@x/renderer` is not. */
function fixture(extra: Readonly<Record<string, string>> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'architecture-graph-'));
  for (const [path, text] of Object.entries({ ...FILES, ...extra })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  for (const stub of ['volume.d.ts', 'volume.js', 'volume/node.d.ts', 'volume/node.js']) {
    mkdirSync(dirname(join(root, 'packages/bake/dist', stub)), { recursive: true });
    writeFileSync(join(root, 'packages/bake/dist', stub), 'export {};\n');
  }
  mkdirSync(join(root, 'node_modules/@x'), { recursive: true });
  symlinkSync('../../packages/bake', join(root, 'node_modules/@x/bake'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

async function withFixture<T>(extra: Readonly<Record<string, string>>, run: (root: string) => Promise<T>): Promise<T> {
  const root = fixture(extra);
  try { return await run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

const targets = (graph: ImportGraph, from: string) => graph.edges.filter(edge => edge.from === from).map(edge => edge.to).sort();

test('workspace imports resolve through exports and tsup entries, built or not, from .ts and .astro files', async () => {
  await withFixture({}, async root => {
    const graph = await buildImportGraph(root, { details: true });
    assert.deepEqual(targets(graph, 'site/uses.mts'), ['packages/bake/src/volume/index.ts'], 'a built dist entry counts as its tsup source');
    assert.deepEqual(targets(graph, 'site/Page.astro'), [
      'packages/bake/src/volume/node/index.ts', // import('…').T, through a subpath entry with no src/index.ts
      'packages/renderer/src/index.ts', // unbuilt main entry
      'packages/renderer/src/navigation/camera.ts', // unbuilt source wildcard export
      'packages/renderer/src/navigation/orbit.ts', // typeof import('…'), unbuilt dist wildcard export
      'site/Card.astro',
      'tools/objects/lens.ts', // package.json#imports
      'tools/prepare/cli/prepare-x.mts', // tsconfig path alias
    ]);
    const typeOnly = graph.edges.filter(edge => edge.from === 'site/Page.astro' && edge.typeOnly).map(edge => edge.to).sort();
    assert.deepEqual(typeOnly, ['packages/bake/src/volume/node/index.ts', 'packages/renderer/src/navigation/orbit.ts']);
    const violations = evaluateRules(graph);
    assert.deepEqual(violations.get('nothing-imports-prepare-scripts'), [{ from: 'site/Page.astro', to: 'tools/prepare/cli/prepare-x.mts' }],
      'an alias that names a forbidden entry is still forbidden');
    assert.ok(violations.get('runtime-imports-no-preparation')?.some(item => item.to === 'packages/bake/src/volume/node/index.ts'),
      'a type-only import of @x/bake from the site counts');
  });
});

test('template-literal dynamic imports become edges in .ts and .astro files; computed specifiers are out of reach', async () => {
  await withFixture({
    'site/late.mts': 'export const late = () => import(`./uses.mts`);\n',
    'site/Late.astro': '---\nconst late = await import(`./uses.mts`);\n---\n<div />\n',
    'site/computed.mts': "const name = './uses.mts';\nexport const computed = () => import(name);\nexport const templated = () => import(`${name}`);\n",
  }, async root => {
    const graph = await buildImportGraph(root, { details: false });
    assert.deepEqual(targets(graph, 'site/late.mts'), ['site/uses.mts'], 'dependency-cruiser reads a no-expression template literal');
    assert.deepEqual(targets(graph, 'site/Late.astro'), ['site/uses.mts'], 'and so does the Astro scanner');
    assert.deepEqual(targets(graph, 'site/computed.mts'), [], 'a computed specifier names no file until it runs');
  });
});

test('a computed import typed with a literal typeof import() still reaches the graph as an edge to site/build', async () => {
  const load = "import { pathToFileURL } from 'node:url';\nexport const load = async () => (await import(pathToFileURL('site/build/prepare/t.mts').href)";
  await withFixture({
    'site/build/prepare/t.mts': 'export const target = (id: string): boolean => id.length > 0;\n',
    'tools/objects/typed.ts': `${load} as typeof import('../../site/build/prepare/t.mts')).target;\n`,
    'tools/objects/untyped.ts': `${load} as { target(id: string): boolean }).target;\n`,
  }, async root => {
    const graph = await buildImportGraph(root, { details: false });
    assert.deepEqual(targets(graph, 'tools/objects/typed.ts'), ['site/build/prepare/t.mts'], 'the typeof import() names the file the computed import loads');
    assert.deepEqual(targets(graph, 'tools/objects/untyped.ts'), [], 'a hand-written interface hides the edge');
    assert.deepEqual(evaluateRules(graph).get('nothing-imports-applications')?.filter(item => item.from.startsWith('tools/')),
      [{ from: 'tools/objects/typed.ts', to: 'site/build/prepare/t.mts' }],
      'so the tools -> site/build edge is held to the application rule and its baseline');
  });
});

test('a workspace import the graph cannot place stops the check instead of vanishing', async () => {
  await withFixture({ 'site/gone.mts': "import '@x/bake/gone';\n" }, async root => {
    await assert.rejects(buildImportGraph(root, { details: false }), (error: unknown) =>
      error instanceof UnresolvedImportError && /site\/gone\.mts: @x\/bake\/gone .*not the output of a tsup entry/u.test(error.message));
  });
  await withFixture({ 'site/private.mts': "import '@x/bake/volume/internal';\n" }, async root => {
    await assert.rejects(buildImportGraph(root, { details: false }), /@x\/bake\/volume\/internal is not exported/u);
  });
});

test('a tracked .astro file missing from disk makes the graph incomplete', async () => {
  await withFixture({}, async root => {
    rmSync(join(root, 'site/Card.astro'));
    await assert.rejects(buildImportGraph(root, { details: false }), (error: unknown) =>
      error instanceof IncompleteGraphError && !(error instanceof UnresolvedImportError) && /site\/Card\.astro/u.test(error.message));
  });
});
