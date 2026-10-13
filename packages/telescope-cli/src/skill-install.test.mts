import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, lstatSync, readFileSync, readlinkSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test, type TestContext } from 'node:test';
import { manageSkill, parseSkillArguments, RECEIPT, skillDestinations } from './skill-install.mts';

function sandbox(t: TestContext) {
  const home = mkdtempSync(join(tmpdir(), 'telescope-skill-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return home;
}
function packagedSkill(packageRoot: string) {
  const source = join(packageRoot, 'skills', 'telescope');
  mkdirSync(source, { recursive: true }); writeFileSync(join(source, 'SKILL.md'), 'source');
  return source;
}
for (const path of ['temporary-package', '.npm/_npx/run/node_modules/@cssearth/telescope']) test(`${path}: refuses links before writing; copies survive source removal`, t => {
  const home = sandbox(t);
  const packageRoot = join(home, path); packagedSkill(packageRoot);
  const options = { action: 'install', copy: false, destination: join(home, `${path.split('/')[0]}-host`) } as const;
  assert.throws(() => manageSkill(options, packageRoot), /run with --copy, or install the package first/u);
  assert.throws(() => lstatSync(options.destination), { code: 'ENOENT' });
  const { target } = manageSkill({ ...options, copy: true }, packageRoot);
  rmSync(packageRoot, { recursive: true });
  assert.equal(readFileSync(join(target, 'SKILL.md'), 'utf8'), 'source');
  assert.equal(manageSkill({ ...options, action: 'uninstall' }).status, 'removed');
});
test('project and global node_modules installations support persistent links', t => {
  const home = sandbox(t);
  for (const path of ['project/node_modules/@cssearth/telescope', 'global/lib/node_modules/@cssearth/telescope']) {
    const packageRoot = join(home, path), source = packagedSkill(packageRoot);
    const options = { action: 'install', copy: false, destination: join(home, `${path.split('/')[0]}-host`) } as const;
    const { target } = manageSkill(options, packageRoot);
    assert.equal(readlinkSync(target), realpathSync(source));
    assert.equal(manageSkill({ ...options, action: 'uninstall' }, packageRoot).status, 'removed');
  }
});
test('uninstall removes a vanished package skill link from a fresh package location', t => {
  const home = sandbox(t);
  for (const path of ['.npm/_npx/old/node_modules/@cssearth/telescope', 'old-checkout/packages/telescope-cli']) {
    const packageRoot = join(home, path), source = packagedSkill(packageRoot);
    const destination = join(home, `${path.split('/')[0]}-host`), target = join(destination, 'telescope');
    mkdirSync(destination); writeFileSync(join(destination, 'keep'), 'keep');
    // Reproduce a link left by the previous installer, including a relative recorded target.
    symlinkSync(relative(destination, source), target, 'dir');
    rmSync(packageRoot, { recursive: true });
    for (const copy of [false, true]) assert.throws(() => manageSkill({ action: 'install', copy, destination }), /Refusing unrelated link/u);
    assert.equal(manageSkill({ action: 'uninstall', copy: false, destination }).status, 'removed');
    assert.deepEqual(readdirSync(destination), ['keep']);
    assert.equal(manageSkill({ action: 'uninstall', copy: false, destination }).status, 'absent');
  }
});
test('uninstall preserves live links to other packages and dangling non-package skill paths', t => {
  const home = sandbox(t);
  for (const [index, path] of ['other/node_modules/@cssearth/telescope', 'mine/skills/telescope', 'node_modules/other/skills/telescope', 'node_modules/@cssearth/telescope/skills/other'].entries()) {
    const destination = join(home, `host-${index}`), target = join(destination, 'telescope'), packageRoot = join(home, path);
    const source = index === 0 ? packagedSkill(packageRoot) : packageRoot;
    mkdirSync(destination); symlinkSync(source, target, 'dir');
    const inode = lstatSync(target).ino;
    assert.throws(() => manageSkill({ action: 'uninstall', copy: false, destination }), /Refusing unrelated link/u);
    assert.equal(lstatSync(target).ino, inode);
  }
});
test('provider roots and configured homes match the host contracts', () => {
  assert.deepEqual(skillDestinations('/user', {}), {
    claude: '/user/.claude/skills', codex: '/user/.codex/skills', agents: '/user/.agents/skills', grok: '/user/.agents/skills',
    agy: '/user/.gemini/antigravity-cli/skills', antigravity: '/user/.gemini/config/skills', cursor: '/user/.cursor/skills', opencode: '/user/.config/opencode/skills',
  });
  const configured = skillDestinations('/user', { CODEX_HOME: '/c', CLAUDE_CONFIG_DIR: '/a', XDG_CONFIG_HOME: '/x' });
  assert.equal(configured.codex, '/c/skills'); assert.equal(configured.claude, '/a/skills'); assert.equal(configured.opencode, '/x/opencode/skills');
});
for (const provider of Object.keys(skillDestinations())) for (const copy of [false, true]) {
  test(`${provider}: ${copy ? 'copy' : 'link'} installation repeats unchanged and uninstalls safely`, t => {
    const home = sandbox(t), args = ['skill', 'install', '--provider', provider, ...(copy ? ['--copy'] : [])];
    const options = parseSkillArguments(args, home, {}), result = manageSkill(options);
    assert.equal(result.status, 'installed');
    const before = lstatSync(result.target);
    assert.equal(before.isSymbolicLink(), !copy);
    assert.match(readFileSync(join(result.target, 'SKILL.md'), 'utf8'), /^---\nname: telescope\n/u);
    if (copy) {
      const receipt: unknown = JSON.parse(readFileSync(join(result.target, RECEIPT), 'utf8'));
      assert.ok(receipt && typeof receipt === 'object' && 'owner' in receipt && receipt.owner === '@cssearth/telescope');
    } else assert.match(readlinkSync(result.target), /skills[/\\]telescope$/u);
    assert.equal(manageSkill(options).status, 'already-installed');
    assert.equal(lstatSync(result.target).ino, before.ino);
    mkdirSync(join(options.destination, 'unrelated'));
    assert.equal(manageSkill({ ...options, action: 'uninstall', copy: false }).status, 'removed');
    assert.equal(manageSkill({ ...options, action: 'uninstall' }).status, 'absent');
    assert.deepEqual(readdirSync(options.destination), ['unrelated']);
  });
}
test('explicit selection and strict options fail before writing', t => {
  const destination = join(sandbox(t), 'skills');
  for (const args of [[], ['install'], ['install', '--provider', 'unknown'], ['install', '--dest', destination, '--provider', 'codex'],
    ['install', '--dest', destination, '--force'], ['install', '--dest'], ['install', '--dest', destination, '--copy', '--copy'], ['remove', '--dest', destination]])
    assert.throws(() => parseSkillArguments(['skill', ...args]), TypeError);
});
test('conflicting files, folders and unrelated or dangling links are preserved', t => {
  const home = sandbox(t);
  for (const kind of ['file', 'folder', 'link', 'dangling']) {
    const destination = join(home, kind), target = join(destination, 'telescope'); mkdirSync(destination);
    if (kind === 'file') writeFileSync(target, 'keep');
    else if (kind === 'folder') { mkdirSync(target); writeFileSync(join(target, 'keep'), 'keep'); }
    else symlinkSync(join(home, 'missing'), target, 'dir');
    const inode = lstatSync(target).ino;
    for (const action of ['install', 'uninstall'] as const) for (const copy of [false, true])
      assert.throws(() => manageSkill({ action, copy, destination }), /Refusing unrelated/u);
    assert.equal(lstatSync(target).ino, inode);
  }
});
test('modified, extended or unreceipted copies cannot be removed or reinstalled', t => {
  const home = sandbox(t);
  for (const edit of ['content', 'file', 'empty-directory', 'receipt', 'missing-receipt', 'missing-file', 'symlink', 'prototype-name']) {
    const destination = join(home, edit), options = { action: 'install', copy: true, destination } as const;
    const { target } = manageSkill(options);
    if (edit === 'content') writeFileSync(join(target, 'SKILL.md'), 'edits');
    else if (edit === 'file') writeFileSync(join(target, 'notes'), 'keep');
    else if (edit === 'prototype-name') writeFileSync(join(target, '__proto__'), 'keep');
    else if (edit === 'empty-directory') mkdirSync(join(target, 'notes'));
    else if (edit === 'missing-file') unlinkSync(join(target, 'SKILL.md'));
    else if (edit === 'missing-receipt') unlinkSync(join(target, RECEIPT));
    else if (edit === 'symlink') { unlinkSync(join(target, 'SKILL.md')); symlinkSync('/missing', join(target, 'SKILL.md')); }
    else writeFileSync(join(target, RECEIPT), '{"owner":"someone else"}');
    assert.throws(() => manageSkill({ ...options, action: 'uninstall' }));
    assert.throws(() => manageSkill(options)); assert.ok(lstatSync(target).isDirectory());
  }
});
test('mode switches preserve the existing installation', t => {
  for (const copy of [false, true]) {
    const destination = join(sandbox(t), 'skills'), options = { action: 'install', copy, destination } as const;
    const { target } = manageSkill(options), inode = lstatSync(target).ino;
    assert.throws(() => manageSkill({ ...options, copy: !copy }), /Uninstall first/u);
    assert.equal(lstatSync(target).ino, inode);
  }
});
test('receipt compares bytes independently of key order; package updates preserve unchanged copies', t => {
  const home = sandbox(t), packageRoot = join(home, 'package'), source = join(packageRoot, 'skills', 'telescope');
  mkdirSync(join(source, 'references'), { recursive: true }); writeFileSync(join(source, 'SKILL.md'), 'original');
  writeFileSync(join(source, 'references', 'example.md'), 'reference');
  const options = { action: 'install', copy: true, destination: join(home, 'host') } as const;
  const { target } = manageSkill(options, packageRoot);
  const receipt: unknown = JSON.parse(readFileSync(join(target, RECEIPT), 'utf8'));
  assert.ok(receipt && typeof receipt === 'object' && 'files' in receipt && receipt.files && typeof receipt.files === 'object');
  writeFileSync(join(target, RECEIPT), JSON.stringify({ ...receipt, files: Object.fromEntries(Object.entries(receipt.files).reverse()) }));
  assert.equal(manageSkill(options, packageRoot).status, 'already-installed');
  writeFileSync(join(source, 'SKILL.md'), 'updated');
  assert.throws(() => manageSkill(options, packageRoot), /differs from this package/u);
  assert.equal(manageSkill({ ...options, action: 'uninstall' }, packageRoot).status, 'removed');
});
test('a destination aliased into the package is refused before creating folders', t => {
  const home = sandbox(t), packageRoot = join(home, 'package'), source = join(packageRoot, 'skills', 'telescope');
  mkdirSync(source, { recursive: true }); writeFileSync(join(source, 'SKILL.md'), 'source');
  symlinkSync(source, join(home, 'alias'), 'dir');
  for (const destination of [source, join(home, 'alias', 'missing'), join(packageRoot, 'skills')])
    assert.throws(() => manageSkill({ action: 'install', copy: true, destination }, packageRoot), /overlaps/u);
  assert.deepEqual(readdirSync(source), ['SKILL.md']);
});
