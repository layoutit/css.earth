import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { WORKSPACE } from '@cssearth/telescope/node';
import { build } from 'esbuild';
import { followedWorkspaceSources } from './implementation-dependencies.mts';

/** The workspace sources an entry bundles when the followed workspace entries resolve to their sources. */
async function closure(root: string, entries: readonly string[]): Promise<string[]> {
  const result = await build({ absWorkingDir: root, entryPoints: entries.map(entry => resolve(root, entry)), bundle: true, write: false, metafile: true, platform: 'node', format: 'esm',
    packages: 'external', conditions: ['types'], treeShaking: false, logLevel: 'silent', outdir: resolve(root, '.closure-output'), plugins: [followedWorkspaceSources(root)] });
  return Object.keys(result.metafile.inputs).map(path => relative(root, resolve(root, path))).filter(path => !path.startsWith('..')).sort();
}

test('the closure follows transitive local TypeScript imports', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-closure-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { value } from './helper.mts'; export const answer=value;\n");
    await writeFile(resolve(root, 'helper.mts'), 'export const value=1;\n');
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', 'helper.mts']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the runtime-source reader is followed into @cssearth/bake/runtime-source, as when it sat under tools/ci', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-runtime-source-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { parseRuntimeSource } from '@cssearth/bake/runtime-source';\nexport const used=[parseRuntimeSource];\n");
    await mkdir(resolve(root, 'packages/bake/src/runtime-source'), { recursive: true });
    await writeFile(resolve(root, 'packages/bake/src/runtime-source/runtime-source-graph.ts'), 'export const parseRuntimeSource=()=>1;\n');
    await writeFile(resolve(root, 'packages/bake/src/runtime-source/index.ts'), "export * from './runtime-source-graph.ts';\n");
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', 'packages/bake/src/runtime-source/index.ts', 'packages/bake/src/runtime-source/runtime-source-graph.ts']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the prepared, asset, source and contract libraries are followed into their package sources, as when they sat under tools/', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-prepare-leaves-'));
  try {
    const entries = [['@cssearth/bake/prepared-presentation', 'packages/bake/src/prepared-presentation'], ['@cssearth/bake/delivery', 'packages/bake/src/delivery'],
      ['@cssearth/bake/sources', 'packages/bake/src/sources'], ['@cssearth/bake/contract', 'packages/bake/src/contract'],
      ['@cssearth/objects/node/contract', 'packages/objects/src/node/contract']] as const;
    await writeFile(resolve(root, 'entry.mts'), `${entries.map(([specifier], index) => `import { v${index} } from '${specifier}';`).join('\n')}\nexport const used=[${entries.map((_, index) => `v${index}`).join(',')}];\n`);
    for (const [index, [, directory]] of entries.entries()) {
      await mkdir(resolve(root, directory), { recursive: true });
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index};\n`);
      await writeFile(resolve(root, directory, 'index.ts'), "export * from './value.ts';\n");
    }
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', ...entries.flatMap(([, directory]) => [`${directory}/index.ts`, `${directory}/value.ts`])].sort());
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the navigation, surface-preview, preparation and thread-pool libraries are followed into their bake sources, as when they sat under tools/', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-prepare-libraries-'));
  try {
    const entries = [['@cssearth/bake/navigation', 'packages/bake/src/navigation'], ['@cssearth/bake/surface-previews', 'packages/bake/src/surface-previews'],
      ['@cssearth/bake/preparation', 'packages/bake/src/preparation'], ['@cssearth/bake/thread-pool', 'packages/bake/src/thread-pool']] as const;
    await writeFile(resolve(root, 'entry.mts'), `${entries.map(([specifier], index) => `import { v${index} } from '${specifier}';`).join('\n')}\nexport const used=[${entries.map((_, index) => `v${index}`).join(',')}];\n`);
    for (const [index, [, directory]] of entries.entries()) {
      await mkdir(resolve(root, directory), { recursive: true });
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index};\n`);
      await writeFile(resolve(root, directory, 'index.ts'), "export * from './value.ts';\n");
    }
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', ...entries.flatMap(([, directory]) => [`${directory}/index.ts`, `${directory}/value.ts`])].sort());
    for (const [index, [, directory]] of entries.entries()) {
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index + 10};\n`);
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index};\n`);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the layered-provenance library is followed into its bake sources, as when it sat under tools/', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-prepare-4b4-'));
  try {
    const entries = [['@cssearth/bake/objects/provenance', 'packages/bake/src/objects/provenance']] as const;
    await writeFile(resolve(root, 'entry.mts'), `${entries.map(([specifier], index) => `import { v${index} } from '${specifier}';`).join('\n')}\nexport const used=[${entries.map((_, index) => `v${index}`).join(',')}];\n`);
    for (const [index, [, directory]] of entries.entries()) {
      await mkdir(resolve(root, directory), { recursive: true });
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index};\n`);
      await writeFile(resolve(root, directory, 'index.ts'), "export * from './value.ts';\n");
    }
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', ...entries.flatMap(([, directory]) => [`${directory}/index.ts`, `${directory}/value.ts`])].sort());
    for (const [index, [, directory]] of entries.entries()) {
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index + 10};\n`);
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index};\n`);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the facility-render poses are followed into their bake source, as when they sat under tools/facility-renders', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-prepare-4b10-'));
  try {
    const directory = 'packages/bake/src/facility-renders';
    await writeFile(resolve(root, 'entry.mts'), "import { v0 } from '@cssearth/bake/facility-renders';\nexport const used=[v0];\n");
    await mkdir(resolve(root, directory), { recursive: true });
    await writeFile(resolve(root, directory, 'value.ts'), 'export const v0=0;\n');
    await writeFile(resolve(root, directory, 'index.ts'), "export * from './value.ts';\n");
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', `${directory}/index.ts`, `${directory}/value.ts`]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the asset-publication commands are followed into their bake source, as when they sat under tools/assets', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-prepare-4b8-'));
  try {
    const directory = 'packages/bake/src/asset-publication';
    await writeFile(resolve(root, 'entry.mts'), "import { v0 } from '@cssearth/bake/asset-publication';\nexport const used=[v0];\n");
    await mkdir(resolve(root, directory), { recursive: true });
    await writeFile(resolve(root, directory, 'value.ts'), 'export const v0=0;\n');
    await writeFile(resolve(root, directory, 'index.ts'), "export * from './value.ts';\n");
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', `${directory}/index.ts`, `${directory}/value.ts`]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the site-assets preparers are followed into their bake source, as when they sat under tools/prepare', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-prepare-4b7-'));
  try {
    const directory = 'packages/bake/src/site-assets';
    await writeFile(resolve(root, 'entry.mts'), "import { v0 } from '@cssearth/bake/site-assets';\nexport const used=[v0];\n");
    await mkdir(resolve(root, directory), { recursive: true });
    await writeFile(resolve(root, directory, 'value.ts'), 'export const v0=0;\n');
    await writeFile(resolve(root, directory, 'index.ts'), "export * from './value.ts';\n");
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', `${directory}/index.ts`, `${directory}/value.ts`]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the astronomy package loader is followed into its bake source, as when it sat under tools/prepare/astronomy', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-prepare-4b5-'));
  try {
    const directory = 'packages/bake/src/astronomy';
    await writeFile(resolve(root, 'entry.mts'), "import { v0 } from '@cssearth/bake/astronomy';\nexport const used=[v0];\n");
    await mkdir(resolve(root, directory), { recursive: true });
    await writeFile(resolve(root, directory, 'value.ts'), 'export const v0=0;\n');
    await writeFile(resolve(root, directory, 'index.ts'), "export * from './value.ts';\n");
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', `${directory}/index.ts`, `${directory}/value.ts`]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the provenance records and the runtime asset closure are followed into @cssearth/objects, as when they sat under src/platform', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-objects-platform-'));
  try {
    const entries = [['@cssearth/objects/provenance', 'packages/objects/src/provenance'], ['@cssearth/objects/node', 'packages/objects/src/node']] as const;
    await writeFile(resolve(root, 'entry.mts'), `${entries.map(([specifier], index) => `import { v${index} } from '${specifier}';`).join('\n')}\nexport const used=[${entries.map((_, index) => `v${index}`).join(',')}];\n`);
    for (const [index, [, directory]] of entries.entries()) {
      await mkdir(resolve(root, directory), { recursive: true });
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index};\n`);
      await writeFile(resolve(root, directory, 'index.ts'), "export * from './value.ts';\n");
    }
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', ...entries.flatMap(([, directory]) => [`${directory}/index.ts`, `${directory}/value.ts`])].sort());
    for (const [index, [, directory]] of entries.entries()) {
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index + 10};\n`);
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index};\n`);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the catalogue readers are followed into @cssearth/catalog, as when the spatial citations and navigation imported them by path', async () => {
  const CATALOGUE = ['packages/catalog/src/clusters.ts', 'packages/catalog/src/spatial-relations.ts', 'packages/catalog/src/spatial.ts'];
  for (const entry of ['packages/bake/src/sources/spatial-source-citations.ts', 'site/build/prepare/prepare-facilities.mts', 'packages/bake/src/navigation/navigation-destinations.ts']) {
    const paths = new Set((await closure(WORKSPACE, [entry])));
    for (const path of CATALOGUE) assert.ok(paths.has(path), `${entry} bundle names ${path}`);
  }
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-catalog-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { parsePreparedGalaxyCatalog } from '@cssearth/catalog';\nexport const used=[parsePreparedGalaxyCatalog];\n");
    await mkdir(resolve(root, 'packages/catalog/src'), { recursive: true });
    await writeFile(resolve(root, 'packages/catalog/src/spatial.ts'), 'export const parsePreparedGalaxyCatalog=()=>1;\n');
    await writeFile(resolve(root, 'packages/catalog/src/index.ts'), "export * from './spatial.js';\n");
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', 'packages/catalog/src/index.ts', 'packages/catalog/src/spatial.ts']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the FITS reader package is followed into its sources, as when it was a local module; other packages stay external', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-fits-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { readFitsHdus } from '@cssearth/fits'; import { readFitsFileHdus } from '@cssearth/fits/node'; import { isRecord } from '@cssearth/core';\nexport const used=[readFitsHdus,readFitsFileHdus,isRecord];\n");
    await mkdir(resolve(root, 'packages/fits/src/node'), { recursive: true });
    await writeFile(resolve(root, 'packages/fits/src/fits.ts'), 'export const readFitsHdus=()=>1;\n');
    await writeFile(resolve(root, 'packages/fits/src/index.ts'), "export { readFitsHdus } from './fits.js';\n");
    await writeFile(resolve(root, 'packages/fits/src/node/index.ts'), 'export const readFitsFileHdus=()=>2;\n');
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', 'packages/fits/src/fits.ts', 'packages/fits/src/index.ts', 'packages/fits/src/node/index.ts']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the source catalogue, manifest checks and main entry are followed into @cssearth/objects, as when they sat under src/platform and site', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-objects-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { parseSourceBinding } from '@cssearth/objects/sources'; import { validateSourceManifest } from '@cssearth/objects/node'; import { parseObjectDescriptor } from '@cssearth/objects';\nexport const used=[parseSourceBinding,validateSourceManifest,parseObjectDescriptor];\n");
    await mkdir(resolve(root, 'packages/objects/src/sources'), { recursive: true });
    await mkdir(resolve(root, 'packages/objects/src/node'), { recursive: true });
    await writeFile(resolve(root, 'packages/objects/src/sources/catalog.ts'), 'export const parseSourceBinding=()=>1;\n');
    await writeFile(resolve(root, 'packages/objects/src/sources/index.ts'), "export * from './catalog.js';\n");
    await writeFile(resolve(root, 'packages/objects/src/node/index.ts'), 'export const validateSourceManifest=()=>2;\n');
    await mkdir(resolve(root, 'packages/objects/src/registry'), { recursive: true });
    await writeFile(resolve(root, 'packages/objects/src/registry/world-rotation.ts'), 'export const parseObjectDescriptor=()=>4;\n');
    await writeFile(resolve(root, 'packages/objects/src/index.ts'), "export { parseObjectDescriptor } from './registry/world-rotation.js';\n");
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', 'packages/objects/src/index.ts', 'packages/objects/src/node/index.ts',
      'packages/objects/src/registry/world-rotation.ts', 'packages/objects/src/sources/catalog.ts', 'packages/objects/src/sources/index.ts']);
    // A dependency of the main entry is followed too: the renderer's world-rotation validation lives there now.
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the telescope library is followed into its sources, as when its modules sat under tools/objects', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-telescope-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { parseProductRecord } from '@cssearth/telescope'; import { runKey } from '@cssearth/telescope/node';\nexport const used=[parseProductRecord,runKey];\n");
    await mkdir(resolve(root, 'packages/telescope/src/node'), { recursive: true });
    await writeFile(resolve(root, 'packages/telescope/src/product-record.ts'), 'export const parseProductRecord=()=>1;\n');
    await writeFile(resolve(root, 'packages/telescope/src/index.ts'), "export { parseProductRecord } from './product-record.js';\n");
    await writeFile(resolve(root, 'packages/telescope/src/node/index.ts'), 'export const runKey=()=>2;\n');
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', 'packages/telescope/src/index.ts', 'packages/telescope/src/node/index.ts', 'packages/telescope/src/product-record.ts']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the shared object libraries are followed into their bake sources, as when they sat under tools/objects', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-bake-objects-'));
  const topics = ['acquisition', 'cameras', 'candidates', 'celestial', 'charts', 'color', 'content', 'default-view', 'geometry', 'host-adapters', 'interpretation', 'raster', 'scene', 'sources', 'sphere-survey', 'stellar', 'surface-features', 'layers/observation', 'layers/shape-model', 'layers/cutaway', 'layers/giant', 'layers/material-composition', 'layers/observed-surfaces', 'layers/paged-ellipsoid', 'layers/terrestrial'];
  try {
    await writeFile(resolve(root, 'entry.mts'), `${topics.map(topic => `import * as ${topic.replace(/\W/gu, '_')} from '@cssearth/bake/objects/${topic}';`).join(' ')}\nexport const used=[${topics.map(topic => topic.replace(/\W/gu, '_')).join(',')}];\n`);
    for (const topic of topics) {
      await mkdir(resolve(root, `packages/bake/src/objects/${topic}`), { recursive: true });
      await writeFile(resolve(root, `packages/bake/src/objects/${topic}/library.ts`), 'export const method=1;\n');
      await writeFile(resolve(root, `packages/bake/src/objects/${topic}/index.ts`), "export * from './library.ts';\n");
    }
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', ...topics.flatMap(topic => [`packages/bake/src/objects/${topic}/index.ts`, `packages/bake/src/objects/${topic}/library.ts`]).sort()]);
    for (const topic of topics) {
      await writeFile(resolve(root, `packages/bake/src/objects/${topic}/library.ts`), 'export const method=2;\n');
      await writeFile(resolve(root, `packages/bake/src/objects/${topic}/library.ts`), 'export const method=1;\n');
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the telescope command package is followed into its sources, as when its modules sat under tools/objects/telescopes', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-telescope-cli-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { query } from '@cssearth/telescope-cli/query'; import { ledger } from '@cssearth/telescope-cli/archives/ledger'; export const used = [query, ledger];\n");
    await mkdir(resolve(root, 'packages/telescope-cli/src/archives'), { recursive: true });
    await writeFile(resolve(root, 'packages/telescope-cli/package.json'), JSON.stringify({ exports: {
      './query': { types: './src/query.mts', default: './src/query.mts' }, './archives/ledger': './src/archives/ledger.mts' } }));
    await writeFile(resolve(root, 'packages/telescope-cli/src/query.mts'), "import { step } from './step.mts'; export const query = step;\n");
    await writeFile(resolve(root, 'packages/telescope-cli/src/step.mts'), 'export const step = 1;\n');
    await writeFile(resolve(root, 'packages/telescope-cli/src/archives/ledger.mts'), 'export const ledger = 1;\n');
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', 'packages/telescope-cli/src/archives/ledger.mts', 'packages/telescope-cli/src/query.mts', 'packages/telescope-cli/src/step.mts'],
      'a nested subpath (archives/ledger) is followed as a single-segment one is');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a telescope command subpath is followed to the source its package exports declare, digits included (imaging/image3)', async () => {
  const specifier = '@cssearth/telescope-cli/archives/jwst/imaging/image3', source = 'packages/telescope-cli/src/archives/jwst/imaging/image3.mts';
  const composite = await closure(WORKSPACE, ['packages/telescope-cli/src/sky/sky-band-composite.mts']);
  assert.ok(composite.includes(source), 'the observation composite bundles the JWST image3 source it imports');
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-telescope-cli-exports-'));
  try {
    await mkdir(resolve(root, dirname(source)), { recursive: true });
    await writeFile(resolve(root, 'packages/telescope-cli/package.json'), await readFile(resolve(WORKSPACE, 'packages/telescope-cli/package.json')));
    await writeFile(resolve(root, 'entry.mts'), `import { stage } from '${specifier}'; export const used = stage;\n`);
    await writeFile(resolve(root, source), 'export const stage = 1;\n');
    const found = await closure(root, ['entry.mts']);
    assert.deepEqual(found, ['entry.mts', source], 'followed through the real exports entry');
    await writeFile(resolve(root, 'entry.mts'), "import { stage } from '@cssearth/telescope-cli/archives/jwst/imaging/unexported'; export const used = stage;\n");
    assert.deepEqual((await closure(root, ['entry.mts'])), ['entry.mts'], 'an unexported subpath stays external');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the sphere lane bundle follows the native camera, resize input and carried values it renders with, as when they sat under tools/experiments/native-scroll', async () => {
  const paths = await closure(WORKSPACE, ['packages/telescope-cli/src/sphere/sphere-html.mts']);
  for (const name of ['carry-values', 'css-values', 'native-camera', 'resize-input'])
    assert.ok(paths.includes(`packages/telescope-cli/src/sphere/native-scroll/${name}.mts`), `${name} joins the sphere lane bundle`);
});
