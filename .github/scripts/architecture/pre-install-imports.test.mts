import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { repositoryFiles } from './graph.mts';
import { checkPreInstallImports, preInstallFindings, preInstallScripts, sparseKeeps, withoutComments } from './pre-install-imports.mts';
import { REPOSITORY_RULES } from './repository-rules.mts';

const WORKFLOW = `
jobs:
  changes:
    steps:
      - uses: actions/checkout@v4
        with:
          sparse-checkout-cone-mode: false
          sparse-checkout: |
            /ci/**/*.mts
            /lib/validate.ts
      - run: |
          node ci/affected.mts pr "origin/main"
          echo "args=$(node ci/scope.mts origin/main)" >> "$GITHUB_OUTPUT"
      - run: node --test "ci/*.test.mts"
  build:
    steps:
      - uses: actions/checkout@v4
      - run: node ci/early.mts
      - run: pnpm install --frozen-lockfile
      - run: node ci/late.mts
`;

test('the scripts a job runs before its install are read from the workflow, with the job\'s sparse list', () => {
  const scripts = preInstallScripts('.github/workflows/x.yml', WORKFLOW, ['ci/affected.mts', 'ci/scope.mts', 'ci/a.test.mts', 'ci/b.test.mts', 'ci/early.mts', 'ci/late.mts']);
  assert.deepEqual(scripts.map(item => `${item.job} ${item.script} ${item.sparse === null ? 'full' : item.sparse.length}`), [
    'changes ci/affected.mts 2', 'changes ci/scope.mts 2', 'changes ci/a.test.mts 2', 'changes ci/b.test.mts 2', 'build ci/early.mts full',
  ], 'command substitutions and test globs count; nothing from the install step on does');
});

test('commands before the install in the same step are pre-install, and a comment that mentions installing is not an install', () => {
  const workflow = `
jobs:
  same-step:
    steps:
      - run: node ci/early.mts && pnpm install --frozen-lockfile && node ci/late.mts
  commented:
    steps:
      - run: |
          # Runs before pnpm install; npm ci would be too slow here.
          node ci/first.mts # not npm install either
      - run: |
          echo "pnpm install comes next"
          node ci/second.mts
      - run: pnpm i
      - run: node ci/late.mts
`;
  const scripts = preInstallScripts('w.yml', workflow, ['ci/early.mts', 'ci/first.mts', 'ci/second.mts', 'ci/late.mts']);
  assert.deepEqual(scripts.map(item => `${item.job} ${item.script}`), ['same-step ci/early.mts', 'commented ci/first.mts', 'commented ci/second.mts']);
  assert.equal(withoutComments(`echo "a # b" 'c # d' # e\n# f\nnode x.mts#g`), `echo "a # b" 'c # d' \n\nnode x.mts#g`);
});

test('a sparse list keeps a path by its last matching pattern, parent directories included', () => {
  const lines = ['/*', '!/src/objects/**/*.png', '/src/objects/keep/**'];
  assert.equal(sparseKeeps(lines, 'site/a.mts'), true);
  assert.equal(sparseKeeps(lines, 'src/objects/mars/a.png'), false);
  assert.equal(sparseKeeps(lines, 'src/objects/keep/b.png'), true);
  assert.equal(sparseKeeps(['/.github/scripts/**/*.mts'], '.github/scripts/ci/x.mts'), true);
  assert.equal(sparseKeeps(['/.github/scripts/**/*.mts'], 'packages/core/src/validate.ts'), false);
});

test('a pre-install closure may reach only node: built-ins and files the sparse checkout keeps', () => {
  const files: Record<string, string> = {
    'ci/affected.mts': "import { x } from './shared.mts'; import { readFile } from 'node:fs/promises';",
    'ci/shared.mts': "import { validate } from '../lib/validate.ts'; import fs from 'fs';",
    'lib/validate.ts': "import { isRecord } from '@cssearth/core'; import { y } from './helper.ts';",
    'lib/helper.ts': 'export const y = 1;',
    'ci/gone.mts': "import { z } from './missing.mts';",
  };
  const script = (name: string) => ({ workflow: 'w.yml', job: 'changes', script: name, sparse: ['/ci/**/*.mts', '/lib/validate.ts'] });
  const findings = preInstallFindings([script('ci/affected.mts'), script('ci/gone.mts'), script('ci/absent.mts'), script('lib/helper.ts')],
    new Set(Object.keys(files)), path => files[path]!);
  assert.deepEqual(findings, [
    'w.yml changes: ci/absent.mts is run before install but is not a tracked file',
    'w.yml changes: ci/affected.mts (via ci/shared.mts) imports fs; before install a script may import only node: built-ins and repository files',
    'w.yml changes: ci/affected.mts (via lib/validate.ts) imports @cssearth/core; before install a script may import only node: built-ins and repository files',
    "w.yml changes: ci/affected.mts (via lib/validate.ts) imports lib/helper.ts, which the job's sparse checkout leaves out",
    'w.yml changes: ci/gone.mts imports ./missing.mts, which is not a tracked file',
    "w.yml changes: lib/helper.ts is run before install but the job's sparse checkout leaves it out",
  ]);
});

test('the rule is registered and reads the workflows and scripts of a checkout', () => {
  const rule = REPOSITORY_RULES.find(item => item.id === 'pre-install-imports');
  assert.ok(rule, 'REPOSITORY_RULES lists pre-install-imports');
  const root = mkdtempSync(join(tmpdir(), 'pre-install-'));
  try {
    const write = (path: string, text: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
    write('.github/workflows/x.yml', WORKFLOW);
    write('ci/affected.mts', "import '@cssearth/core';");
    write('ci/scope.mts', "import { resolve } from 'node:path';");
    const files = ['.github/workflows/x.yml', 'ci/affected.mts', 'ci/scope.mts'];
    assert.deepEqual(rule.check(root, files), [
      '.github/workflows/x.yml build: ci/early.mts is run before install but is not a tracked file',
      '.github/workflows/x.yml changes: ci/affected.mts imports @cssearth/core; before install a script may import only node: built-ins and repository files',
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('this repository\'s pre-install scripts pass, and the rule finds every one of them', () => {
  const root = resolve(import.meta.dirname, '../../..'), files = repositoryFiles(root);
  const scripts = new Set(files.filter(path => /^\.github\/workflows\//u.test(path))
    .flatMap(path => preInstallScripts(path, readFileSync(resolve(root, path), 'utf8'), files)).map(item => item.script));
  for (const script of ['.github/scripts/ci/ci-affected.mts', '.github/scripts/ci/commit-message.mts', '.github/scripts/ci/scope-runtime-ownership-check.mts',
    '.github/scripts/ci/object-scope-gate.mts', '.github/scripts/audits/check-documentation-links.mts']) assert.ok(scripts.has(script), `${script} is found as a pre-install script`);
  assert.deepEqual(checkPreInstallImports(root, files), []);
});
