/** No object package ships the placeholder `telescope new-object` writes where only a person can write the prose. One search
 * of the tracked text, not a read of every package. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { TODO } from '../../packages/telescope-cli/src/new-object/scaffold.mts';

test('no scaffold placeholder is left in any object package', () => {
  const search = spawnSync('git', ['grep', '-l', '-I', '-F', TODO, '--', ':(glob)src/objects/*/**'], { cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8' });
  // git grep exits 1 when nothing matches, and 2 or more on an error.
  assert.ok(search.status === 0 || search.status === 1, search.stderr);
  assert.equal(search.stdout, '', `replace every ${TODO} before committing`);
});
