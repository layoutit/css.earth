import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

async function typecheckTests(root: string) {
  const manifest: unknown = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.ok(typeof manifest === 'object' && manifest !== null && 'scripts' in manifest);
  const scripts = manifest.scripts;
  assert.ok(typeof scripts === 'object' && scripts !== null && 'typecheck:tests' in scripts);
  const command = scripts['typecheck:tests'];
  assert.equal(command, 'tsc -p tests/tsconfig.json --pretty false');
  const compiler = fileURLToPath(import.meta.resolve('typescript/lib/tsc.js'));
  return spawnSync(process.execPath, [compiler, '-p', 'tests/tsconfig.json', '--pretty', 'false'], {
    cwd: root, encoding: 'utf8',
  });
}

async function fixture(t: TestContext) {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-test-type-roots-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'tests'));
  await writeFile(resolve(root, 'tests/tsconfig.json'), JSON.stringify({ compilerOptions: {
    strict: true, noEmit: true, types: [], target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
  }, include: ['**/*.test.mts'] }));
  return root;
}

test('the application test program discovers new matching roots and propagates their diagnostics', async t => {
  const root = await fixture(t);
  await writeFile(resolve(root, 'tests/existing.test.mts'), 'export const valid: number = 1;');
  assert.equal((await typecheckTests(root)).status, 0);
  await writeFile(resolve(root, 'tests/added.test.mts'), 'export const invalid: number = "newly discovered";');
  const failed = await typecheckTests(root);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /added.test.mts.*TS2322/u);
});

test('an empty application test program fails rather than returning a zero-file pass', async t => {
  const root = await fixture(t);
  const failed = await typecheckTests(root);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /TS18003.*No inputs were found/u);
});
