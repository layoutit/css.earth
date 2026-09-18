import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_OBJECT_DIRECTORY_LIMIT, PIPELINE_CHANGE_LABEL, evaluateObjectScopeGate,
  objectScopeGate, parseLabelsArgument, touchedObjectDirectories } from './object-scope-gate.mts';

function pathsFor(ids: readonly string[]): string[] {
  return ids.map(id => `src/objects/${id}/prepared/runtime.json`);
}

test('touchedObjectDirectories extracts the distinct object ids from src/objects/<id>/ paths', () => {
  const ids = touchedObjectDirectories([
    'src/objects/hebe/prepared-assets.json',
    'src/objects/hebe/prepared/runtime.json',
    'src/objects/iris/runtime-assets.json',
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
