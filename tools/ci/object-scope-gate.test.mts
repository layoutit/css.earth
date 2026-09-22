import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { DEFAULT_OBJECT_DIRECTORY_LIMIT, PIPELINE_CHANGE_LABEL, evaluateObjectScopeGate,
  objectScopeGate, parseLabelsArgument, touchedObjectDirectories } from './object-scope-gate.mts';

const execFileAsync = promisify(execFile);

function pathsFor(ids: readonly string[]): string[] {
  return ids.map(id => `src/objects/${id}/prepared/runtime.json`);
}

// a..n: 14 object ids, matching the default limit exactly, so any undercount below the real 12-limit boundary
// would silently pass instead of failing.
const FOURTEEN_IDS = 'abcdefghijklmn'.split('');

/** A real, throwaway git repository (git's actual rename detection is the thing under test — an injected
 * changedPaths fixture in the tests above cannot reproduce it) with one committed file per id under
 * `src/objects/<id>/file.txt`. */
async function fixtureGitRepoWithFourteenObjects(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'object-scope-rename-'));
  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  await execFileAsync('git', ['config', 'user.email', 'fixture@example.com'], { cwd: root });
  await execFileAsync('git', ['config', 'user.name', 'Fixture'], { cwd: root });
  for (const id of FOURTEEN_IDS) {
    await mkdir(resolve(root, 'src/objects', id), { recursive: true });
    await writeFile(resolve(root, 'src/objects', id, 'file.txt'), `content for ${id}\n`.repeat(20));
  }
  await execFileAsync('git', ['add', '-A'], { cwd: root });
  await execFileAsync('git', ['commit', '-q', '-m', 'base: 14 objects'], { cwd: root });
  return root;
}

async function commitAll(root: string, message: string): Promise<void> {
  await execFileAsync('git', ['add', '-A'], { cwd: root });
  await execFileAsync('git', ['commit', '-q', '-m', message], { cwd: root });
}

test('touchedObjectDirectories extracts the distinct object ids from src/objects/<id>/ paths', () => {
  const ids = touchedObjectDirectories([
    'src/objects/hebe/inventory.json',
    'src/objects/hebe/prepared/runtime.json',
    'src/objects/iris/inventory.json',
    'README.md',
    'src/objects/README.md', // no trailing object id, must not match
    'site/objects.mts',
  ]);
  assert.deepEqual([...ids].sort(), ['hebe', 'iris']);
});

test('touchedObjectDirectories refuses to silently drop an id outside [a-z][a-z0-9-]*', () => {
  assert.throws(() => touchedObjectDirectories(['src/objects/Bad_Id/object.json']), /Unexpected object id/);
});

test('a PR at or under the limit passes with no label needed', () => {
  const result = evaluateObjectScopeGate(pathsFor(Array.from({ length: DEFAULT_OBJECT_DIRECTORY_LIMIT }, (_v, i) => `body-${i}`)), []);
  assert.equal(result.count, DEFAULT_OBJECT_DIRECTORY_LIMIT);
  assert.equal(result.ok, true);
  assert.equal(result.exempted, false);
});

test('a PR over the limit without the label fails', () => {
  const result = evaluateObjectScopeGate(pathsFor(Array.from({ length: DEFAULT_OBJECT_DIRECTORY_LIMIT + 1 }, (_v, i) => `body-${i}`)), []);
  assert.equal(result.count, DEFAULT_OBJECT_DIRECTORY_LIMIT + 1);
  assert.equal(result.ok, false);
  assert.equal(result.exempted, false);
});

test('a PR over the limit with the pipeline-change label passes, exempted', () => {
  const paths = pathsFor(Array.from({ length: DEFAULT_OBJECT_DIRECTORY_LIMIT + 5 }, (_v, i) => `body-${i}`));
  const result = evaluateObjectScopeGate(paths, [{ name: 'documentation' }, { name: PIPELINE_CHANGE_LABEL }]);
  assert.equal(result.ok, true);
  assert.equal(result.exempted, true);
  assert.equal(result.count, DEFAULT_OBJECT_DIRECTORY_LIMIT + 5);
});

test('an unrelated label does not exempt an over-limit PR', () => {
  const paths = pathsFor(Array.from({ length: DEFAULT_OBJECT_DIRECTORY_LIMIT + 1 }, (_v, i) => `body-${i}`));
  const result = evaluateObjectScopeGate(paths, [{ name: 'documentation' }, { name: 'good-first-issue' }]);
  assert.equal(result.ok, false);
  assert.equal(result.exempted, false);
});

test('a custom limit is honored', () => {
  const result = evaluateObjectScopeGate(pathsFor(['a', 'b', 'c']), [], { limit: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.limit, 2);
});

test('objectScopeGate computes paths from a three-dot diff against the given ref', async () => {
  const seen: string[] = [];
  const result = await objectScopeGate('origin/main', [], { changedPaths: async ref => { seen.push(ref); return pathsFor(['earth', 'mars']); } });
  assert.deepEqual(seen, ['origin/main']);
  assert.deepEqual(result.touched, ['earth', 'mars']);
  assert.equal(result.ok, true);
});

test('parseLabelsArgument tolerates a missing argument and rejects a malformed one', () => {
  assert.deepEqual(parseLabelsArgument(undefined), []);
  assert.deepEqual(parseLabelsArgument('[]'), []);
  assert.deepEqual(parseLabelsArgument(JSON.stringify([{ id: 1, name: 'pipeline-change', color: 'ededed' }])),
    [{ id: 1, name: 'pipeline-change', color: 'ededed' }]);
  // A label-shaped object with a non-string name is dropped rather than trusted.
  assert.deepEqual(parseLabelsArgument(JSON.stringify([{ name: 42 }, { name: 'pipeline-change' }])), [{ name: 'pipeline-change' }]);
  assert.throws(() => parseLabelsArgument('{}'), /JSON array/);
});

test('a PR that moves 14 objects entirely out of src/objects/ still counts all 14 (git rename detection)', async t => {
  const root = await fixtureGitRepoWithFourteenObjects();
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'archive'), { recursive: true });
  for (const id of FOURTEEN_IDS) await rename(resolve(root, 'src/objects', id, 'file.txt'), resolve(root, 'archive', `${id}.txt`));
  await commitAll(root, 'move every object file out of src/objects');
  const result = await objectScopeGate('HEAD~1', [], { root });
  assert.equal(result.count, 14);
  assert.deepEqual(result.touched, FOURTEEN_IDS);
});

test('a PR that moves files from 14 objects into one still counts all 14 (git rename detection)', async t => {
  const root = await fixtureGitRepoWithFourteenObjects();
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'src/objects/a/incoming'), { recursive: true });
  for (const id of FOURTEEN_IDS) await rename(resolve(root, 'src/objects', id, 'file.txt'), resolve(root, 'src/objects/a/incoming', `${id}.txt`));
  await commitAll(root, 'consolidate every object file into a');
  const result = await objectScopeGate('HEAD~1', [], { root });
  assert.equal(result.count, 14);
  assert.deepEqual(result.touched, FOURTEEN_IDS);
});

test('a PR that deletes all 14 objects counts all 14 (baseline, no rename involved)', async t => {
  const root = await fixtureGitRepoWithFourteenObjects();
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const id of FOURTEEN_IDS) await rm(resolve(root, 'src/objects', id), { recursive: true, force: true });
  await commitAll(root, 'delete every object');
  const result = await objectScopeGate('HEAD~1', [], { root });
  assert.equal(result.count, 14);
  assert.deepEqual(result.touched, FOURTEEN_IDS);
});
