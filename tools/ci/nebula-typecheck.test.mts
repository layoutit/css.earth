import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { globSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../..');
function readConfig(path: string) {
  const source = ts.readConfigFile(path, ts.sys.readFile);
  if (source.error) throw new Error(ts.flattenDiagnosticMessageText(source.error.messageText, '\n'));
  const config = ts.parseJsonConfigFileContent(source.config, ts.sys, dirname(path), undefined, path);
  if (config.errors.length) throw new Error(config.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
  return config;
}

test('each native nebula program has a distinct incremental state without changing strict checking', () => {
  const files = globSync(['labs/nebula/tsconfig{,.tests}.json', 'labs/nebula/packages/*/tsconfig.json'], { cwd: root });
  assert.ok(files.length > 0);
  const states = files.map(file => {
    const config = readConfig(resolve(root, file));
    assert.equal(config.options.strict, true, file);
    assert.equal(config.options.noEmit, true, file);
    assert.equal(config.options.incremental, true, file);
    assert.ok(config.fileNames.length > 0, file);
    const state = config.options.tsBuildInfoFile;
    assert.ok(state?.startsWith(resolve(root, 'output/tsbuildinfo/nebula-')), file);
    return state;
  });
  assert.equal(new Set(states).size, states.length, 'Separate compiler programs cannot overwrite each other\'s state.');
});

test('native complete nebula config discovers a new failing test and invalidates warm compiler state', async t => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'cssearth-native-nebula-types-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const configDirectory = resolve(fixture, 'labs/nebula');
  const testsDirectory = resolve(configDirectory, 'packages/future/src');
  await mkdir(testsDirectory, { recursive: true });
  // Keep the actual include/exclude/options. Only the fixture's source files and dependency symlink differ.
  for (const name of ['tsconfig.base.json', 'tsconfig.tests.json'])
    await copyFile(resolve(root, 'labs/nebula', name), resolve(configDirectory, name));
  await symlink(resolve(root, 'node_modules'), resolve(fixture, 'node_modules'), 'dir');
  const configPath = resolve(configDirectory, 'tsconfig.tests.json');
  const existing = resolve(testsDirectory, 'existing.test.ts');
  await writeFile(existing, 'export const originalContract: number = 1;');
  const compiler = fileURLToPath(import.meta.resolve('typescript/lib/tsc.js'));
  const run = () => new Promise<{ code: number; output: string }>((accept, reject) => {
    execFile(process.execPath, [compiler, '-p', configPath, '--pretty', 'false', '--extendedDiagnostics'], {
      cwd: fixture, maxBuffer: 1024 * 1024, timeout: 30_000,
    }, (error, stdout, stderr) => {
      if (!error) accept({ code: 0, output: stdout + stderr });
      else if (typeof error.code === 'number') accept({ code: error.code, output: stdout + stderr });
      else reject(error);
    });
  });
  const cold = await run();
  assert.equal(cold.code, 0, cold.output);
  assert.match(cold.output, /Files:\s+[1-9]\d*/u);
  const initial = readConfig(configPath);
  assert.ok(initial.fileNames.includes(existing));
  assert.ok(initial.options.tsBuildInfoFile);
  assert.ok((await stat(initial.options.tsBuildInfoFile)).size > 0, 'Native tsc actually wrote reusable state.');

  const added = resolve(testsDirectory, 'added.test.mts');
  await writeFile(added, 'export const addedContract: number = "native-test-type-canary";');
  const next = readConfig(configPath);
  for (const file of initial.fileNames) assert.ok(next.fileNames.includes(file), 'New discovery cannot replace previous roots.');
  assert.ok(next.fileNames.includes(added));
  const failed = await run();
  assert.notEqual(failed.code, 0, failed.output);
  assert.match(failed.output, /added\.test\.mts\(1,14\): error TS2322/u);

  await writeFile(added, 'export const addedContract: number = 2;');
  const repaired = await run();
  assert.equal(repaired.code, 0, repaired.output);
  assert.match(repaired.output, /Files:\s+[1-9]\d*/u);
  assert.ok((await readFile(initial.options.tsBuildInfoFile, 'utf8')).length > 0);
});
