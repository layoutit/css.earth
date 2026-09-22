import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { buildNormalizedDistManifest, normalizeViteHashes } from './normalized-dist-manifest.mts';

async function withDistDir(files: Record<string, string>, run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'normalized-dist-manifest-'));
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

test('normalizeViteHashes erases only the volatile chunk-hash segment', () => {
  assert.equal(normalizeViteHashes('<script src="/_astro/scene-router.N8TeGTmE.js">'),
    '<script src="/_astro/scene-router.HASH.js">');
  assert.equal(normalizeViteHashes('background:url(/_astro/sprite.AbC123xy.css)'),
    'background:url(/_astro/sprite.HASH.css)');
  assert.equal(normalizeViteHashes('/scenes/saturn/saturn-surface@2x.webp'), '/scenes/saturn/saturn-surface@2x.webp');
});

// Mutation check for the case this tool exists to solve: two builds of identical source can still
// legitimately rename a handful of shared Vite/Rollup chunks (observed live: 5 entry chunks
// rehashed between two consecutive builds of the same tree). A raw buildDistManifest would report
// every page referencing them as "changed"; the normalized manifest must not.
test('two builds that only differ by a renamed shared chunk normalize to the same manifest', async () => {
  const before = {
    '_astro/scene-router.N8TeGTmE.js': 'console.log(1)',
    'saturn/index.html': '<script src="/_astro/scene-router.N8TeGTmE.js"></script>',
  };
  const after = {
    '_astro/scene-router.Zx9Qp2Lm.js': 'console.log(1)',
    'saturn/index.html': '<script src="/_astro/scene-router.Zx9Qp2Lm.js"></script>',
  };
  await withDistDir(before, async beforeDir => {
    await withDistDir(after, async afterDir => {
      const manifestBefore = await buildNormalizedDistManifest(beforeDir);
      const manifestAfter = await buildNormalizedDistManifest(afterDir);
      assert.deepEqual(Object.keys(manifestBefore).sort(), Object.keys(manifestAfter).sort());
      for (const key of Object.keys(manifestBefore)) assert.equal(manifestBefore[key]!.sha256, manifestAfter[key]!.sha256, key);
    });
  });
});

// The same mutation check in reverse: a real content change (not just a renamed chunk) must
// still be caught, so normalization cannot be papering over every difference.
test('a real content change is still detected after normalization', async () => {
  await withDistDir({ 'saturn/index.html': '<script src="/_astro/scene-router.N8TeGTmE.js"></script><p>A</p>' }, async beforeDir => {
    await withDistDir({ 'saturn/index.html': '<script src="/_astro/scene-router.Zx9Qp2Lm.js"></script><p>B</p>' }, async afterDir => {
      const manifestBefore = await buildNormalizedDistManifest(beforeDir);
      const manifestAfter = await buildNormalizedDistManifest(afterDir);
      assert.notEqual(manifestBefore['saturn/index.html']!.sha256, manifestAfter['saturn/index.html']!.sha256);
    });
  });
});
