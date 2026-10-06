import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reuseLocalPreparation, sharedCodeChanged } from './check-ci.mts';

test('--typecheck treats the CI scripts in .github/scripts as shared code', () => {
  for (const path of ['.github/scripts/ci/ci-affected.mts', '.github/scripts/ci/commit-message.test.mts', '.github/scripts/ci/build-ci.mts',
    'site/directory/objects.mts', 'src/platform/x.mts', 'src/renderers/css/x.ts', 'packages/core/src/validate.ts', 'tsconfig.base.json', '.github/scripts/tsconfig.json', 'labs/tsconfig.json'])
    assert.equal(sharedCodeChanged([path]), true, path);
  for (const path of ['.github/workflows/universe.yml', '.github/ci-areas.json', 'docs/ci-cd.md', 'src/objects/mars/object.json', 'CONTRIBUTING.md', 'tsconfig.json'])
    assert.equal(sharedCodeChanged([path]), false, path);
});

test('local lanes reuse the renamed preparation build without skipping distinct environments', () => {
  const build = { name: 'Build preparation', run: 'pnpm build:preparation', env: {} };
  const alternate = { ...build, env: { CI_PREPARATION_LANE: 'source' } };
  const check = { name: 'Check preparation', run: 'pnpm check:architecture', env: {} };
  assert.deepEqual(reuseLocalPreparation([build, { ...build }, alternate, check, { ...check }]),
    [build, alternate, check, check]);
});
