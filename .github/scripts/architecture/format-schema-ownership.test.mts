import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { repositoryFiles } from './graph.mts';
import { checkFormatSchemaOwnership, schemaLiterals, schemaOwner, schemaOwnershipFindings } from './format-schema-ownership.mts';

const schema = 'cssearth-probe@1', text = `export const schema = '${schema}';`;
const bake = 'packages/bake/src/probe.ts', site = 'site/probe.mts';
const exception = { schema, owners: ['packages/bake', 'site'], reason: 'Bake writes probe records; site reads them; objects contract pending.' };

/** Exercise disk scanning as well as the invariant, without staging any fixture files. */
function fixture(paths: readonly string[], run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'schema-owners-'));
  try {
    for (const path of paths) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    run(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('two owners spelling one id fail; one owner alone passes', () => {
  fixture([bake, site], root => assert.match(checkFormatSchemaOwnership(root, [bake, site])[0]!, /shared schema/u));
  fixture([bake, 'packages/bake/cli/probe.mts'], root => assert.deepEqual(checkFormatSchemaOwnership(root, [bake, 'packages/bake/cli/probe.mts']), []));
});

test('objects definition plus raw duplicate fails; objects definition alone passes', () => {
  const objects = 'packages/objects/src/probe.ts';
  fixture([objects, bake], root => assert.match(checkFormatSchemaOwnership(root, [objects, bake])[0]!, /duplicates objects definition/u));
  fixture([objects], root => assert.deepEqual(checkFormatSchemaOwnership(root, [objects]), []));
});

test('test, fixture, data, prepared and compiled files do not add owners', () => {
  for (const ignored of ['site/probe.test.mts', 'site/test/probe.ts', 'site/tests/probe.ts', 'site/fixtures/probe.ts',
    'site/data/probe.ts', 'site/prepared/probe.ts', 'site/dist/probe.ts', 'site/probe.json', 'site/probe.md'])
    fixture([bake, ignored], root => assert.deepEqual(checkFormatSchemaOwnership(root, [bake, ignored]), [], ignored));
});

test('exception honoured; stale, changed owner set, empty reason and duplicate fail', () => {
  const sources = new Map([[bake, text], [site, text]]);
  assert.deepEqual(schemaOwnershipFindings(sources, [exception]), []);
  assert.match(schemaOwnershipFindings(new Map([[bake, text]]), [exception])[0]!, /stale/u);
  for (const entry of [{ ...exception, reason: ' ' }, { ...exception, owners: ['packages/bake'] }])
    assert.ok(schemaOwnershipFindings(sources, [entry]).some(item => /invalid/u.test(item)));
  assert.ok(schemaOwnershipFindings(sources, [exception, exception]).some(item => /duplicate/u.test(item)));
  const owned = new Map([[bake, text], ['packages/objects/src/probe.ts', text]]);
  assert.deepEqual(schemaOwnershipFindings(owned, [{ ...exception, owners: ['packages/bake'] }]), []);
});

test('owner grouping keeps lab packages independent and tooling together', () => {
  for (const [path, owner] of [
    ['packages/bake/cli/x.mts', 'packages/bake'], ['site/build/x.mts', 'site'],
    ['labs/nebula/packages/lab/src/x.ts', 'labs/nebula/packages/lab'], ['labs/nebula/run.mts', 'labs/nebula'],
    ['.github/scripts/checks/x.mts', '.github/scripts'], ['scripts/build/x.mts', 'scripts'], ['astro.config.mts', '(repository root)'],
  ]) assert.equal(schemaOwner(path!), owner);
});

test('scanner includes type literals and template protocols but excludes TS comments', () => {
  assert.deepEqual(schemaLiterals(bake, `type Schema = '${schema}'; const python = \`{'schema':'${schema}'}\`;`), [schema]);
  assert.deepEqual(schemaLiterals(bake, `// '${schema}'\n/* '${schema}' */ export {};`), []);
  for (const path of ['packages/bake/src/probe.py', 'site/Probe.astro'])
    assert.deepEqual(schemaLiterals(path, `schema = '${schema}'`), [schema]);
});

test('real repository satisfies schema ownership', () => {
  const root = resolve(import.meta.dirname, '../../..');
  assert.deepEqual(checkFormatSchemaOwnership(root, repositoryFiles(root)), []);
});
