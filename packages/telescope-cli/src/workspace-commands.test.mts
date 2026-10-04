/** The process boundary between the telescope and the workspace entries it runs: the answer crosses IPC, logs go to stderr. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WORKSPACE } from '@cssearth/telescope/node';
import { NEW_OBJECT_COMMAND } from './workspace-commands/new-object.mts';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();

const ROOT = WORKSPACE;
const DISPATCHER = resolve(import.meta.dirname, 'workspace-commands.mts');

/** A throwaway entry and a dispatcher that runs it through `runWorkspaceCommand`, under the checkout so both resolve its packages. */
async function workspace(entry: string, script?: string) {
  await mkdir(resolve(ROOT, 'output'), { recursive: true });
  const directory = await mkdtemp(resolve(ROOT, 'output/workspace-commands-'));
  await writeFile(resolve(directory, 'entry.mts'), entry);
  await writeFile(resolve(directory, 'dispatch.mts'), `import { runWorkspaceCommand } from ${JSON.stringify(DISPATCHER)};
const command = { script: ${JSON.stringify(script ?? resolve(directory, 'entry.mts'))}, source: 'entry.mts' };
try { const result = await runWorkspaceCommand(${JSON.stringify(ROOT)}, command, process.argv.slice(2)); process.stdout.write(JSON.stringify({ result })); }
catch (error) { process.stdout.write(JSON.stringify({ error: { class: error.constructor.name, message: error.message, cause: error.cause?.message } })); }
`);
  const run = (args: readonly string[] = []) => new Promise<{ stdout: string; stderr: string; code: number | null; signal: NodeJS.Signals | null }>((accept, reject) => {
    const child = spawn(process.execPath, [resolve(directory, 'dispatch.mts'), ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; }); child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.once('error', reject); child.once('close', (code, signal) => accept({ stdout, stderr, code, signal }));
  });
  return { directory, run, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

test('the result crosses IPC alone: what the entry and its own subprocesses print is stderr', async () => {
  const fixture = await workspace(`import { spawnSync } from 'node:child_process';
import { answerParent } from '@cssearth/core/node';
await answerParent(async () => {
  spawnSync('sh', ['-c', 'echo BAKE LOG'], { stdio: 'inherit' });
  console.log('JS LOG');
  return { text: '{"baked":["fixture"]}\\n', code: 0 };
});
`);
  try {
    const { stdout, stderr, code } = await fixture.run();
    assert.equal(code, 0, stderr);
    assert.deepEqual(JSON.parse(stdout), { result: { text: '{"baked":["fixture"]}\n', code: 0 } });
    assert.match(stderr, /BAKE LOG/u); assert.match(stderr, /JS LOG/u);
  } finally { await fixture.cleanup(); }
});

test('a failing entry is raised again with its class, message and cause, as when it ran in process, and prints no stack', async () => {
  const fixture = await workspace(`import { answerParent } from '@cssearth/core/node';
await answerParent(async () => { throw new TypeError('invalid descriptor', { cause: new Error('bad axis') }); });
`);
  try {
    const { stdout, stderr, code } = await fixture.run();
    assert.equal(code, 0, stderr);
    assert.deepEqual(JSON.parse(stdout), { error: { class: 'TypeError', message: 'invalid descriptor', cause: 'bad axis' } });
    assert.doesNotMatch(stderr, /invalid descriptor/u, 'the dispatcher, not the entry, decides whether a failure is printed');
  } finally { await fixture.cleanup(); }
});

test('the F16 volume bake refuses an invalid descriptor with the class and message of the in-process call', async () => {
  const fixture = await workspace('', resolve(ROOT, 'packages/bake/cli/prepare-volume.mts'));
  try {
    const object = resolve(fixture.directory, 'object');
    await mkdir(object);
    await writeFile(resolve(object, 'object.json'), JSON.stringify({ schema: 'cssearth-object@2', id: 'x', type: 'density-volume', properties: { volume: {}, preparation: { source: 'source/volume.json' } } }));
    const [{ prepareDensityVolumeObject }, { inventoryPreparedAssets }] = await Promise.all([import('@cssearth/bake/density'), import('@cssearth/objects/node')]);
    const direct = await prepareDensityVolumeObject({ objectDirectory: object, inventory: inventoryPreparedAssets }).then(() => undefined, (error: unknown) => error);
    assert.ok(direct instanceof TypeError);
    const { stdout, stderr } = await fixture.run([object]);
    assert.deepEqual(JSON.parse(stdout), { error: { class: 'TypeError', message: direct.message } });
    assert.doesNotMatch(stderr, /parseDensityVolumeFrame/u, 'no unsolicited stack');
  } finally { await fixture.cleanup(); }
});

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function readPid(path: string) {
  for (let attempt = 0; attempt < 200; attempt++) { const pid = Number(await readFile(path, 'utf8').catch(() => '0')); if (pid) return pid; await new Promise(accept => setTimeout(accept, 50)); }
  throw new Error(`${path} was never written`);
}
async function gone(pid: number) {
  for (let attempt = 0; attempt < 100 && alive(pid); attempt++) await new Promise(accept => setTimeout(accept, 50));
  return !alive(pid);
}

test('terminating the telescope stops the workspace command it is running', async () => {
  const fixture = await workspace(`import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[2], String(process.pid));
setInterval(() => {}, 1000);
`);
  const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const pidFile = resolve(fixture.directory, 'child.pid');
  try {
    const child = spawn(process.execPath, [resolve(fixture.directory, 'dispatch.mts'), pidFile], { cwd: ROOT, stdio: 'ignore' });
    const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(accept => child.once('close', (code, signal) => accept({ code, signal })));
    let pid = 0;
    for (let attempt = 0; attempt < 200 && !pid; attempt++) { pid = Number(await readFile(pidFile, 'utf8').catch(() => '0')); if (!pid) await new Promise(accept => setTimeout(accept, 50)); }
    assert.ok(pid && alive(pid), 'the workspace command started');
    child.kill('SIGTERM');
    assert.deepEqual(await closed, { code: null, signal: 'SIGTERM' }, 'the telescope ends by the signal it received');
    for (let attempt = 0; attempt < 100 && alive(pid); attempt++) await new Promise(accept => setTimeout(accept, 50));
    assert.equal(alive(pid), false, 'the workspace command stopped with it');
  } finally { await fixture.cleanup(); }
});

test('terminating the telescope also stops the processes the workspace command started', async () => {
  const fixture = await workspace(`import { spawn } from 'node:child_process';
spawn(process.execPath, ['-e', 'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000);', process.argv[2]], { stdio: 'ignore' });
setInterval(() => {}, 1000);
`);
  const pidFile = resolve(fixture.directory, 'grandchild.pid');
  try {
    const child = spawn(process.execPath, [resolve(fixture.directory, 'dispatch.mts'), pidFile], { cwd: ROOT, stdio: 'ignore' });
    const closed = new Promise(accept => child.once('close', accept));
    const pid = await readPid(pidFile);
    child.kill('SIGTERM'); await closed;
    const stopped = await gone(pid);
    if (!stopped) process.kill(pid, 'SIGKILL');
    assert.ok(stopped, 'the grandchild stopped with the telescope');
  } finally { await fixture.cleanup(); }
});

test('terminating `telescope new-object` stops the moved entry and the processes it started', async () => {
  const fixture = await workspace('');
  const CLI = resolve(import.meta.dirname, 'cli.mts');
  // A stand-in root: the command resolves its entry under the root it is given, so this one hangs with a child of its own.
  const entry = resolve(fixture.directory, 'root', NEW_OBJECT_COMMAND.script);
  await mkdir(resolve(entry, '..'), { recursive: true });
  await writeFile(entry, `import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
writeFileSync(process.env.ENTRY_PIDS + '.entry', String(process.pid));
spawn(process.execPath, ['-e', 'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000);', process.env.ENTRY_PIDS + '.child'], { stdio: 'ignore' });
setInterval(() => {}, 1000);
`);
  await writeFile(resolve(fixture.directory, 'main.mts'), `import { main } from ${JSON.stringify(CLI)};
await main(['new-object', 'spec.json'], ${JSON.stringify(resolve(fixture.directory, 'root'))}, () => {});
`);
  const pids = resolve(fixture.directory, 'pids');
  try {
    const telescope = spawn(process.execPath, [resolve(fixture.directory, 'main.mts')], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, ENTRY_PIDS: pids } });
    const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(accept => telescope.once('close', (code, signal) => accept({ code, signal })));
    const [entryPid, childPid] = [await readPid(`${pids}.entry`), await readPid(`${pids}.child`)];
    telescope.kill('SIGTERM');
    const ended = await closed;
    const stopped = [await gone(entryPid), await gone(childPid)];
    for (const pid of [entryPid, childPid]) if (alive(pid)) process.kill(pid, 'SIGKILL');
    assert.equal(ended.signal, 'SIGTERM');
    assert.deepEqual(stopped, [true, true], 'the new-object entry and its own process stopped with the telescope');
  } finally { await fixture.cleanup(); }
});

test('a workspace command ends, with the processes it started, when the telescope is killed outright', async () => {
  const fixture = await workspace(`import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { answerParent } from '@cssearth/core/node';
writeFileSync(process.argv[2], String(process.pid));
spawn(process.execPath, ['-e', 'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000);', process.argv[3]], { stdio: 'ignore' });
await answerParent(() => new Promise(() => {}));
`);
  const childFile = resolve(fixture.directory, 'child.pid'), grandchildFile = resolve(fixture.directory, 'grandchild.pid');
  try {
    const dispatcher = spawn(process.execPath, [resolve(fixture.directory, 'dispatch.mts'), childFile, grandchildFile], { cwd: ROOT, stdio: 'ignore' });
    const closed = new Promise(accept => dispatcher.once('close', accept));
    const child = await readPid(childFile), grandchild = await readPid(grandchildFile);
    dispatcher.kill('SIGKILL'); await closed;
    const stopped = [await gone(child), await gone(grandchild)];
    for (const pid of [child, grandchild]) if (alive(pid)) process.kill(pid, 'SIGKILL');
    assert.deepEqual(stopped, [true, true], 'the command and its own process stopped when the telescope died');
  } finally { await fixture.cleanup(); }
});

test('an answer counts only if the command then exits as it answered: a later failure is reported, not the answer', async () => {
  const fixture = await workspace(`import { answerParent } from '@cssearth/core/node';
await answerParent(async () => ({ text: 'done\\n', code: 0 }));
setTimeout(() => { throw new Error('late failure'); }, 10);
`);
  try {
    const { stdout } = await fixture.run();
    const { error } = JSON.parse(stdout) as { error?: { class: string; message: string } };
    assert.equal(error?.class, 'Error');
    assert.match(error?.message ?? '', /answered, then exited with 1/u);
  } finally { await fixture.cleanup(); }
});

for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
  test(`${signal} on the telescope cleans up detached prepareObjects step groups`, { timeout: 20_000 }, async () => {
    const fixture = await workspace(`import { answerParent } from '@cssearth/core/node';
import { prepareObjects } from '@cssearth/bake/prepare-object';
await answerParent(async () => ({ text: '', code: await prepareObjects(['fixture'], { root: process.argv[2], from: 'builds', to: 'builds', progress: () => {} }) ? 0 : 1 }));
`);
    const root = resolve(fixture.directory, 'checkout'), script = resolve(root, 'packages/bake/cli/check-stale-builds.mts');
    await mkdir(resolve(root, 'src/objects/fixture'), { recursive: true });
    await writeFile(resolve(root, 'src/objects/fixture/object.json'), '{}');
    await mkdir(resolve(root, 'packages/bake/cli'), { recursive: true });
    await writeFile(script, `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
writeFileSync('command.pid', String(process.pid));
spawn(process.execPath, ['-e', 'require("node:fs").writeFileSync("child.pid", String(process.pid)); setInterval(() => {}, 1000);'], { stdio: 'ignore' });
setInterval(() => {}, 1000);`);
    let command = 0, child = 0;
    const dispatcher = spawn(process.execPath, [resolve(fixture.directory, 'dispatch.mts'), root], { cwd: ROOT, stdio: 'ignore' });
    const closed = new Promise(accept => dispatcher.once('close', accept));
    try {
      command = await readPid(resolve(root, 'command.pid')); child = await readPid(resolve(root, 'child.pid'));
      dispatcher.kill(signal); await closed;
      assert.deepEqual([await gone(command), await gone(child)], [true, true], 'both detached descendants stopped');
    } finally {
      dispatcher.kill('SIGKILL');
      for (const pid of [command, child]) if (pid && alive(pid)) process.kill(pid, 'SIGKILL');
      await fixture.cleanup();
    }
  });
}
