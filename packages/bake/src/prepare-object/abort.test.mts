import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { prepareObjects } from './index.ts';

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
for (const [step, script] of [['builds', 'packages/bake/cli/check-stale-builds.mts'], ['sources', 'site/build/prepare/author-source-records.mts']] as const) {
  test(`aborting ${step} kills the command and its long-running child`, { timeout: 10_000 }, async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'prepare-abort-')), controller = new AbortController();
    const put = async (path: string, text: string) => { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), text); };
    let commandPid = 0, childPid = 0;
    try {
      await put('src/objects/fixture/object.json', '{}');
      await put(script, `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
writeFileSync('command.pid', String(process.pid));
spawn(process.execPath, ['-e', 'require("node:fs").writeFileSync("child.pid", String(process.pid)); process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);'], { stdio: 'ignore' });
setInterval(() => {}, 1000);`);
      const running = prepareObjects(['fixture'], { root, from: step, to: step, signal: controller.signal, progress: () => {} });
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        try { commandPid = Number(await readFile(resolve(root, 'command.pid'), 'utf8')); childPid = Number(await readFile(resolve(root, 'child.pid'), 'utf8')); break; }
        catch { await new Promise(done => setTimeout(done, 20)); }
      }
      assert.ok(commandPid && childPid, 'both processes started');
      controller.abort();
      assert.equal(await running, false);
      const stoppedBy = Date.now() + 2000;
      while ((alive(commandPid) || alive(childPid)) && Date.now() < stoppedBy) await new Promise(done => setTimeout(done, 20));
      assert.equal(alive(commandPid), false, 'command stopped');
      assert.equal(alive(childPid), false, 'descendant stopped');
    } finally {
      controller.abort();
      for (const pid of [commandPid, childPid]) if (pid && alive(pid)) process.kill(pid, 'SIGKILL');
      await rm(root, { recursive: true, force: true });
    }
  });
}


test('abort gives the process group cleanup time before escalating to SIGKILL', { timeout: 10_000 }, async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'prepare-grace-'));
  try {
    await mkdir(resolve(root, 'src/objects/fixture'), { recursive: true });
    await writeFile(resolve(root, 'src/objects/fixture/object.json'), '{}');
    await mkdir(resolve(root, 'packages/bake/cli'), { recursive: true });
    await writeFile(resolve(root, 'packages/bake/cli/check-stale-builds.mts'), `import { writeFileSync } from 'node:fs';
process.on('SIGTERM', () => writeFileSync('cleanup.txt', 'SIGTERM')); writeFileSync('command.pid', String(process.pid)); setInterval(() => {}, 1000);`);
    const entry = new URL('./index.ts', import.meta.url).href;
    const code = `import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareObjects } from ${JSON.stringify(entry)};
const root = ${JSON.stringify(root)}, controller = new AbortController(), originalKill = process.kill.bind(process), signals = [];
process.kill = (pid, signal) => {
  if (pid < 0 && signal !== 0) signals.push([signal, Date.now()]);
  return originalKill(pid, signal);
};
const running = prepareObjects(['fixture'], { root, from: 'builds', to: 'builds', signal: controller.signal, progress: () => {} });
let commandPid = 0;
for (let attempt = 0; attempt < 200 && !commandPid; attempt++) {
  commandPid = Number(await readFile(root + '/command.pid', 'utf8').catch(() => '0'));
  if (!commandPid) await new Promise(done => setTimeout(done, 10));
}
assert.ok(commandPid, 'real command started');
controller.abort();
assert.equal(await running, false);
assert.deepEqual(signals.map(([signal]) => signal), ['SIGTERM', 'SIGKILL']);
assert.ok(signals[1][1] - signals[0][1] >= 1900, 'cleanup grace period elapsed');
assert.equal(await readFile(root + '/cleanup.txt', 'utf8'), 'SIGTERM');
assert.throws(() => originalKill(commandPid, 0), { code: 'ESRCH' });
console.log('GRACE_THEN_KILL_VERIFIED');`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', timeout: 7000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /GRACE_THEN_KILL_VERIFIED/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const received of ['SIGHUP', 'SIGQUIT', 'SIGINT', 'SIGTERM'] as const) {
  test(`${received} lets the detached command clean up before the parent terminates`, { timeout: 10_000 }, async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'prepare-parent-signal-'));
    let commandPid = 0;
    try {
      await mkdir(resolve(root, 'src/objects/fixture'), { recursive: true });
      await writeFile(resolve(root, 'src/objects/fixture/object.json'), '{}');
      await mkdir(resolve(root, 'packages/bake/cli'), { recursive: true });
      await writeFile(resolve(root, 'packages/bake/cli/check-stale-builds.mts'), `import { writeFileSync } from 'node:fs';
process.on('SIGTERM', () => { writeFileSync('cleanup.txt', 'SIGTERM'); process.exit(0); }); writeFileSync('command.pid', String(process.pid)); setInterval(() => {}, 1000);`);
      const entry = new URL('./index.ts', import.meta.url).href;
      const code = `import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises'; import { prepareObjects } from ${JSON.stringify(entry)};
const root = ${JSON.stringify(root)};
const running = prepareObjects(['fixture'], { root, from: 'builds', to: 'builds', progress: () => {} });
let ready = false;
for (let attempt = 0; attempt < 200 && !ready; attempt++) { ready = await readFile(root + '/command.pid').then(() => true, () => false); if (!ready) await new Promise(done => setTimeout(done, 10)); }
assert.ok(ready); process.kill(process.pid, ${JSON.stringify(received)}); await running;`;
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', timeout: 7000 });
      assert.equal(result.signal, received, result.stderr);
      commandPid = Number(await readFile(resolve(root, 'command.pid'), 'utf8'));
      assert.equal(await readFile(resolve(root, 'cleanup.txt'), 'utf8'), 'SIGTERM');
      assert.equal(alive(commandPid), false, 'command stopped after cleanup');
    } finally {
      if (commandPid && alive(commandPid)) process.kill(commandPid, 'SIGKILL');
      await rm(root, { recursive: true, force: true });
    }
  });
}

for (const denyKill of [false, true]) test(`a process-group signaling error is recorded and reported as run failure (kill denied: ${denyKill})`, { timeout: 10_000 }, async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'prepare-kill-error-'));
  try {
    await mkdir(resolve(root, 'src/objects/fixture'), { recursive: true });
    await writeFile(resolve(root, 'src/objects/fixture/object.json'), '{}');
    await mkdir(resolve(root, 'packages/bake/cli'), { recursive: true });
    await writeFile(resolve(root, 'packages/bake/cli/check-stale-builds.mts'), `import { writeFileSync } from 'node:fs'; writeFileSync('command.pid', String(process.pid)); setInterval(() => {}, 1000);`);
    const entry = new URL('./index.ts', import.meta.url).href;
    const code = `import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises'; import { prepareObjects } from ${JSON.stringify(entry)};
const root = ${JSON.stringify(root)}, controller = new AbortController(), originalKill = process.kill.bind(process);
process.kill = (pid, signal) => { if (pid < 0 && (signal === 'SIGTERM' || (${denyKill} && signal === 'SIGKILL'))) throw Object.assign(new Error('group cleanup denied'), { code: 'EPERM' }); return originalKill(pid, signal); };
const running = prepareObjects(['fixture'], { root, from: 'builds', to: 'builds', signal: controller.signal, progress: () => {} });
let ready = false;
for (let attempt = 0; attempt < 200 && !ready; attempt++) { ready = await readFile(root + '/command.pid').then(() => true, () => false); if (!ready) await new Promise(done => setTimeout(done, 10)); }
assert.ok(ready); controller.abort(); assert.equal(await running, false);
const commandPid = Number(await readFile(root + '/command.pid', 'utf8'));
try { originalKill(-commandPid, 'SIGKILL'); } catch (failure) { if (failure.code !== 'ESRCH') throw failure; }
console.log('SIGNAL_ERROR_REPORTED');`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', timeout: 7000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /SIGNAL_ERROR_REPORTED/u);
    assert.match(result.stderr, /group cleanup denied/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('parent hangup waits for cleanup of every concurrently running step group', { timeout: 10_000 }, async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'prepare-parallel-hangup-'));
  try {
    for (const id of ['first', 'second']) {
      await mkdir(resolve(root, 'src/objects', id), { recursive: true });
      await writeFile(resolve(root, 'src/objects', id, 'object.json'), '{}');
    }
    await mkdir(resolve(root, 'site/build/prepare'), { recursive: true });
    await writeFile(resolve(root, 'site/build/prepare/prepare-authored.ts'), `import { writeFileSync } from 'node:fs';
const id = process.argv[2];
process.on('SIGTERM', () => setTimeout(() => { writeFileSync(id + '.cleanup', 'SIGTERM'); process.exit(0); }, id === 'first' ? 50 : 250));
writeFileSync(id + '.pid', String(process.pid)); setInterval(() => {}, 1000);`);
    const entry = new URL('./index.ts', import.meta.url).href;
    const code = `import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises'; import { prepareObjects } from ${JSON.stringify(entry)};
const root = ${JSON.stringify(root)};
const running = prepareObjects(['first', 'second'], { root, from: 'prepare', to: 'prepare', progress: () => {} });
for (const id of ['first', 'second']) {
  let ready = false;
  for (let attempt = 0; attempt < 200 && !ready; attempt++) { ready = await readFile(root + '/' + id + '.pid').then(() => true, () => false); if (!ready) await new Promise(done => setTimeout(done, 10)); }
  assert.ok(ready);
}
process.kill(process.pid, 'SIGHUP'); await running;`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', timeout: 7000 });
    assert.equal(result.signal, 'SIGHUP', result.stderr);
    for (const id of ['first', 'second']) {
      assert.equal(await readFile(resolve(root, `${id}.cleanup`), 'utf8'), 'SIGTERM');
      assert.equal(alive(Number(await readFile(resolve(root, `${id}.pid`), 'utf8'))), false);
    }
  } finally {
    // A failing cleanup assertion must not leave the mutation's detached command alive.
    for (const id of ['first', 'second']) {
      const pid = Number(await readFile(resolve(root, `${id}.pid`), 'utf8').catch(() => '0'));
      if (pid && alive(pid)) process.kill(-pid, 'SIGKILL');
    }
    await rm(root, { recursive: true, force: true });
  }
});

test('a normally completed step fails when process-group cleanup is denied', { timeout: 10_000 }, async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'prepare-completed-signal-error-'));
  try {
    await mkdir(resolve(root, 'src/objects/fixture'), { recursive: true });
    await writeFile(resolve(root, 'src/objects/fixture/object.json'), '{}');
    await mkdir(resolve(root, 'packages/bake/cli'), { recursive: true });
    await writeFile(resolve(root, 'packages/bake/cli/check-stale-builds.mts'), 'export {};');
    const entry = new URL('./index.ts', import.meta.url).href;
    const code = `import assert from 'node:assert/strict'; import { prepareObjects } from ${JSON.stringify(entry)};
const originalKill = process.kill.bind(process);
process.kill = (pid, signal) => {
  if (pid < 0 && signal === 'SIGTERM') throw Object.assign(new Error('completed group cleanup denied'), { code: 'EPERM' });
  return originalKill(pid, signal);
};
const ok = await prepareObjects(['fixture'], { root: ${JSON.stringify(root)}, from: 'builds', to: 'builds', progress: () => {} });
assert.equal(ok, false, 'successful command exit cannot hide a cleanup error');
console.log('COMPLETED_GROUP_ERROR_VERIFIED');`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 7000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /COMPLETED_GROUP_ERROR_VERIFIED/u);
    assert.match(result.stderr, /completed group cleanup denied/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
