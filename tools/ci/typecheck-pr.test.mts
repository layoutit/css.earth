import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { requireRecord, requireString } from '../sources/source-values.mts';

const packageJson = requireRecord(JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')));
const scripts = requireRecord(packageJson.scripts);
const groups = Object.keys(scripts).filter(name => name.startsWith('typecheck:pr:'));
// These are the pre-parallel compiler programs and ownership gates, not a test-file inventory. Each
// remains an existing native package script with its own complete roots, configuration and assertions.
const required = ['typecheck:configs', 'typecheck:packages', 'typecheck:renderer', 'typecheck:platform',
  'typecheck:preparation', 'typecheck:tools', 'typecheck:astro', 'typecheck:ownership',
  'check:typescript-ownership', 'test:typescript-ownership'];

test('three native groups retain every existing compiler program and ownership gate exactly once', () => {
  assert.equal(groups.length, 3);
  const scheduled = groups.flatMap(name => requireString(scripts[name]).split('&&').map(command => {
    const match = /^\s*pnpm\s+([a-z][a-z:-]*)\s*$/u.exec(command);
    assert.ok(match, `Unexpected grouped command: ${command}`);
    const name = match[1]!;
    assert.ok(requireString(scripts[name]).trim(), `Missing package implementation: ${name}`);
    return name;
  }));
  assert.deepEqual(scheduled.sort(), [...required].sort());
  assert.equal(new Set(scheduled).size, scheduled.length);
});

async function fixture(t: TestContext) {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-native-compiler-groups-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(resolve(root, 'package.json'), JSON.stringify({ name: 'compiler-fixture', private: true, type: 'module',
    packageManager: requireString(packageJson.packageManager), scripts: {
    ...Object.fromEntries(['typecheck:pr', ...groups].map(name => [name, requireString(scripts[name])])),
    ...Object.fromEntries(required.map(name => [name, `node fixture-command.mts ${name}`])),
  } }));
  await writeFile(resolve(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  await mkdir(resolve(root, 'packages/member'), { recursive: true });
  await writeFile(resolve(root, 'packages/member/package.json'), JSON.stringify({ name: 'unrelated-fixture-member', private: true,
    scripts: { 'typecheck:pr:poison': "node -e \"console.error('wrong-workspace-sentinel'); process.exitCode=23;\"" } }));
  await writeFile(resolve(root, 'fixture-command.mts'), `import { appendFileSync, readFileSync } from 'node:fs';
const script = process.argv[2];
if (!script) throw new Error('Missing fixture script.');
const record = (event: string) => appendFileSync('events.ndjson', JSON.stringify({ script, event }) + '\\n');
record('start');
const deadline = Date.now() + 10_000;
while (readFileSync('events.ndjson', 'utf8').trim().split('\\n').length < 3) {
  if (Date.now() > deadline) throw new Error('All three parallel groups must start.');
  await new Promise<void>(accept => setTimeout(accept, 10));
}
await new Promise<void>(accept => setTimeout(accept, 25));
record('finish');
if (process.env.FAIL_SCRIPT === script) { console.error('native-compiler-failure:' + script); process.exitCode = 19; }
`);
  const run = (fail?: string) => new Promise<{ code: number; output: string }>((accept, reject) => {
    const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
    execFile('pnpm', ['run', 'typecheck:pr'], { cwd: root, env: { ...env, FAIL_SCRIPT: fail ?? '' }, maxBuffer: 1024 * 1024, timeout: 30_000 }, (error, stdout, stderr) => {
      if (!error) accept({ code: 0, output: stdout + stderr });
      else if (typeof error.code === 'number') accept({ code: error.code, output: stdout + stderr });
      else reject(error);
    });
  });
  const events = async () => (await readFile(resolve(root, 'events.ndjson'), 'utf8')).trim().split('\n').map(line => {
    const value = requireRecord(JSON.parse(line));
    return { script: requireString(value.script), event: requireString(value.event) };
  });
  return { run, events };
}

test('the actual pnpm parallel selector starts all three groups and runs every complete command once', async t => {
  const { run, events } = await fixture(t), result = await run();
  assert.equal(result.code, 0, result.output);
  assert.doesNotMatch(result.output, /wrong-workspace-sentinel/u);
  const observed = await events();
  assert.deepEqual(observed.filter(value => value.event === 'start').map(value => value.script).sort(), [...required].sort());
  assert.deepEqual(observed.filter(value => value.event === 'finish').map(value => value.script).sort(), [...required].sort());
  let active = 0, maximum = 0;
  for (const value of observed) {
    active += value.event === 'start' ? 1 : -1;
    maximum = Math.max(maximum, active);
    assert.ok(active >= 0 && active <= 3, `Unexpected active compiler count: ${active}`);
  }
  assert.equal(active, 0);
  assert.equal(maximum, 3, 'All three native groups must actually overlap, not just be declared parallel.');
});

test('a compiler failure propagates through native pnpm parallel execution', async t => {
  const { run, events } = await fixture(t), result = await run('typecheck:ownership');
  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /native-compiler-failure:typecheck:ownership/u);
  const started = (await events()).filter(value => value.event === 'start').map(value => value.script);
  for (const first of ['typecheck:configs', 'typecheck:preparation', 'typecheck:astro']) assert.ok(started.includes(first));
});
