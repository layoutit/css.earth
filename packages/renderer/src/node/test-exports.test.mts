import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { projectRoot } from '@cssearth/core/node';
import { requireRecord, requireString } from '@cssearth/core';

test('renderer fixture exports are exactly the imported test entries', () => {
  const root = projectRoot(import.meta.url);
  const manifest = requireRecord(JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')));
  const entries = requireRecord(manifest.exports);
  const files = execFileSync('git', ['grep', '-l', '-z', '-F', '@cssearth/renderer/test/', '--', '*.ts', '*.mts'], { cwd: root, encoding: 'utf8' }).split('\0').filter(path => /\.[cm]?tsx?$/u.test(path));
  const imports = new Set<string>();
  const external = new Set<string>();
  for (const file of files) {
    const source = readFileSync(`${root}/${file}`, 'utf8');
    for (const match of source.matchAll(/['"]@cssearth\/renderer\/(test\/[^'"]+)['"]/gu)) {
      imports.add(`./${match[1]}`);
      if (!file.startsWith('packages/renderer/')) external.add(file);
    }
  }
  const exported = Object.keys(entries).filter(key => key.startsWith('./test/'));
  assert.deepEqual(exported.sort(), [...imports].sort());
  assert.deepEqual([...external], ['site/world/runtime-package.test.mts']);
  for (const entry of exported) {
    assert.equal(requireString(entries[entry]), entry);
    assert.ok(import.meta.resolve(`@cssearth/renderer/${entry.slice(2)}`).endsWith(entry.slice(1)));
  }
});
