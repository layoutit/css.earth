import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { withCheckoutLock } from './lock.mts';
test('a competing process fails before its action; nested commands and failure cleanup work', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'checkout-lock-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(withCheckoutLock(root, async () => {
    assert.match(await readFile(resolve(root, 'output/checkout-check.lock'), 'utf8'), /^\d+:/u);
    await withCheckoutLock(root, async () => {});
    const env = { ...process.env };
    delete env.CSSEARTH_CHECK_LOCK;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e',
      `import {withCheckoutLock} from ${JSON.stringify(new URL('./lock.mts', import.meta.url).href)}; await withCheckoutLock(${JSON.stringify(root)}, async()=>console.log('ACTION RAN'));`], { env, encoding: 'utf8' });
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /already owns/u);
    assert.doesNotMatch(child.stdout, /ACTION RAN/u);
    throw new Error('action failed');
  }), /action failed/u);
  await withCheckoutLock(root, async () => {});
});
