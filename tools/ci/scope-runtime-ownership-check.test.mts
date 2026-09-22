import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { scopeRuntimeOwnershipCheck, selectRuntimeOwnershipArgs } from './scope-runtime-ownership-check.mts';

test('an object-only diff scopes to the touched objects, sorted and deduplicated', () => {
  const args = selectRuntimeOwnershipArgs([
    'src/objects/mars/object.json',
    'src/objects/earth/prepared/runtime.json',
    'src/objects/mars/README.md',
  ]);
  assert.deepEqual(args, ['--object', 'earth', '--object', 'mars']);
});

test('a diff that also touches shared code runs --all, even with object paths present', () => {
  // Mutation check: a single non-object path must flip the whole decision, not just get ignored alongside it.
  const args = selectRuntimeOwnershipArgs(['src/objects/mars/object.json', 'tools/ci/check-object-runtime-ownership.mts']);
  assert.deepEqual(args, ['--all']);
});

test('an empty diff runs --all rather than scoping to nothing', () => {
  assert.deepEqual(selectRuntimeOwnershipArgs([]), ['--all']);
});

test('a diff entirely outside src/objects/ runs --all', () => {
  assert.deepEqual(selectRuntimeOwnershipArgs(['site/objects.mts', 'README.md']), ['--all']);
});

test('scopeRuntimeOwnershipCheck computes paths from the injected function and forwards the ref', async () => {
  const seen: string[] = [];
  const args = await scopeRuntimeOwnershipCheck('origin/main', {
    changedPaths: async ref => { seen.push(ref); return ['src/objects/venus/object.json']; },
  });
  assert.deepEqual(seen, ['origin/main']);
  assert.deepEqual(args, ['--object', 'venus']);
});
