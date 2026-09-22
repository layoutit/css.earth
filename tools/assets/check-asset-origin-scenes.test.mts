import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { findSceneReferences } from './check-asset-origin-scenes.mts';

async function withDistDir(files: Record<string, string>, run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'asset-origin-scenes-'));
  try {
    for (const [path, content] of Object.entries(files)) {
      const full = join(dir, path);
      await mkdir(join(full, '..'), { recursive: true });
      await writeFile(full, content, 'utf8');
    }
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('reports no references for a build with none', async () => {
  await withDistDir({ 'index.html': '<img src="https://earth-assets.lowpoly.cc/runtime-assets/aa/x.webp">',
    'saturn/index.html': '<style>.a{background-image:url("https://earth-assets.lowpoly.cc/runtime-assets/bb/y.webp")}</style>' },
  async dir => assert.deepEqual(await findSceneReferences(dir), []));
});

test('finds a /scenes/ reference left in HTML, with its line and path', async () => {
  await withDistDir({ 'saturn/index.html': 'one\n<img src="/scenes/saturn/saturn-surface@2x.webp">\nthree' }, async dir => {
    const found = await findSceneReferences(dir);
    assert.equal(found.length, 1);
    assert.equal(found[0]!.path, 'saturn/index.html');
    assert.equal(found[0]!.line, 2);
    assert.match(found[0]!.text, /\/scenes\/saturn\//u);
  });
});

test('finds a /scenes/ reference left in inlined CSS', async () => {
  await withDistDir({ 'index.html': '<style>.a{background-image:url("/scenes/jupiter/jupiter-surface@2x.webp")}</style>' }, async dir => {
    const found = await findSceneReferences(dir);
    assert.equal(found.length, 1);
    assert.equal(found[0]!.path, 'index.html');
  });
});

test('ignores non-HTML/CSS files even if they mention /scenes/', async () => {
  await withDistDir({ 'objects/saturn/deadbeef.json': '{"note":"/scenes/saturn/x.webp"}' },
    async dir => assert.deepEqual(await findSceneReferences(dir), []));
});
