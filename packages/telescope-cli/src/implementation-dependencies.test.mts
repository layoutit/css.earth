import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { WORKSPACE } from '@cssearth/telescope/node';
import { implementationFingerprint } from './implementation-dependencies.mts';

test('implementation identity follows transitive local TypeScript imports', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-closure-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { value } from './helper.mts'; export const answer=value;\n");
    await writeFile(resolve(root, 'helper.mts'), 'export const value=1;\n');
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', 'helper.mts']);
    await writeFile(resolve(root, 'helper.mts'), 'export const value=2;\n');
    const after = await implementationFingerprint(root, ['entry.mts']);
    assert.notEqual(after.sha256, before.sha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('production-shaped two-entry fingerprints retain both dependency closures without writing bundles', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-multiple-'));
  try {
    await writeFile(resolve(root, 'dispatcher.mts'), "import './shared.mts'; export const dispatch=true;\n");
    await writeFile(resolve(root, 'owner.mts'), "import './shared.mts'; import './science.mts'; export const owner=true;\n");
    await writeFile(resolve(root, 'shared.mts'), 'export const shared=1;\n');
    await writeFile(resolve(root, 'science.mts'), 'export const method=1;\n');
    const found = await implementationFingerprint(root, ['dispatcher.mts', 'owner.mts']);
    assert.deepEqual(found.files.map(file => file.path), ['dispatcher.mts', 'owner.mts', 'science.mts', 'shared.mts']);
    await assert.rejects(readFile(resolve(root, '.fingerprint-output/dispatcher.js')), /ENOENT/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('fingerprints generated-module imports through authored sources without a dist build', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-authored-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { value } from './dist/universe.js'; export const answer=value;\n");
    await mkdir(resolve(root, 'universe'), { recursive: true });
    await writeFile(resolve(root, 'universe/index.ts'), 'export const value=1;\n');
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', 'universe/index.ts']);
    await mkdir(resolve(root, 'dist'));
    await writeFile(resolve(root, 'dist/universe.js'), 'export const value=999;\n');
    const withBuild = await implementationFingerprint(root, ['entry.mts']);
    assert.equal(withBuild.sha256, before.sha256);
    await writeFile(resolve(root, 'universe/index.ts'), 'export const value=2;\n');
    const after = await implementationFingerprint(root, ['entry.mts']);
    assert.notEqual(after.sha256, before.sha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the runtime-source reader is followed into @cssearth/bake/runtime-source, as when it sat under tools/ci', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-runtime-source-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { parseRuntimeSource } from '@cssearth/bake/runtime-source';\nexport const used=[parseRuntimeSource];\n");
    await mkdir(resolve(root, 'packages/bake/src/runtime-source'), { recursive: true });
    await writeFile(resolve(root, 'packages/bake/src/runtime-source/runtime-source-graph.ts'), 'export const parseRuntimeSource=()=>1;\n');
    await writeFile(resolve(root, 'packages/bake/src/runtime-source/index.ts'), "export * from './runtime-source-graph.ts';\n");
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', 'packages/bake/src/runtime-source/index.ts', 'packages/bake/src/runtime-source/runtime-source-graph.ts']);
    await writeFile(resolve(root, 'packages/bake/src/runtime-source/runtime-source-graph.ts'), 'export const parseRuntimeSource=()=>2;\n');
    assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, before.sha256);
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
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', ...entries.flatMap(([, directory]) => [`${directory}/index.ts`, `${directory}/value.ts`])].sort());
    await writeFile(resolve(root, 'packages/bake/src/delivery/value.ts'), 'export const v1=10;\n');
    assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, before.sha256);
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
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', ...entries.flatMap(([, directory]) => [`${directory}/index.ts`, `${directory}/value.ts`])].sort());
    for (const [index, [, directory]] of entries.entries()) {
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index + 10};\n`);
      assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, before.sha256, directory);
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index};\n`);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the galaxy-field and layered-provenance libraries are followed into their bake sources, as when they sat under tools/', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-prepare-4b4-'));
  try {
    const entries = [['@cssearth/bake/galaxy-field', 'packages/bake/src/galaxy-field'], ['@cssearth/bake/objects/provenance', 'packages/bake/src/objects/provenance']] as const;
    await writeFile(resolve(root, 'entry.mts'), `${entries.map(([specifier], index) => `import { v${index} } from '${specifier}';`).join('\n')}\nexport const used=[${entries.map((_, index) => `v${index}`).join(',')}];\n`);
    for (const [index, [, directory]] of entries.entries()) {
      await mkdir(resolve(root, directory), { recursive: true });
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index};\n`);
      await writeFile(resolve(root, directory, 'index.ts'), "export * from './value.ts';\n");
    }
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', ...entries.flatMap(([, directory]) => [`${directory}/index.ts`, `${directory}/value.ts`])].sort());
    for (const [index, [, directory]] of entries.entries()) {
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index + 10};\n`);
      assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, before.sha256, directory);
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index};\n`);
    }
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
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', `${directory}/index.ts`, `${directory}/value.ts`]);
    await writeFile(resolve(root, directory, 'value.ts'), 'export const v0=10;\n');
    assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, before.sha256);
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
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', ...entries.flatMap(([, directory]) => [`${directory}/index.ts`, `${directory}/value.ts`])].sort());
    for (const [index, [, directory]] of entries.entries()) {
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index + 10};\n`);
      assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, before.sha256, directory);
      await writeFile(resolve(root, directory, 'value.ts'), `export const v${index}=${index};\n`);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the catalogue readers are followed into @cssearth/catalog, as when the spatial citations and navigation imported them by path', async () => {
  const CATALOGUE = ['packages/catalog/src/clusters.ts', 'packages/catalog/src/spatial-relations.ts', 'packages/catalog/src/spatial.ts'];
  for (const entry of ['packages/bake/src/sources/spatial-source-citations.ts', 'tools/prepare/prepare-facilities.mts', 'packages/bake/src/navigation/navigation-destinations.ts']) {
    const paths = new Set((await implementationFingerprint(WORKSPACE, [entry])).files.map(file => file.path));
    for (const path of CATALOGUE) assert.ok(paths.has(path), `${entry} identity names ${path}`);
  }
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-catalog-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { parsePreparedGalaxyCatalog } from '@cssearth/catalog';\nexport const used=[parsePreparedGalaxyCatalog];\n");
    await mkdir(resolve(root, 'packages/catalog/src'), { recursive: true });
    await writeFile(resolve(root, 'packages/catalog/src/spatial.ts'), 'export const parsePreparedGalaxyCatalog=()=>1;\n');
    await writeFile(resolve(root, 'packages/catalog/src/index.ts'), "export * from './spatial.js';\n");
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', 'packages/catalog/src/index.ts', 'packages/catalog/src/spatial.ts']);
    await writeFile(resolve(root, 'packages/catalog/src/spatial.ts'), 'export const parsePreparedGalaxyCatalog=()=>2;\n');
    assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, before.sha256);
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
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', 'packages/fits/src/fits.ts', 'packages/fits/src/index.ts', 'packages/fits/src/node/index.ts']);
    await writeFile(resolve(root, 'packages/fits/src/fits.ts'), 'export const readFitsHdus=()=>3;\n');
    assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, before.sha256);
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
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', 'packages/objects/src/index.ts', 'packages/objects/src/node/index.ts',
      'packages/objects/src/registry/world-rotation.ts', 'packages/objects/src/sources/catalog.ts', 'packages/objects/src/sources/index.ts']);
    await writeFile(resolve(root, 'packages/objects/src/sources/catalog.ts'), 'export const parseSourceBinding=()=>3;\n');
    const changedSources = await implementationFingerprint(root, ['entry.mts']);
    assert.notEqual(changedSources.sha256, before.sha256);
    // A dependency of the main entry is an owner too: the renderer's world-rotation validation lives there now.
    await writeFile(resolve(root, 'packages/objects/src/registry/world-rotation.ts'), 'export const parseObjectDescriptor=()=>5;\n');
    assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, changedSources.sha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the telescope library is followed into its sources, as when its modules sat under tools/objects', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-telescope-'));
  try {
    await writeFile(resolve(root, 'entry.mts'), "import { parseProductRecord } from '@cssearth/telescope'; import { runDigest } from '@cssearth/telescope/node';\nexport const used=[parseProductRecord,runDigest];\n");
    await mkdir(resolve(root, 'packages/telescope/src/node'), { recursive: true });
    await writeFile(resolve(root, 'packages/telescope/src/product-record.ts'), 'export const parseProductRecord=()=>1;\n');
    await writeFile(resolve(root, 'packages/telescope/src/index.ts'), "export { parseProductRecord } from './product-record.js';\n");
    await writeFile(resolve(root, 'packages/telescope/src/node/index.ts'), 'export const runDigest=()=>2;\n');
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', 'packages/telescope/src/index.ts', 'packages/telescope/src/node/index.ts', 'packages/telescope/src/product-record.ts']);
    await writeFile(resolve(root, 'packages/telescope/src/product-record.ts'), 'export const parseProductRecord=()=>3;\n');
    assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, before.sha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the shared object libraries are followed into their bake sources, as when they sat under tools/objects', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-bake-objects-'));
  const topics = ['cameras', 'candidates', 'charts', 'color', 'content', 'geometry', 'raster', 'scene', 'sources', 'stellar', 'surface-features', 'layers/observation', 'layers/shape-model', 'layers/cutaway', 'layers/giant', 'layers/material-composition', 'layers/observed-surfaces', 'layers/paged-ellipsoid', 'layers/terrestrial'];
  try {
    await writeFile(resolve(root, 'entry.mts'), `${topics.map(topic => `import * as ${topic.replace(/\W/gu, '_')} from '@cssearth/bake/objects/${topic}';`).join(' ')}\nexport const used=[${topics.map(topic => topic.replace(/\W/gu, '_')).join(',')}];\n`);
    for (const topic of topics) {
      await mkdir(resolve(root, `packages/bake/src/objects/${topic}`), { recursive: true });
      await writeFile(resolve(root, `packages/bake/src/objects/${topic}/library.ts`), 'export const method=1;\n');
      await writeFile(resolve(root, `packages/bake/src/objects/${topic}/index.ts`), "export * from './library.ts';\n");
    }
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', ...topics.flatMap(topic => [`packages/bake/src/objects/${topic}/index.ts`, `packages/bake/src/objects/${topic}/library.ts`]).sort()]);
    for (const topic of topics) {
      await writeFile(resolve(root, `packages/bake/src/objects/${topic}/library.ts`), 'export const method=2;\n');
      const after = await implementationFingerprint(root, ['entry.mts']);
      assert.notEqual(after.sha256, before.sha256, topic);
      await writeFile(resolve(root, `packages/bake/src/objects/${topic}/library.ts`), 'export const method=1;\n');
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a workspace command the operation runs as a process is followed into its source, as when the operation imported it', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-dispatch-'));
  try {
    await mkdir(resolve(root, 'workspace-commands'), { recursive: true });
    await writeFile(resolve(root, 'entry.mts'), "import { BAKE } from './workspace-commands/bake.mts'; export const run = BAKE;\n");
    await writeFile(resolve(root, 'workspace-commands/bake.mts'), "export const BAKE = { script: 'dist/bake.js', source: 'bake.mts' };\n");
    await writeFile(resolve(root, 'bake.mts'), "import { step } from './step.mts'; export const bake = step;\n");
    await writeFile(resolve(root, 'step.mts'), 'export const step = 1;\n');
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['bake.mts', 'entry.mts', 'step.mts', 'workspace-commands/bake.mts']);
    await writeFile(resolve(root, 'step.mts'), 'export const step = 2;\n');
    assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, before.sha256);
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
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', 'packages/telescope-cli/src/archives/ledger.mts', 'packages/telescope-cli/src/query.mts', 'packages/telescope-cli/src/step.mts'],
      'a nested subpath (archives/ledger) is followed as a single-segment one is');
    await writeFile(resolve(root, 'packages/telescope-cli/src/archives/ledger.mts'), 'export const ledger = 2;\n');
    const ledgerChanged = await implementationFingerprint(root, ['entry.mts']);
    assert.notEqual(ledgerChanged.sha256, before.sha256);
    await writeFile(resolve(root, 'packages/telescope-cli/src/step.mts'), 'export const step = 2;\n');
    assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, ledgerChanged.sha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a telescope command subpath is followed to the source its package exports declare, digits included (imaging/image3)', async () => {
  const specifier = '@cssearth/telescope-cli/archives/jwst/imaging/image3', source = 'packages/telescope-cli/src/archives/jwst/imaging/image3.mts';
  const composite = await implementationFingerprint(WORKSPACE, ['tools/objects/observation/sky-band-composite.mts']);
  assert.ok(composite.files.some(file => file.path === source), 'the observation composite identity holds the JWST image3 source it imports');
  const root = await mkdtemp(resolve(tmpdir(), 'implementation-telescope-cli-exports-'));
  try {
    await mkdir(resolve(root, dirname(source)), { recursive: true });
    await writeFile(resolve(root, 'packages/telescope-cli/package.json'), await readFile(resolve(WORKSPACE, 'packages/telescope-cli/package.json')));
    await writeFile(resolve(root, 'entry.mts'), `import { stage } from '${specifier}'; export const used = stage;\n`);
    await writeFile(resolve(root, source), 'export const stage = 1;\n');
    const before = await implementationFingerprint(root, ['entry.mts']);
    assert.deepEqual(before.files.map(file => file.path), ['entry.mts', source], 'followed through the real exports entry');
    await writeFile(resolve(root, source), 'export const stage = 2;\n');
    assert.notEqual((await implementationFingerprint(root, ['entry.mts'])).sha256, before.sha256, 'a change to image3 moves the identity');
    await writeFile(resolve(root, 'entry.mts'), "import { stage } from '@cssearth/telescope-cli/archives/jwst/imaging/unexported'; export const used = stage;\n");
    assert.deepEqual((await implementationFingerprint(root, ['entry.mts'])).files.map(file => file.path), ['entry.mts'], 'an unexported subpath stays external');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the sphere lane identity follows the native camera, resize input and carried values it renders with, as when they sat under tools/experiments/native-scroll', async () => {
  const lane = await implementationFingerprint(WORKSPACE, ['tools/objects/telescope-sphere/sphere-html.mts']);
  const paths = lane.files.map(file => file.path);
  for (const name of ['carry-values', 'css-values', 'native-camera', 'resize-input'])
    assert.ok(paths.includes(`packages/telescope-cli/src/sphere/native-scroll/${name}.mts`), `${name} joins the sphere lane identity`);
});
