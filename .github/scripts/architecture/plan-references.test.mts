/** Literal old-path gates must retain live contracts and separate dated records. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { references, liveReferences, coveringReferences } from './plan-references.mts';
test('full, extensionless, relative and code-span pointers fail live gates; dated records do not', t => {
  const root = mkdtempSync(join(tmpdir(), 'site-references-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root]);
  for (const [file, text] of Object.entries({ 'site/a.mts': 'export {};', 'site/test/a.test.mts': "import '../a.mts';\nconst source = '../../packages/x/data.json';",
    'packages/AGENTS.md': '`site/a.mts`', 'docs/guide.md': '`node --test site/a`', 'untangle/done/record.md': '`site/a.mts`' })) {
    mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text);
  }
  const inventory = references(root, { 'site/a.mts': 'site/base/a.mts', 'site/test/a.test.mts': 'site/base/nested/a.test.mts' });
  assert.ok(inventory.occurrences.some(item => item.classification === 'AGENTS.md contract text'));
  assert.ok(inventory.occurrences.some(item => item.form === 'resolved relative string'));
  assert.ok(inventory.occurrences.some(item => item.scope === 'history'));
  assert.equal(liveReferences(inventory, ['site/a.mts']).length, 3);
  assert.equal(inventory.relativeReads.length, 1);
});

test('a moved module with the same basename is not a live reference to its old root path', t => {
  const root = mkdtempSync(join(tmpdir(), 'site-moved-references-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root]); mkdirSync(join(root, 'site/base'), { recursive: true });
  writeFileSync(join(root, 'site/base/a.mts'), 'export {};');
  writeFileSync(join(root, 'site/use.mts'), "import './base/a.mts';");
  assert.equal(liveReferences(references(root, { 'site/a.mts': 'site/base/a.mts' }), ['site/a.mts']).length, 0);
});

test('folder and glob pointers block retirement and surface during each test move; plan-internal inventories are excluded', t => {
  const root = mkdtempSync(join(tmpdir(), 'site-folder-references-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root]);
  for (const [file, text] of Object.entries({ '.github/workflows/audit.yml': 'node --test "site/test/*{source,facilit}*.test.mts"',
    'eslint.config.mts': '"site/test/**"', 'docs/unrelated.md': '`packages/renderer/test/fixtures/`', 'packages/AGENTS.md': '`site/test/`', 'docs/site-architecture/moves.json': '"site/test/a.test.mts"' })) {
    mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text);
  }
  const inventory = references(root, { 'site/test/a.test.mts': 'site/a/a.test.mts' });
  assert.equal(liveReferences(inventory, ['site/test/']).length, 3);
  assert.equal(coveringReferences(inventory, ['site/test/a.test.mts']).length, 3);
  assert.ok(inventory.occurrences.every(item => !item.file.startsWith('docs/site-architecture/')));
});
