import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile, type FileHandle } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { contextObjectAssetUrls, contextObjectJsonModule, contextObjectModule, prepareCatalog, splitContextObjectAssets } from './prepare-catalog.mts';
import { readCatalog } from '@cssearth/objects/node';
import { prepareSceneDistance } from '@cssearth/bake/navigation';
import { prepareBodyRecords } from '../../../../packages/astronomy/cli/body-records.mts';
import { literalRecords } from '../../../../packages/astronomy/cli/lib/write-record-sections.mts';
import type { PathLike } from 'node:fs';

const write = async (path: string, value: unknown) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
};

test('dev context resources are their inventory files on the dev server, never a module per file', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-context-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await write(resolve(root, 'src/objects/nebula/inventory.json'), {
    schema: 'cssearth-inventory@1', assets: [
      { location: 'prepared', filename: 'atlases/x.webp', sha256: 'a'.repeat(64), bytes: 10 },
      { filename: 'nebula-arrival.webp', sha256: 'b'.repeat(64), bytes: 20, location: 'public' },
    ],
  });
  const assets = await contextObjectAssetUrls([{ id: 'nebula' }], root, null);
  assert.deepEqual(assets, { '../src/objects/nebula/prepared/atlases/x.webp': '/src/objects/nebula/prepared/atlases/x.webp' });
  const source = contextObjectModule([{ id: 'nebula' }], assets);
  assert.match(source, /"\.\.\/src\/objects\/nebula\/prepared\/atlases\/x\.webp":"\/src\/objects\/nebula\/prepared\/atlases\/x\.webp"/u);
  assert.doesNotMatch(source, /\?url|prepared\/\*\*/u, 'No prepared file enters the runtime module graph.');
});

test('a dataset bank lists its files apart; the application names only the other context objects\' files', () => {
  const assets = { '../src/objects/m31-layers/prepared/a.webp': '/a', '../src/objects/m1-volume/prepared/b.webp': '/b', '../src/objects/milky-way-volume/prepared/c.bin': '/c' };
  const { inline, banks } = splitContextObjectAssets([{ id: 'm31-layers', type: 'image-layer-bank' }, { id: 'm1-volume', type: 'volume-dataset-bank' },
    { id: 'milky-way-volume', type: 'density-volume' }, { id: 'empty-layers', type: 'image-layer-bank' }], assets);
  assert.deepEqual(inline, { '../src/objects/milky-way-volume/prepared/c.bin': '/c' });
  assert.deepEqual(banks, { 'empty-layers': {}, 'm1-volume': { '../src/objects/m1-volume/prepared/b.webp': '/b' }, 'm31-layers': { '../src/objects/m31-layers/prepared/a.webp': '/a' } });
});

test('the build reads three named prepared files and the source manifest per context object, never a catalogue bank', () => {
  const source = contextObjectJsonModule([{ id: 'm33' }]);
  assert.match(source, /'\.\.\/src\/objects\/m33\/prepared\/\{datasets,datasets,presentation\}\.json'/u);
  assert.match(source, /'\.\.\/src\/objects\/m33\/source\/manifest\.json'/u);
  assert.doesNotMatch(source, /prepared\/\*\.json/u);
});

test('each generated glob names a base the dev server accepts', () => {
  const source = contextObjectModule([{ id: 'nebula' }], {}) + contextObjectJsonModule([{ id: 'm33' }]);
  const bases = [...source.matchAll(/import\.meta\.glob\(.*?\{ base: '([^']*)'/gu)].map(match => match[1]!);
  assert.equal(bases.length, 3);
  // Vite's dev transform refuses a base that does not start with '/', './' or '../'; the build's own glob plugin takes '..'.
  for (const base of bases) assert.match(base, /^(?:\/|\.\/|\.\.\/)/u, `import.meta.glob base '${base}' fails in astro dev.`);
});

test('asset-origin context resources come from inventories without local prepared bytes', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-context-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await write(resolve(root, 'src/objects/nearby-universe-galaxies/inventory.json'), {
    schema: 'cssearth-inventory@1', assets: [
      { location: 'prepared', filename: 'dots.json', sha256: 'a'.repeat(64), bytes: 10 },
      { location: 'prepared', filename: 'galaxies.json', sha256: 'b'.repeat(64), bytes: 20 },
      { filename: 'datasets/preview.webp', sha256: 'c'.repeat(64), bytes: 30, location: 'public' },
    ],
  });
  const origin = 'https://assets.example.test';
  const assets = await contextObjectAssetUrls([{ id: 'nearby-universe-galaxies' }], root, origin);
  assert.deepEqual(assets, {
    '../src/objects/nearby-universe-galaxies/prepared/galaxies.json': `${origin}/runtime-assets/${'b'.repeat(64)}/galaxies.json`,
    '../src/objects/nearby-universe-galaxies/prepared/dots.json': `${origin}/runtime-assets/${'a'.repeat(64)}/dots.json`,
  });
  const source = contextObjectModule([{ id: 'nearby-universe-galaxies' }], assets);
  assert.match(source, /https:\/\/assets\.example\.test\/runtime-assets/u);
  assert.doesNotMatch(source, /query: '\?url&no-inline'/u);
});

async function addBody(root: string, id: string, classification: string, parent = 'sun') {
  await write(resolve(root, `src/objects/${id}/object.json`), {
    schema: 'cssearth-object@2', id, type: 'test', properties: {
      recipe: { sources: [] },
      worldFrame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: id === 'sun' ? [0,0,0] : [1,0,0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1 },
      catalog: { name: id, classification, systemName: 'Solar System', color: '#aaaaaa',
        distanceAu: 3, description: 'Synthetic catalogue test input.', context: {} },
    },
  });
  await write(resolve(root, `packages/astronomy/data/bodies/${id}.json`), {
    id, classification, physical: { name: id, horizonsCode: null, meanRadiusKm: 1,
      gravitationalParameterKm3PerS2: 0, parent: id === 'sun' ? null : parent },
  });
  await write(resolve(root, `src/objects/${id}/prepared/runtime.json`), { schema: 'cssearth-object-runtime@5', id, camera: JSON.parse(await readFile(new URL('../../../../src/objects/mercury/prepared/runtime.json', import.meta.url), 'utf8')).camera });
  await write(resolve(root, `src/objects/${id}/prepared/controls.json`), { datasets: { controls: [] } });
}

test('independent asteroid, moon and comet branches merge without changing existing packages', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-body-branches-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Body addition test');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'core.hooksPath', '/dev/null');
  await write(resolve(root, '.gitignore'), '/site/prepared/prepared-catalogue.mjs\n/site/prepared/prepared-overview-objects.json\n/site/prepared/prepared-context-objects.mts\n/packages/astronomy/src/data/generated/\n');
  await mkdir(resolve(root, 'packages/astronomy/data/fixtures'), { recursive: true });
  await addBody(root, 'sun', 'star');
  await addBody(root, 'existing-body', 'asteroid');
  const compile = async () => {
    await prepareCatalog({ projectRoot: root });
    await prepareBodyRecords(resolve(root, 'packages/astronomy'));
  };
  await compile();
  git('add', '.'); git('commit', '-m', 'Base bodies');
  const base = git('rev-parse', 'HEAD');
  const existingFiles = git('ls-files').split('\n');
  const before = new Map(await Promise.all(existingFiles.map(async file => [file, await readFile(resolve(root, file))] as const)));
  for (const [id, classification] of [['new-asteroid', 'asteroid'], ['new-moon', 'satellite'], ['new-comet', 'comet']]) {
    git('checkout', '-b', id, base);
    await addBody(root, id, classification, classification === 'satellite' ? 'existing-body' : 'sun');
    await compile();
    git('add', '.'); git('commit', '-m', `Add ${id}`);
    const changed = git('diff', '--name-only', base, 'HEAD').split('\n');
    assert.ok(changed.every(file => file.includes(`/${id}/`) || file.endsWith(`/${id}.json`)), changed.join('\n'));
  }
  git('checkout', 'main');
  for (const id of ['new-asteroid', 'new-moon', 'new-comet']) git('merge', '--no-edit', id);
  await compile();
  assert.equal(git('status', '--porcelain'), '', 'Compilation must not write tracked shared files.');
  for (const [file, bytes] of before) assert.deepEqual(await readFile(resolve(root, file)), bytes, file);
  assert.deepEqual((await readCatalog(resolve(root, 'src/objects'), prepareSceneDistance)).map(body => body.id),
    ['existing-body', 'new-asteroid', 'new-comet', 'new-moon', 'sun']);
  const compiled = await readFile(resolve(root, 'packages/astronomy/src/data/generated/bodies.ts'), 'utf8');
  for (const id of ['new-asteroid', 'new-moon', 'new-comet']) assert.ok(compiled.includes(JSON.stringify(id)));
});

test('an unfinished folder stays unpublished and a mismatched descriptor fails', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-catalog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await addBody(root, 'sun', 'star');
  const path = resolve(root, 'src/objects/planned/object.json');
  await write(path, { schema: 'cssearth-object@2', id: 'planned', properties: {} });
  assert.deepEqual((await readCatalog(resolve(root, 'src/objects'), prepareSceneDistance)).map(body => body.id), ['sun']);
  const descriptor = JSON.parse(await readFile(resolve(root, 'src/objects/sun/object.json'), 'utf8'));
  await write(path, descriptor);
  await assert.rejects(readCatalog(resolve(root, 'src/objects'), prepareSceneDistance), /identity differs/);
});

test('retained-record decoding accepts quoted body IDs and rejects executable source', () => {
  assert.deepEqual(literalRecords('export const RECORDS = { "test-moon": { value: -1, samples: [2, null] } } as const', 'RECORDS'),
    { 'test-moon': { value: -1, samples: [2, null] } });
  assert.throws(() => literalRecords('export const RECORDS = { body: process.exit(0) }', 'RECORDS'), /Expected a numeric source record/);
  assert.throws(() => literalRecords('export const RECORDS = { ...otherRecords }', 'RECORDS'), /literal record property/);
});
