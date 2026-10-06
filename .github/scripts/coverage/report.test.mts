/** The `root` scope follows the cohort the floors store, not whatever sits in the site root today. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOORS_FILE, scopeFiles } from './report.mts';

const checkout = fileURLToPath(new URL('../../../', import.meta.url));

function repository(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'coverage-scope-'));
  for (const [file, text] of Object.entries(files)) { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text); }
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}
const floors = (files: string[]) => JSON.stringify({ version: 1, scope: { id: 'root', files }, aggregate: { lines: 0, branches: 0, functions: 0 }, files: {} });

test('the checked-in root scope is the stored cohort, and every member is tracked', () => {
  const stored = (JSON.parse(readFileSync(join(checkout, FLOORS_FILE), 'utf8')) as { scope: { files: string[] } }).scope.files;
  assert.ok(stored.length > 100);
  assert.deepEqual(scopeFiles(checkout, 'root'), [...stored].sort());
});

test('a moved cohort file stays in scope; a root file outside the cohort does not join it', () => {
  const root = repository({ [FLOORS_FILE]: floors(['site/world/a.mts']), 'site/world/a.mts': '', 'site/loose.mts': '', 'site/env.d.ts': '' });
  try {
    assert.deepEqual(scopeFiles(root, 'root'), ['site/world/a.mts']);
    assert.deepEqual(scopeFiles(root, 'site'), ['site/loose.mts', 'site/world/a.mts']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a cohort file may live outside site', () => {
  const root = repository({ [FLOORS_FILE]: floors(['packages/x/a.ts']), 'packages/x/a.ts': '' });
  try { assert.deepEqual(scopeFiles(root, 'root'), ['packages/x/a.ts']); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test('a cohort file that moved without its floors being updated fails', () => {
  const root = repository({ [FLOORS_FILE]: floors(['site/a.mts']), 'site/world/a.mts': '' });
  try { assert.throws(() => scopeFiles(root, 'root'), /untracked files.*site\/a\.mts/u); }
  finally { rmSync(root, { recursive: true, force: true }); }
});
