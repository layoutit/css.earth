import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { publicRoot } from './public-root.mts';

test('each checkout is read in its own layout', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'public-root-'));
  try {
    await mkdir(resolve(root, 'public/scenes'), { recursive: true });
    assert.equal(publicRoot(root), 'public');
    await mkdir(resolve(root, 'site/public/scenes'), { recursive: true });
    assert.equal(publicRoot(root), 'site/public', 'the moved directory wins over a leftover root copy');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('recorded deployment paths compare across the public directory move, and other paths stay exact', async () => {
  const { compare } = await import('./diff.mts');
  const { writeFile } = await import('node:fs/promises');
  const root = await mkdtemp(resolve(tmpdir(), 'public-layout-'));
  const recording = async (name: string, prefix: string, found = 'index.json') => {
    const directory = resolve(root, name); await mkdir(directory);
    await writeFile(resolve(directory, 'index.json'), JSON.stringify({ requests: [], config: { included: [`${prefix}features/index.json`] } }));
    await writeFile(resolve(directory, 'closure.json'), JSON.stringify({ included: ['dist/catalogue/index.json', `${prefix}features/index.json`, `!${prefix}scenes/private.json`],
      functions: { find: [`${prefix}features/${found}`] }, unrelated: 'src/public/x' }));
    return directory;
  };
  try {
    const base = await recording('base', 'public/'), head = await recording('head', 'site/public/');
    assert.deepEqual(await compare(base, head), []);
    assert.deepEqual((await compare(base, await recording('other', 'site/public/', 'other.json'))).map(difference => difference.dimension), ['functions.find'],
      'a different file is still a difference');
    const nested = await recording('nested', 'site/public/');
    await writeFile(resolve(nested, 'closure.json'), JSON.stringify({ included: ['dist/catalogue/index.json', 'site/public/features/index.json', '!site/public/scenes/private.json'],
      functions: { find: ['site/public/features/index.json'] }, unrelated: 'src/site/public/x' }));
    assert.deepEqual((await compare(base, nested)).map(difference => difference.dimension), ['unrelated'], 'only a leading public directory is neutral');
  } finally { await rm(root, { recursive: true, force: true }); }
});
