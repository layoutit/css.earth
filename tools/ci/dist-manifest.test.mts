import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { buildDistManifest, diffDistManifests } from './dist-manifest.mts';

async function withDistDir(files: Record<string, string>, run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'dist-manifest-'));
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

test('buildDistManifest records every file by its relative, slash-separated path', async () => {
  await withDistDir({ 'index.html': '<html></html>', 'saturn/index.html': '<html>saturn</html>' }, async dir => {
    const manifest = await buildDistManifest(dir);
    assert.deepEqual(Object.keys(manifest).sort(), ['index.html', 'saturn/index.html']);
    assert.equal(manifest['index.html']!.bytes, Buffer.byteLength('<html></html>'));
    assert.match(manifest['index.html']!.sha256, /^[0-9a-f]{64}$/u);
  });
});

test('diffDistManifests reports zero difference for two builds of the same tree', async () => {
  await withDistDir({ 'index.html': 'same', 'a/b.txt': 'same' }, async dir => {
    const before = await buildDistManifest(dir), after = await buildDistManifest(dir);
    assert.deepEqual(diffDistManifests(before, after), { added: [], removed: [], changed: [] });
  });
});

// Mutation check: every one of added/removed/changed must actually detect its own case,
// not just report an empty diff by coincidence of shared code paths.
test('diffDistManifests detects an added, a removed and a changed file independently', async () => {
  const before = { 'keep.html': { bytes: 4, sha256: 'a'.repeat(64) }, 'gone.html': { bytes: 4, sha256: 'b'.repeat(64) },
    'edited.html': { bytes: 4, sha256: 'c'.repeat(64) } };
  const after = { 'keep.html': { bytes: 4, sha256: 'a'.repeat(64) }, 'new.html': { bytes: 4, sha256: 'd'.repeat(64) },
    'edited.html': { bytes: 5, sha256: 'e'.repeat(64) } };
  const diff = diffDistManifests(before, after);
  assert.deepEqual(diff.added, ['new.html']);
  assert.deepEqual(diff.removed, ['gone.html']);
  assert.deepEqual(diff.changed, [{ path: 'edited.html', before: before['edited.html'], after: after['edited.html'] }]);
});
