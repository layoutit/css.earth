/** Copy validation is portable and refuses originals, drift, escapes and shared source inodes. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, writeFile, rm, symlink, link } from 'node:fs/promises';
import { resolve } from 'node:path';
import { apply } from './apply.mts';
test('only an unshared source in a named sibling can be patched', async () => {
  await mkdir('output/journeys', { recursive: true });
  const root = await mkdtemp(resolve('output/journeys/apply-'));
  const cwd = process.cwd(), source = resolve(root, 'checkout'), copy = source + '-proof';
  const file = resolve(copy, 'site/scene/scene-publication.mts');
  try {
    await mkdir(source); await mkdir(resolve(copy, 'site/scene'), { recursive: true });
    const original = '    const root = documentTarget.documentElement;';
    await writeFile(file, original); process.chdir(source);
    await assert.rejects(apply(source, 'changed-transform'), /named throwaway sibling/u);
    await apply(copy, 'changed-transform', true); assert.equal(await readFile(file, 'utf8'), original);
    await apply(copy, 'changed-transform'); assert.match(await readFile(file, 'utf8'), /translateX/u);
    await assert.rejects(apply(copy, 'changed-transform'), /source drift/u);
    await rm(file); const external = resolve(source, 'external.mts'); await writeFile(external, original);
    await symlink(external, file); await assert.rejects(apply(copy, 'changed-transform'), /symlink escapes/u);
    await rm(file); await link(external, file); await assert.rejects(apply(copy, 'changed-transform'), /unshared/u);
  } finally { process.chdir(cwd); await rm(root, { recursive: true, force: true }); }
});
