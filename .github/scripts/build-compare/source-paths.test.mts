/** A whole-repository move must not crash the declaration gate on git's output size. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { hasSiteRenames } from './source-paths.mts';

test('hasSiteRenames reads a move list larger than the 1 MiB child-process default', () => {
  const root = mkdtempSync(join(tmpdir(), 'gate-buffer-')), git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  try {
    git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    const name = (folder: string, i: number) => join(folder, `a-long-file-name-that-pads-the-move-list-${String(i).padStart(5, '0')}.txt`);
    mkdirSync(join(root, 'public'));
    for (let i = 0; i < 12_000; i++) writeFileSync(join(root, name('public', i)), String(i));
    git('add', '-A'); git('commit', '-q', '-m', 'base');
    execFileSync('git', ['mv', 'public', 'site'], { cwd: root });
    git('commit', '-q', '-m', 'move');
    assert.equal(hasSiteRenames(root, 'HEAD~1', 'HEAD'), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
