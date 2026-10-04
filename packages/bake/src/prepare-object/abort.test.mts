import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { prepareObjects } from '@cssearth/bake/prepare-object';

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


test('an aborted process group is signaled once even when later teardown signals would fail', { timeout: 10_000 }, async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'prepare-abort-once-'));
  try {
    await mkdir(resolve(root, 'src/objects/fixture'), { recursive: true });
    await writeFile(resolve(root, 'src/objects/fixture/object.json'), '{}');
    await mkdir(resolve(root, 'packages/bake/cli'), { recursive: true });
    await writeFile(resolve(root, 'packages/bake/cli/check-stale-builds.mts'), `import { writeFileSync } from 'node:fs';
writeFileSync('command.pid', String(process.pid)); setInterval(() => {}, 1000);`);
    const entry = new URL('./index.ts', import.meta.url).href;
    const code = `import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareObjects } from ${JSON.stringify(entry)};
const root = ${JSON.stringify(root)}, controller = new AbortController(), originalKill = process.kill.bind(process);
let groupSignals = 0;
process.kill = (pid, signal) => {
  if (pid < 0 && ++groupSignals > 1) throw Object.assign(new Error('second group signal denied'), { code: 'EPERM' });
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
assert.equal(groupSignals, 1);
assert.throws(() => originalKill(commandPid, 0), { code: 'ESRCH' });
console.log('ABORT_GROUP_SIGNALED_ONCE');`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ABORT_GROUP_SIGNALED_ONCE/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
