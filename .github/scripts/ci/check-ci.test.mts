import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sharedCodeChanged } from './check-ci.mts';

test('--typecheck treats the CI scripts in .github/scripts as shared code', () => {
  for (const path of ['.github/scripts/ci/ci-affected.mts', '.github/scripts/ci/commit-message.test.mts', 'tools/ci/build-ci.mts',
    'site/objects.mts', 'src/platform/x.mts', 'src/renderers/css/x.ts', 'packages/core/src/validate.ts'])
    assert.equal(sharedCodeChanged([path]), true, path);
  for (const path of ['.github/workflows/universe.yml', '.github/ci-areas.json', 'docs/ci-cd.md', 'src/objects/mars/object.json', 'CONTRIBUTING.md'])
    assert.equal(sharedCodeChanged([path]), false, path);
});
