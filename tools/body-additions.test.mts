import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile, type FileHandle } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { readCatalog, prepareCatalog } from './prepare-catalog.mts';
import { prepareBodyRecords } from '../packages/astronomy/tools/body-records.mts';
import { literalRecords } from '../packages/astronomy/tools/lib/write-record-sections.mts';
import type { PathLike } from 'node:fs';

const write = async (path: string, value: unknown) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
};

async function addBody(root: string, id: string, classification: string, parent = 'sun') {
  await write(resolve(root, `src/objects/${id}/object.json`), {
    schema: 'cssearth-object@1', id, type: 'test', properties: {
      catalog: { name: id, classification, systemName: 'Solar System', color: '#aaaaaa',
        distanceAu: 3, description: 'Synthetic catalogue test input.', context: {} },
    },
  });
  await write(resolve(root, `packages/astronomy/data/bodies/${id}.json`), {
    id, classification, physical: { name: id, horizonsCode: null, meanRadiusKm: 1,
      gravitationalParameterKm3PerS2: 0, parent: id === 'sun' ? null : parent },
  });
  await write(resolve(root, `src/objects/${id}/prepared/runtime.json`), { id });
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
  await write(resolve(root, '.gitignore'), '/site/prepared-object-catalog.mts\n/packages/astronomy/src/data/generated/\n');
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
  assert.deepEqual((await readCatalog(resolve(root, 'src/objects'))).map(body => body.id),
    ['existing-body', 'new-asteroid', 'new-comet', 'new-moon', 'sun']);
  const compiled = await readFile(resolve(root, 'packages/astronomy/src/data/generated/bodies.ts'), 'utf8');
  for (const id of ['new-asteroid', 'new-moon', 'new-comet']) assert.ok(compiled.includes(JSON.stringify(id)));
});

test('an unfinished folder stays unpublished and a mismatched descriptor fails', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-catalog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await addBody(root, 'sun', 'star');
  const path = resolve(root, 'src/objects/planned/object.json');
  await write(path, { schema: 'cssearth-object@1', id: 'planned', properties: {} });
  assert.deepEqual((await readCatalog(resolve(root, 'src/objects'))).map(body => body.id), ['sun']);
  const descriptor = JSON.parse(await readFile(resolve(root, 'src/objects/sun/object.json'), 'utf8'));
  await write(path, descriptor);
  await assert.rejects(readCatalog(resolve(root, 'src/objects')), /identity differs/);
});

test('retained-record decoding accepts quoted body IDs and rejects executable source', () => {
  assert.deepEqual(literalRecords('export const RECORDS = { "test-moon": { value: -1, samples: [2, null] } } as const', 'RECORDS'),
    { 'test-moon': { value: -1, samples: [2, null] } });
  assert.throws(() => literalRecords('export const RECORDS = { body: process.exit(0) }', 'RECORDS'), /Expected a numeric source record/);
  assert.throws(() => literalRecords('export const RECORDS = { ...otherRecords }', 'RECORDS'), /literal record property/);
});
