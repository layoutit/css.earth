/** The pre-install launcher must never load lane dependencies before installation succeeds. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worker } from './launch.mts';
test('head worker installs before CI and saves positive terminal evidence, including failures', async () => {
  const state = await mkdtemp(join(tmpdir(), 'lane-worker-'));
  const options = { state, head: '/head', base: '/base', out: '/out', archive: '/archive', ready: '/ready' };
  try {
    for (const install of [0, 1]) {
      const calls: string[] = [];
      const code = await worker(options, async (program, args, cwd, env) => {
        calls.push(program); assert.equal(cwd, '/head');
        if (program === 'pnpm' && args[0] === 'exec') { assert.deepEqual(args, ['exec', 'playwright', 'install', '--with-deps', 'chromium', 'webkit']); return 0; }
        if (program === 'pnpm') { assert.deepEqual(args, ['install', '--frozen-lockfile', '--ignore-scripts']); return install; }
        assert.ok(args.includes('--browsers-ready') && args.includes(join(state, 'browsers')));
        assert.equal(env.HEAD_INSTALLED, 'true'); assert.equal(args[0], '/head/.github/scripts/build-compare/ci.mts'); return 0;
      });
      assert.equal(code, install); assert.equal(await readFile(join(state, 'exit'), 'utf8'), `${code}\n`);
      assert.deepEqual(calls, install ? ['pnpm'] : ['pnpm', 'pnpm', process.execPath]);
      if (!install) assert.equal(await readFile(join(state, 'browsers'), 'utf8'), 'ok\n');
    }
    const failed = await worker(options, async () => { throw new Error('positive launch failure'); });
    assert.equal(failed, 2); assert.equal(await readFile(join(state, 'exit'), 'utf8'), '2\n');
  } finally { await rm(state, { recursive: true, force: true }); }
});
