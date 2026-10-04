import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkStaleReferences, staleReferenceLines } from './check-stale-references.mts';

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
