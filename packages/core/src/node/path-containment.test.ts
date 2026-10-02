import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { it } from 'node:test';
import { containedPath } from './path-containment.js';

it('lexical and realpath policies distinguish symlinks, root identity, traversal and sibling prefixes', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'containment-')));
  try {
    const root = join(directory, 'b'), sibling = join(directory, 'bc'), file = join(root, 'file');
    await mkdir(root); await mkdir(sibling); await writeFile(file, 'inside');
    const outside = join(sibling, 'file'); await writeFile(outside, 'outside');
    const link = join(root, 'escape'); await symlink(outside, link);
    const insideLink = join(root, 'inside'); await symlink(file, insideLink);
    const lexical = { policy: 'lexical' as const, rootPath: 'reject' as const, parentSeparator: 'posix' as const, absoluteOffset: 'allow' as const };
    const real = { policy: 'realpath' as const, rootPath: 'allow' as const, parentSeparator: 'posix' as const, absoluteOffset: 'reject' as const };
    assert.equal(containedPath(root, file, lexical), file);
    assert.equal(containedPath(root, link, lexical), link);
    assert.equal(await containedPath(root, link, real), undefined);
    assert.equal(await containedPath(root, insideLink, real), file);
    for (const path of [resolve(root, '..'), outside, resolve(root, '../bc/file')]) {
      assert.equal(containedPath(root, path, lexical), undefined);
      assert.equal(await containedPath(root, path, real), undefined);
    }
    assert.equal(containedPath(root, root, lexical), undefined);
    assert.equal(containedPath(root, root, { ...lexical, rootPath: 'allow' }), root);
    assert.equal(await containedPath(root, root, real), root);
    assert.equal(await containedPath(root, root, { ...real, rootPath: 'reject' }), undefined);
    assert.equal(containedPath(root, outside, { ...lexical, parentSeparator: 'native', absoluteOffset: 'reject' }), undefined);
    await assert.rejects(containedPath(root, join(root, 'missing'), real), { code: 'ENOENT' });
    await assert.rejects(containedPath(join(directory, 'missing-root'), file, real), { code: 'ENOENT' });
    const linkedRoot = join(directory, 'linked-root'); await symlink(root, linkedRoot);
    assert.equal(await containedPath(linkedRoot, join(linkedRoot, 'file'), real), file);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
