import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const root = resolve(import.meta.dirname, '../..');
const run = (args: readonly string[]) => promisify(execFile)(process.execPath, args, { cwd: root })
  .then(({ stdout, stderr }) => ({ code: 0, output: stdout + stderr }),
    (error: { code?: number; stdout?: string; stderr?: string }) => ({ code: error.code ?? -1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` }));
const entries = (await readdir(resolve(root, 'tools/prepare/cli'))).filter(name => name.endsWith('.mts')).sort();

test('every entry script in tools/prepare/cli calls a library of the same name', async () => {
  assert.ok(entries.length > 0);
  for (const name of entries) {
    const source = await readFile(resolve(root, 'tools/prepare/cli', name), 'utf8');
    assert.match(source, new RegExp(`from '\\.\\./${name.replace('.', '\\.')}'`), name);
  }
});

test('a tools/prepare library run by its old path fails and names its entry script; importing it prints nothing', async () => {
  for (const name of entries) {
    const direct = await run([`tools/prepare/${name}`]);
    assert.notEqual(direct.code, 0, name);
    assert.match(direct.output, new RegExp(`node tools/prepare/cli/${name.replace('.', '\\.')}`), name);
    const imported = await run(['--input-type=module', '-e', `await import('./tools/prepare/${name}')`]);
    assert.deepEqual(imported, { code: 0, output: '' }, name);
  }
});
