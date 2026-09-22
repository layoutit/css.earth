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
    'tools/ci/typescript-ownership.json',
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

test('test, fixture, and capture JavaScript require visible exact backlog entries', t => {
  const repo = fixture(t);
  const legacy = ['site/owner.test.mjs', 'tests/fixtures/orbit.js', 'tools/capture-orbit.mjs'];
  for (const path of legacy) repo.write(path, 'export const value = 1;');
  const unlisted = repo.audit();
  assert.deepEqual(unlisted.categories.authored, legacy);
  assert.deepEqual(unlisted.violations, legacy.map(path => `New authored JavaScript: ${path}. Use TypeScript or justify an exact exception.`));
  repo.manifest(legacy);
  assert.deepEqual(repo.audit().violations, []);
  assert.deepEqual(repo.audit().categories.authored, legacy);
});

test('test and evidence roles cannot be used as ownership exceptions or imported by runtime JS or TS', t => {
  const repo = fixture(t);
  repo.write('tests/helpers.mjs', 'export const value = 1;');
  repo.write('docs/evidence.mjs', 'export const measure = 1;');
  repo.write('tools/capture-orbit.mjs', 'export const capture = 1;');
  repo.write('site/legacy.mjs', '// import "../../tests/helpers.mjs";\nexport const value = 1;');
  repo.write('site/owner.mts', 'export { measure } from "../../docs/evidence.mjs";\nconst load = () => import("../../tests/helpers.mjs");\nconst capture = () => import("../capture-orbit.mjs");');
  repo.manifest(['docs/evidence.mjs', 'site/legacy.mjs', 'tests/helpers.mjs', 'tools/capture-orbit.mjs']);
  const result = repo.audit();
  assert.equal(result.counts.authored, 4);
  assert.equal(result.violations.length, 3);
  assert.ok(result.violations.every(message => message.startsWith('site/owner.mts: source imports')));
  repo.write('site/owner.mts', 'export const value: number = 1;');
  assert.deepEqual(repo.audit().violations, []);
  repo.manifest([], { 'tests/helpers.mjs': { category: 'test', reason: 'A test name is not an exception.' } });
  assert.throws(() => repo.audit(), /invalid exception category/u);
});

test('source-local tests and audit runners may import harnesses while production cannot import them', t => {
  const repo = fixture(t);
  repo.write('site/test/browser-helper.mts', 'export const browser = 1;');
  repo.write('tools/capture-image.mts', 'export const capture = 1;');
  repo.write('src/platform/test/illumination-browser.mts', 'import "../../../../site/test/browser-helper.mts";');
  repo.write('src/test/shared-helper.mts', 'import "../../../tools/capture-image.mts";');
  repo.write('tools/audits/worlds/browser-check.mts', 'import "../../../../site/test/browser-helper.mts"; import "../../../capture-image.mts";');
  repo.write('tools/oracles/mars/compare.mts', 'import "../../../../site/test/browser-helper.mts";');
  assert.deepEqual(repo.audit().violations, [], 'Actual test and audit owners may use browser/capture helpers.');
  repo.write('src/platform/owner.mts', 'import "../test/illumination-browser.mts"; import "../../../tools/audits/worlds/browser-check.mts";');
  repo.write('src/testimonials/owner.mts', 'import "../../../site/test/browser-helper.mts";');
  repo.write('tools/audits-helper.mts', 'import "../capture-image.mts";');
  assert.deepEqual(repo.audit().violations, [
    'src/platform/owner.mts: source imports evidence module tools/audits/worlds/browser-check.mts; move shared behavior into an authored owner.',
    'src/platform/owner.mts: source imports test module src/platform/test/illumination-browser.mts; move shared behavior into an authored owner.',
    'src/testimonials/owner.mts: source imports test module site/test/browser-helper.mts; move shared behavior into an authored owner.',
    'tools/audits-helper.mts: source imports evidence module tools/capture-image.mts; move shared behavior into an authored owner.',
  ]);
});

test('source-local test and audit JavaScript remain authored and receive no ownership exemption', t => {
  const repo = fixture(t);
  const paths = ['src/platform/test/browser.mjs', 'src/test/helper.js', 'tools/audits/worlds/browser-check.mjs'];
  for (const path of paths) repo.write(path, 'export const behavior = 1;');
  const result = repo.audit();
  assert.deepEqual(result.categories.authored, paths);
  assert.deepEqual(result.violations, paths.map(path => `New authored JavaScript: ${path}. Use TypeScript or justify an exact exception.`));
});

test('nebula evidence fusion is an authored algorithm owner without exempting its harness imports', t => {
  const repo = fixture(t);
  const owner = 'labs/nebula/packages/reconstruction/src/evidence/model.ts';
  repo.write(owner, 'export const combine = () => 1;');
  repo.write('labs/nebula/src/reconstruction/compiler.ts', `import "/${owner}";`);
  assert.deepEqual(repo.audit().violations, [], 'The exact multiband processing owner is usable by authored source.');

  const harnesses = [
    ['tools/capture-image.mts', 'evidence'],
    ['labs/nebula/packages/reconstruction/src/evidence/capture-image.ts', 'evidence'],
    ['labs/nebula/packages/reconstruction/src/evidence/model.test.ts', 'test'],
    ['labs/nebula/packages/reconstruction/src/evidence-copy/model.ts', 'evidence'],
    ['tools/evidence/compare.mts', 'evidence'],
    ['tools/audits/images/compare.mts', 'evidence'],
    ['labs/nebula/src/reconstruction/evidence-fusion/capture-image.ts', 'evidence'],
    ['labs/nebula/src/reconstruction/evidence-fusion/model.test.ts', 'test'],
    ['labs/nebula/src/reconstruction/evidence-fusion-copy/model.ts', 'evidence'],
    ['labs/other/src/evidence-fusion/model.ts', 'evidence'],
  ];
  for (const [path] of harnesses) repo.write(path!, 'export const measure = 1;');
  repo.write(owner, harnesses.map(([path]) => `import "/${path}";`).join('\n'));
  assert.deepEqual(repo.audit().violations, harnesses.map(([path, role]) =>
    `${owner}: source imports ${role} module ${path}; move shared behavior into an authored owner.`).sort());
  repo.write('labs/nebula/src/reconstruction/evidence-fusion/new-owner.js', 'export const value = 1;');
  assert.ok(repo.audit().violations.includes('New authored JavaScript: labs/nebula/src/reconstruction/evidence-fusion/new-owner.js. Use TypeScript or justify an exact exception.'));
});

test('moved lab evidence-fusion features, workflows and route are authored owners with narrow boundaries', t => {
  const repo = fixture(t);
  const owners = [
    'labs/nebula/packages/lab/src/features/evidence-fusion/jobs-model.ts',
    'labs/nebula/packages/lab/src/server/workflows/evidence-fusion/provider.ts',
    'labs/nebula/packages/lab/src/server/routes/evidence-fusion.ts',
  ];
  for (const owner of owners) repo.write(owner, 'export const value = 1;');
  repo.write('labs/nebula/vite.config.ts', owners.map(owner => `import "/${owner}";`).join('\n'));
  assert.deepEqual(repo.audit().violations, []);
  const harnesses = [
    ['labs/nebula/packages/lab/src/features/evidence-fusion/capture-image.ts', 'evidence'],
    ['labs/nebula/packages/lab/src/server/workflows/evidence-fusion/evidence/report.ts', 'evidence'],
    ['labs/nebula/packages/lab/src/features/evidence-fusion/jobs-model.test.ts', 'test'],
    ['labs/nebula/packages/lab/src/server/routes/evidence-fusion.test.ts', 'test'],
    ['labs/nebula/packages/lab/src/features/evidence-fusion-copy/model.ts', 'evidence'],
    ['labs/nebula/packages/lab/src/server/workflows/evidence-fusion-copy/model.ts', 'evidence'],
    ['labs/nebula/packages/lab/src/server/routes/evidence-fusion-report.ts', 'evidence'],
  ];
  for (const [path] of harnesses) repo.write(path!, 'export const value = 1;');
  for (const owner of owners) repo.write(owner, harnesses.map(([path]) => `import "/${path}";`).join('\n'));
  assert.deepEqual(repo.audit().violations, owners.flatMap(owner => harnesses.map(([path, role]) =>
    `${owner}: source imports ${role} module ${path}; move shared behavior into an authored owner.`)).sort());
  const authoredJs = 'labs/nebula/packages/lab/src/server/workflows/evidence-fusion/new-owner.js';
  repo.write(authoredJs, 'export const value = 1;');
  assert.ok(repo.audit().violations.includes(`New authored JavaScript: ${authoredJs}. Use TypeScript or justify an exact exception.`));
});

test('a compatibility facade rejects added behavior and a different source owner', t => {
  const repo = fixture(t);
  repo.write('site/owner.mts', 'export const value: number = 1;');
  repo.write('site/owner.mjs', 'export { value } from "../owner.mts";');
  repo.manifest([], {
    'site/owner.mjs': { category: 'facade', reason: 'Existing import compatibility.', exports: { './owner.mts': ['value'] } },
  });
  assert.deepEqual(repo.audit().violations, []);
  repo.write('site/owner.mjs', 'export { value } from "../owner.mts";\nexport function helper() { return 1; }');
  assert.match(repo.audit().violations.join('\n'), /compatibility facade must only re-export/u);
  repo.write('site/owner.mjs', 'export { value } from "../other-owner.mts";');
  assert.match(repo.audit().violations.join('\n'), /compatibility facade must only re-export/u);
});

test('Astro frontmatter, client imports and script sources cannot reach excluded harnesses', t => {
  const repo = fixture(t);
  for (const name of ['server', 'client', 'external']) repo.write(`site/test/${name}.mjs`, 'export const value = 1;');
  repo.manifest(['site/test/client.mjs', 'site/test/external.mjs', 'site/test/server.mjs']);
  repo.write('site/Shell.astro', `---
import { value } from '../test/server.mjs';
---
<script>import '../test/client.mjs';</script>
<script src="./test/external.mjs"></script>
`);
  const result = repo.audit();
  assert.equal(result.counts.authored, 3, 'Test-shaped JavaScript stays in the visible authored backlog.');
  assert.equal(result.violations.length, 3);
  assert.ok(result.violations.every(message => message.startsWith('site/Shell.astro: source imports test module')));
  repo.write('site/Shell.astro', '<main>A checked shell</main>');
  assert.deepEqual(repo.audit().violations, []);
});

test('root-relative Vite imports and public script URLs cannot reach excluded harnesses', t => {
  const repo = fixture(t);
  for (const name of ['client', 'external', 'filesystem']) repo.write(`site/test/${name}.mjs`, 'export const value = 1;');
  repo.write('public/browser-fixture.test.mjs', 'export const fixture = 1;');
  repo.manifest(['public/browser-fixture.test.mjs', 'site/test/client.mjs', 'site/test/external.mjs', 'site/test/filesystem.mjs']);
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
