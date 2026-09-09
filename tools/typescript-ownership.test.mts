import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { auditOwnership } from './typescript-ownership.mts';

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'cssearth-typescript-ownership-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const manifest = (legacyAuthored: string[] = [], exceptions: Record<string, unknown> = {}) => write(
    'docs/architecture/typescript-ownership.json',
    JSON.stringify({ schemaVersion: 1, baselineCommit: '0'.repeat(40), legacyAuthored, exceptions }),
  );
  const stage = () => execFileSync('git', ['add', '--', '.'], { cwd: root });
  manifest();
  return { root, write, manifest, stage, audit: () => auditOwnership(root) };
}

test('rejects new JavaScript before and after staging, regardless of directory or generated claim', t => {
  const repo = fixture(t);
  repo.stage();
  for (const path of ['site/new-owner.mjs', 'tools/new-preparer.js', 'docs/new-author.mjs', 'site/vendor/local-helper.mjs', 'site/new-view.jsx']) {
    repo.write(path, '// Generated; do not edit.\nexport const behavior = 1;');
  }
  const untracked = repo.audit();
  assert.equal(untracked.counts.authored, 5);
  assert.equal(untracked.violations.length, 5);
  assert.ok(untracked.violations.every(message => message.startsWith('New authored JavaScript:')));
  repo.stage();
  assert.deepEqual(repo.audit(), untracked);
});

test('migrating a tracked implementation requires shrinking the exact backlog', t => {
  const repo = fixture(t);
  repo.write('site/legacy.mjs', 'export const value = 1;');
  repo.manifest(['site/legacy.mjs']);
  repo.stage();
  assert.deepEqual(repo.audit().violations, []);
  rmSync(join(repo.root, 'site/legacy.mjs'));
  repo.write('site/legacy.mts', 'export const value: number = 1;');
  assert.match(repo.audit().violations.join('\n'), /Stale authored backlog entry: site\/legacy\.mjs/u);
  repo.manifest();
  assert.deepEqual(repo.audit().violations, []);
  assert.equal(repo.audit().counts.authored, 0);
});

test('test and evidence paths cannot hide implementations imported by authored JS or TS', t => {
  const repo = fixture(t);
  repo.write('tests/helpers.mjs', 'export const value = 1;');
  repo.write('docs/evidence.mjs', 'export const measure = 1;');
  repo.write('site/legacy.mjs', '// import "../tests/helpers.mjs";\nexport const value = 1;');
  repo.write('site/owner.mts', 'export { measure } from "../docs/evidence.mjs";\nconst load = () => import("../tests/helpers.mjs");');
  repo.manifest(['site/legacy.mjs'], {
    'docs/evidence.mjs': { category: 'evidence', reason: 'Historical measurement harness.' },
  });
  const result = repo.audit();
  assert.equal(result.counts.test, 1);
  assert.equal(result.counts.evidence, 1);
  assert.equal(result.violations.length, 2);
  assert.ok(result.violations.every(message => message.startsWith('site/owner.mts: source imports')));
  repo.write('site/owner.mts', 'export const value: number = 1;');
  assert.deepEqual(repo.audit().violations, []);
});

test('a compatibility facade rejects added behavior and a different source owner', t => {
  const repo = fixture(t);
  repo.write('site/owner.mts', 'export const value: number = 1;');
  repo.write('site/owner.mjs', 'export { value } from "./owner.mts";');
  repo.manifest([], {
    'site/owner.mjs': { category: 'facade', reason: 'Existing import compatibility.', exports: { './owner.mts': ['value'] } },
  });
  assert.deepEqual(repo.audit().violations, []);
  repo.write('site/owner.mjs', 'export { value } from "./owner.mts";\nexport function helper() { return 1; }');
  assert.match(repo.audit().violations.join('\n'), /compatibility facade must only re-export/u);
  repo.write('site/owner.mjs', 'export { value } from "./other-owner.mts";');
  assert.match(repo.audit().violations.join('\n'), /compatibility facade must only re-export/u);
});

test('Astro frontmatter, client imports and script sources cannot reach excluded harnesses', t => {
  const repo = fixture(t);
  for (const name of ['server', 'client', 'external']) repo.write(`site/test/${name}.mjs`, 'export const value = 1;');
  repo.write('site/Shell.astro', `---
import { value } from './test/server.mjs';
---
<script>import './test/client.mjs';</script>
<script src="./test/external.mjs"></script>
`);
  const result = repo.audit();
  assert.equal(result.counts.authored, 0, 'Astro import inspection does not inflate the JavaScript count.');
  assert.equal(result.violations.length, 3);
  assert.ok(result.violations.every(message => message.startsWith('site/Shell.astro: source imports test module')));
  repo.write('site/Shell.astro', '<main>A checked shell</main>');
  assert.deepEqual(repo.audit().violations, []);
});

test('root-relative Vite imports and public script URLs cannot reach excluded harnesses', t => {
  const repo = fixture(t);
  for (const name of ['client', 'external', 'filesystem']) repo.write(`site/test/${name}.mjs`, 'export const value = 1;');
  repo.write('public/browser-fixture.test.mjs', 'export const fixture = 1;');
  repo.write('site/Shell.astro', `<script>import '/site/test/client.mjs';</script>
<script src="/site/test/external.mjs"></script>
<script src="/browser-fixture.test.mjs"></script>
`);
  repo.write('site/client.mts', `import '/site/test/client.mjs';
import '/@fs/${repo.root}/site/test/filesystem.mjs';
`);
  const result = repo.audit();
  assert.equal(result.violations.length, 5);
  assert.ok(result.violations.includes('site/Shell.astro: source imports test module public/browser-fixture.test.mjs; move shared behavior into an authored owner.'));
  assert.ok(result.violations.includes('site/Shell.astro: source imports test module site/test/external.mjs; move shared behavior into an authored owner.'));
  assert.ok(result.violations.includes('site/Shell.astro: source imports test module site/test/client.mjs; move shared behavior into an authored owner.'));
  assert.ok(result.violations.includes('site/client.mts: source imports test module site/test/client.mjs; move shared behavior into an authored owner.'));
  assert.ok(result.violations.includes('site/client.mts: source imports test module site/test/filesystem.mjs; move shared behavior into an authored owner.'));
});

test('generated and vendor exceptions need current provenance and cannot go stale', t => {
  const repo = fixture(t);
  repo.write('tools/producer.mts', 'export const generate = () => 1;');
  repo.write('site/generated.mjs', '// Generated by tools/producer.mts.\nexport const data = 1;');
  const exceptions = {
    'site/generated.mjs': {
      category: 'generated', reason: 'Reproducible output.', source: 'tools/producer.mts', anchor: '// Generated by tools/producer.mts.',
    },
  };
  repo.manifest([], exceptions);
  assert.deepEqual(repo.audit().violations, []);
  repo.write('site/generated.mjs', 'export const behavior = () => 1;');
  assert.match(repo.audit().violations.join('\n'), /source anchor no longer matches/u);
  repo.write('site/generated.mjs', '// Generated by tools/producer.mts.\nexport const data = 1;');
  rmSync(join(repo.root, 'tools/producer.mts'));
  assert.match(repo.audit().violations.join('\n'), /missing provenance source/u);
  rmSync(join(repo.root, 'site/generated.mjs'));
  assert.match(repo.audit().violations.join('\n'), /Stale JavaScript exception/u);
  repo.manifest();
  assert.deepEqual(repo.audit().violations, []);
  repo.write('site/vendor.mjs', 'export const value = 1;');
  repo.manifest([], { 'site/vendor.mjs': { category: 'vendor', reason: 'Upstream source.' } });
  assert.throws(() => repo.audit(), /require provenance and a source anchor/u);
});

test('ignored build output is omitted while tracked JavaScript stays accountable', t => {
  const repo = fixture(t);
  repo.write('site/legacy.mjs', 'export const value = 1;');
  repo.manifest(['site/legacy.mjs']);
  repo.stage();
  repo.write('.gitignore', 'dist/\nsite/legacy.mjs\n');
  repo.write('dist/bundle.js', 'export const compiled = 1;');
  const result = repo.audit();
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.categories.authored, ['site/legacy.mjs']);
});
