import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkSiteRootAllowlist, SITE_ROOT_ALLOWLIST_FILE } from './site-root-allowlist.mts';
import { REPOSITORY_RULES, isBroken, repositoryFindings } from './repository-rules.mts';
import { repositoryFiles } from './import-graph/graph.mts';

test('a loose file in site/ fails the repository check; an allowlisted one, or a file in a folder, passes', () => {
  const rule = REPOSITORY_RULES.find(item => item.id === 'site-root-allowlist');
  assert.ok(rule, 'the site-root-allowlist rule is registered');
  const root = mkdtempSync(join(tmpdir(), 'site-root-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    mkdirSync(join(root, dirname(SITE_ROOT_ALLOWLIST_FILE)), { recursive: true });
    copyFileSync(join(import.meta.dirname, 'site-root-allowlist.json'), join(root, SITE_ROOT_ALLOWLIST_FILE));
    const put = (path: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), '{}\n'); };
    const listed = JSON.parse(readFileSync(join(import.meta.dirname, 'site-root-allowlist.json'), 'utf8')) as string[];
    for (const path of [...listed, 'site/world/zoom.mts']) put(path);
    const findings = () => repositoryFindings(root, repositoryFiles(root), [rule]);
    assert.equal(isBroken(findings()), false, 'the allowlisted root plus files in folders is clean');
    put('site/new-loose.mts');
    assert.equal(isBroken(findings()), true, 'a new loose file fails');
    assert.match([...findings().values()].flat().join('\n'), /site\/new-loose\.mts: site\/ holds only/u);
    rmSync(join(root, 'site/new-loose.mts'));
    assert.equal(isBroken(findings()), false, 'removing it clears the finding');
    rmSync(join(root, 'site/env.d.ts'));
    assert.match([...findings().values()].flat().join('\n'), /site\/env\.d\.ts: listed in .* but absent/u, 'a stale entry fails too');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the tracked site/ root holds exactly the allowlist', () => {
  const files = execFileSync('git', ['ls-files', 'site'], { cwd: join(import.meta.dirname, '../../..'), encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(checkSiteRootAllowlist(join(import.meta.dirname, '../../..'), files), []);
});
