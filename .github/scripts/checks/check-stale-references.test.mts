import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { globSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkStaleReferences, staleReferenceLines, workflowCommandPaths, workflowPathTracked } from './check-stale-references.mts';

const bytes = (value: string) => new TextEncoder().encode(value);
test('every live reference class rejects a retired path, including output generator literals and bundle specifiers', () => {
  const cases = [
    ['module.mts', 'const path = "packages/telescope-cli/src/archives/jwst/imaging/programs/new.json";'],
    ['module.mts', 'const path = "packages/telescope-cli/src/archives/jwst/klip/programs/new.json";'],
    ['package.json', '{"scripts":{"prepare":"node tools/prepare.mts"}}'],
    ['source/manifest.json', '{"generator":"tools/prepare.mts"}'],
    ['README.md', 'Run `node tools/prepare.mts`.'],
    ['.github/workflows/universe.yml', 'run: node tools/prepare.mts'],
    ['.github/ci-areas.json', '{"paths":["integration/renderer-bake/**"]}'],
    ['sparse-checkout', '/integration/renderer-bake/**'],
    ['vitest.config.ts', 'include: ["packages/objects/src/baking/**/*.test.ts"]'],
    ['packages/x/src/moved.mts', 'const ORIGIN = "tools/old-generator.mts";'],
    ['packages/x/src/moved.mts', 'import { x } from "../../packages/objects/src/geometry/index.js";'],
    ['packages/x/src/moved.test.mts', 'import { x } from "../../../tools/old.js";'],
  ];
  for (const [path, text] of cases) assert.equal(staleReferenceLines(path!, bytes(text!)).length, 1, `${path}: ${text}`);
});
test('dated records identify replacement; URLs and fixture literals are not live local references', () => {
  for (const [path, text] of [
    ['report.md', '2026-10-04: `tools/old.mts` (now packages/bake/cli/new.mts)'],
    ['source/manifest.json', '{"url":"https://example.org/tools/catalogue"}'],
    ['test.test.mts', 'const negativeFixture = "tools/old.mts";'],
    ['module.mts', 'const root = resolve(import.meta.dirname, "../../..");'],
  ]) assert.deepEqual(staleReferenceLines(path!, bytes(text!)), []);
  assert.equal(staleReferenceLines('README.md', bytes('Use tools/old.mts.')).length, 1);
});
test('relocated checkout root owners reject cwd regression while caller-selected working directories remain legitimate', () => {
  assert.equal(staleReferenceLines('.github/scripts/ci/build-ci.mts', bytes('const root = process.cwd();')).length, 1);
  assert.deepEqual(staleReferenceLines('packages/x/cli/run.mts', bytes('const inputRoot = process.cwd();')), []);
});
test('repository mutation: an untracked stale manifest is red and removing it is green', () => {
  const root = mkdtempSync(join(tmpdir(), 'stale-references-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    writeFileSync(join(root, 'package.json'), '{"scripts":{"prepare":"node packages/bake/cli/prepare.mts"}}');
    assert.deepEqual(checkStaleReferences(root), []);
    writeFileSync(join(root, 'manifest.json'), '{"generator":"tools/retired.mts"}');
    assert.equal(checkStaleReferences(root).length, 1);
    rmSync(join(root, 'manifest.json'));
    assert.deepEqual(checkStaleReferences(root), []);
  } finally { rmSync(root, {recursive: true, force: true}); }
});
test('every-PR contract lane executes the guard and its mutation tests', () => {
  const workflow = readFileSync(new URL('../../workflows/universe.yml', import.meta.url), 'utf8');
  const lint = workflow.split('\n  lint:')[1]?.split('\n  typecheck:')[0];
  assert.ok(lint);
  assert.match(lint, /run: node --test \.github\/scripts\/checks\/check-stale-references\.test\.mts/u);
  assert.match(lint, /run: node \.github\/scripts\/checks\/check-stale-references\.mts/u);
});

test('test syntax distinguishes multiline live imports from quoted negative fixtures', () => {
  assert.deepEqual(staleReferenceLines('guard.test.mts', bytes(`const fixture = 'import "../../../tools/old.js";';`)), []);
  for (const text of [
    `import {
  x
} from '../../../tools/old.js';`,
    `await import(
  '../../../tools/old.js'
);`,
    `execFileSync('node', [
  'tools/old.mts'
]);`,
  ]) assert.equal(staleReferenceLines('guard.test.mts', bytes(text)).length, 1, text);
});

test('JWST acquisition history remains allowed while generator paths fail', () => {
  const path = 'src/objects/body/source/manifest.json';
  assert.equal(staleReferenceLines(path, bytes('  "acquisition": "pinned in packages/telescope-cli/src/archives/jwst/imaging/programs/old.json."')).length, 1);
  const recorded = 'src/objects/beta-pictoris-disc/source/manifest.json';
  const line = readFileSync(recorded, 'utf8').split('\n').find(line => line.includes('/jwst/imaging/programs/'))!;
  assert.deepEqual(staleReferenceLines(recorded, bytes(line)), []);
  assert.equal(staleReferenceLines(recorded, bytes(line.replace('mast:JWST/product/', 'mast:JWST/new-product/'))).length, 1);
  assert.equal(staleReferenceLines(path, bytes('  "generator": "packages/telescope-cli/src/archives/jwst/imaging/programs/new.json"')).length, 1);
});

test('live GitHub JWST links fail but commit-pinned evidence remains historical', () => {
  const old = 'packages/telescope-cli/src/archives/jwst/imaging/programs/body.json';
  assert.equal(staleReferenceLines('src/objects/body/investigations.json', bytes(`"https://github.com/org/repo/blob/main/${old}"`)).length, 1);
  assert.deepEqual(staleReferenceLines('src/objects/body/investigations.json', bytes(`"https://github.com/org/repo/blob/abcdef1/${old}"`)), []);
  assert.equal(staleReferenceLines('src/objects/body/investigations.json', bytes(`  "finding": "The reduction used ${old}."`)).length, 1);
});

test('every relocated CI root owner rejects a caller cwd while its module-relative root passes', () => {
  for (const path of [
    '.github/scripts/ci/build-ci.mts',
    '.github/scripts/ci/ci-cache-key.mts',
    '.github/scripts/ci/check-ci.mts',
  ]) {
    assert.equal(staleReferenceLines(path, bytes('const root = process.cwd();')).length, 1, path);
    assert.deepEqual(staleReferenceLines(path, bytes('const root = resolve(import.meta.dirname, "../../..");')), [], path);
  }
});


test('workflow command paths cover inline and block node/pnpm commands, including globs and excluding dynamic inputs', () => {
  assert.deepEqual(workflowCommandPaths(`jobs:
  check:
    steps:
      - run: node --test packages/a/value.test.ts absent.mts
      - run: |
          pnpm test packages/b/value.test.mts
          node --test "packages/c/*.test.ts" $INPUT
`), ['packages/a/value.test.ts', 'absent.mts', 'packages/b/value.test.mts', 'packages/c/*.test.ts']);
});
test('mutation: a tracked workflow stale test path is red and a tracked replacement is green', () => {
  const root = mkdtempSync(join(tmpdir(), 'workflow-paths-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    mkdirSync(join(root, '.github/workflows'), { recursive: true });
    mkdirSync(join(root, 'packages/a'), { recursive: true });
    const workflow = join(root, '.github/workflows/check.yml');
    writeFileSync(workflow, 'jobs:\n  check:\n    steps:\n      - run: node --test packages/a/removed.test.ts\n');
    execFileSync('git', ['add', '.'], { cwd: root });
    assert.match(checkStaleReferences(root).join('\n'), /not tracked: packages\/a\/removed/u);
    writeFileSync(join(root, 'packages/a/present.test.ts'), '');
    writeFileSync(workflow, 'jobs:\n  check:\n    steps:\n      - run: node --test packages/a/present.test.ts\n');
    execFileSync('git', ['add', '.'], { cwd: root });
    assert.deepEqual(checkStaleReferences(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function missingTestProjects(root: string): string[] {
  const value: unknown = JSON.parse(readFileSync(resolve(root, 'tsconfig.tests.json'), 'utf8'));
  if (!value || typeof value !== 'object' || !('references' in value) || !Array.isArray(value.references)) throw new TypeError('Invalid test references');
  const references = new Set(value.references.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || !('path' in entry) || typeof entry.path !== 'string') throw new TypeError('Invalid project reference');
    return entry.path.replace(/^\.\//u, '');
  }));
  return [...new Set(globSync('packages/**/*.test.{ts,mts}', { cwd: root }).map(file => file.split('/')[1]!))]
    .filter(name => !references.has(`packages/${name}/tsconfig.tests.json`)).sort();
}
test('every workspace package with tests participates in test typechecking', () => {
  assert.deepEqual(missingTestProjects(resolve(import.meta.dirname, '../../..')), []);
});
test('mutation: adding an unreferenced package with tests is red, adding its reference is green', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'test-projects-'));
  try {
    mkdirSync(resolve(root, 'packages/new/src'), { recursive: true });
    writeFileSync(resolve(root, 'packages/new/package.json'), '{"name":"@cssearth/new"}');
    writeFileSync(resolve(root, 'packages/new/src/value.test.ts'), '');
    writeFileSync(resolve(root, 'tsconfig.tests.json'), '{"references":[]}');
    assert.deepEqual(missingTestProjects(root), ['new']);
    writeFileSync(resolve(root, 'tsconfig.tests.json'), '{"references":[{"path":"./packages/new/tsconfig.tests.json"}]}');
    assert.deepEqual(missingTestProjects(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('continued workflow node commands retain every literal test path', () => {
  const workflow = String.raw`jobs:
  check:
    steps:
      - run: |
          node --test \
            fixtures/continued.test.mts \
            packages/a/present.test.ts
`;
  assert.deepEqual(workflowCommandPaths(workflow), ['fixtures/continued.test.mts', 'packages/a/present.test.ts']);
});

test('workflow test globs must match tracked files; directory arguments are ignored', () => {
  const tracked = new Set(['packages/bake/src/sources/current.test.mts']);
  assert.equal(workflowPathTracked('packages/bake/src/sources/*.test.*', tracked), true);
  assert.equal(workflowPathTracked('packages/bake', tracked), true, 'tracked directory arguments are valid');
  assert.equal(workflowPathTracked('packages/bake/missing-command', tracked), false, 'extensionless missing commands stay guarded');
  assert.equal(workflowPathTracked('packages/bake/src/missing/*.test.*', tracked), false, 'mutation red');
  assert.equal(workflowPathTracked('packages/bake/src/sources/*.test.*', tracked), true, 'mutation green');
  assert.deepEqual(workflowCommandPaths('jobs:\n  check:\n    steps:\n      - run: cd packages/bake && pnpm test --dir packages/bake.v2 packages/bake/src/sources/*.test.*\n'), ['packages/bake/src/sources/*.test.*']);
});
