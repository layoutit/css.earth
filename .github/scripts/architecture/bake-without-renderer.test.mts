import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { bakeRendererFindings } from './bake-without-renderer.mts';
import { checkDeclaredDependencies } from './declared-dependencies.mts';
import { isBroken, repositoryFindings, REPOSITORY_RULES } from './repository-rules.mts';

const manifest = { name: '@cssearth/bake' };
test('bake allows no dependency field or named renderer exception', () => {
  assert.deepEqual(bakeRendererFindings(manifest, []), []);
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])
    assert.match(bakeRendererFindings({ ...manifest, [field]: { '@cssearth/renderer': 'workspace:*' } }, [])[0]!, /must not declare/u);
  assert.match(bakeRendererFindings(manifest, [{ path: 'packages/bake/src/probe.ts', reason: 'Publication' }])[0]!, /no renderer exception/u);
});

test('an undeclared bake import fails the existing declaration rule, without a new import parser', () => {
  const root = mkdtempSync(join(tmpdir(), 'bake-declaration-'));
  const path = 'packages/bake/src/probe.ts';
  const files = ['packages/bake/package.json', 'packages/renderer/package.json', path];
  const write = (path: string, text: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  try {
    write(files[0]!, JSON.stringify(manifest));
    write(files[1]!, JSON.stringify({ name: '@cssearth/renderer' }));
    write(path, 'export {};');
    const rule = REPOSITORY_RULES.find(rule => rule.id === 'declared-dependencies');
    assert.ok(rule);
    assert.equal(isBroken(repositoryFindings(root, files, [rule])), false);
    for (const source of ["import '@cssearth/renderer';", "require.resolve('@cssearth/renderer/navigation');"]) {
      write(path, source);
      assert.match(checkDeclaredDependencies(root, files)[0]!, /does not declare/u);
      assert.equal(isBroken(repositoryFindings(root, files, [rule])), true);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
