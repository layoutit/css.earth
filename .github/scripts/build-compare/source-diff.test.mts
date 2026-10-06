/** Ensure pure-move detection removes reference operands rather than executable edits. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importSkeleton } from './source-diff.mts';
test('specifier-only imports and style references preserve skeleton', () => {
  for (const [before, after] of [["import './a.mts';", "import './world/a.mts';"], ["@import './a.css';", "@import './world/a.css';"], ["const u = new URL('./a.json', import.meta.url);", "const u = new URL('../a.json', import.meta.url);"]]) assert.equal(importSkeleton(before!), importSkeleton(after!));
});
test('constants and arbitrary path strings remain executable differences', () => {
  assert.notEqual(importSkeleton('export const x=2;'), importSkeleton('export const x=3;'));
  assert.notEqual(importSkeleton("readFileSync('site/a.mts');"), importSkeleton("readFileSync('site/world/a.mts');"));
});
test('a renamed source larger than the child-process default buffer is read', async () => {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { sourceDiff } = await import('./source-diff.mts');
  const root = mkdtempSync(join(tmpdir(), 'source-diff-'));
  try {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    git('init', '-q'); git('config', 'user.email', 'probe@example.org'); git('config', 'user.name', 'probe');
    mkdirSync(join(root, 'src/old'), { recursive: true });
    const large = `export const rows = [\n${'  "row",\n'.repeat(200_000)}];\n`;
    writeFileSync(join(root, 'src/old/large.mts'), large); writeFileSync(join(root, 'src/old/edited.mts'), large);
    git('add', '-A'); git('commit', '-q', '-m', 'base'); const base = git('rev-parse', 'HEAD');
    git('mv', 'src/old', 'src/new'); writeFileSync(join(root, 'src/new/edited.mts'), large.replace('"row"', '"changed"'));
    git('add', '-A'); git('commit', '-q', '-m', 'head');
    const diff = sourceDiff(root, base, 'HEAD');
    assert.deepEqual(diff.renames, { 'src/old/edited.mts': 'src/new/edited.mts', 'src/old/large.mts': 'src/new/large.mts' });
    assert.equal(diff.specifierOnly, false, 'the edited large file is read and compared');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
