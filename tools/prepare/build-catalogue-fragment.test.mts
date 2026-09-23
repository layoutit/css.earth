import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { buildCatalogueFragment } from './build-catalogue-fragment.mts';

const FRAGMENT_HTML = '<ul class="object-list"><li class="object-item">Saturn</li></ul>';
const PAGE_HTML = (id: string) => `<!doctype html><html><body data-object-shell="${id}">
  <div id="object-category-results" data-catalogue-src="/catalogue/__CATALOGUE_FRAGMENT_SHA__.html"
    data-catalogue-sha256="__CATALOGUE_FRAGMENT_SHA__" data-catalogue-bytes="__CATALOGUE_FRAGMENT_BYTES__">
    <ul class="object-list" data-catalogue-list></ul>
  </div>
</body></html>`;

async function withDist(build: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'catalogue-fragment-'));
  try { await build(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('buildCatalogueFragment republishes the fragment by hash and rewires every page', async () => {
  await withDist(async dist => {
    await mkdir(join(dist, 'catalogue-fragment'), { recursive: true });
    await writeFile(join(dist, 'catalogue-fragment', 'index.html'), FRAGMENT_HTML);
    await mkdir(join(dist, 'saturn'), { recursive: true });
    await writeFile(join(dist, 'saturn', 'index.html'), PAGE_HTML('saturn'));
    await mkdir(join(dist, 'sun'), { recursive: true });
    await writeFile(join(dist, 'sun', 'index.html'), PAGE_HTML('sun'));
    // A navigation fragment never carries the token; it must survive untouched.
    await mkdir(join(dist, 'navigation', 'saturn'), { recursive: true });
    await writeFile(join(dist, 'navigation', 'saturn', 'index.html'), '<p>no catalogue here</p>');

    const expectedSha = createHash('sha256').update(FRAGMENT_HTML).digest('hex');
    const result = await buildCatalogueFragment(dist);

    assert.equal(result.sha256, expectedSha);
    assert.equal(result.bytes, Buffer.byteLength(FRAGMENT_HTML));
    assert.equal(result.url, `/catalogue/${expectedSha}.html`);
    assert.equal(result.pagesRewritten, 2);

    // The fragment now lives at its content-addressed path, and the generic build target is gone.
    assert.equal(await readFile(join(dist, 'catalogue', `${expectedSha}.html`), 'utf8'), FRAGMENT_HTML);
    await assert.rejects(stat(join(dist, 'catalogue-fragment')));

    for (const id of ['saturn', 'sun']) {
      const html = await readFile(join(dist, id, 'index.html'), 'utf8');
      assert.ok(!html.includes('__CATALOGUE_FRAGMENT_SHA__'), `${id} still carries the sha token`);
      assert.ok(!html.includes('__CATALOGUE_FRAGMENT_BYTES__'), `${id} still carries the bytes token`);
      assert.ok(html.includes(`data-catalogue-src="/catalogue/${expectedSha}.html"`));
      assert.ok(html.includes(`data-catalogue-sha256="${expectedSha}"`));
      assert.ok(html.includes(`data-catalogue-bytes="${Buffer.byteLength(FRAGMENT_HTML)}"`));
      // Object pages ship the placeholder list empty; the rows only exist once, in dist/catalogue.
      assert.ok(html.includes('<ul class="object-list" data-catalogue-list></ul>'));
      assert.ok(!html.includes('object-item'));
    }
    const navigation = await readFile(join(dist, 'navigation', 'saturn', 'index.html'), 'utf8');
    assert.equal(navigation, '<p>no catalogue here</p>');
  });
});

test('buildCatalogueFragment fails loudly when the build target or every page reference is missing', async () => {
  await withDist(async dist => {
    await mkdir(dist, { recursive: true });
    await assert.rejects(buildCatalogueFragment(dist), /Catalogue fragment build target is missing/u);
    await mkdir(join(dist, 'catalogue-fragment'), { recursive: true });
    await writeFile(join(dist, 'catalogue-fragment', 'index.html'), FRAGMENT_HTML);
    await mkdir(join(dist, 'saturn'), { recursive: true });
    await writeFile(join(dist, 'saturn', 'index.html'), '<p>no token here</p>');
    await assert.rejects(buildCatalogueFragment(dist), /No page referenced the catalogue fragment token/u);
  });
});

test('the CLI entry point runs even when invoked from a path containing spaces', async () => {
  await withDist(async dist => {
    await mkdir(join(dist, 'catalogue-fragment'), { recursive: true });
    await writeFile(join(dist, 'catalogue-fragment', 'index.html'), FRAGMENT_HTML);
    await mkdir(join(dist, 'saturn'), { recursive: true });
    await writeFile(join(dist, 'saturn', 'index.html'), PAGE_HTML('saturn'));

    // A naive `file://${process.argv[1]}` comparison never percent-encodes
    // the space, so it never equals `import.meta.url` and the script quietly
    // does nothing. Running the real file from a spaced directory reproduces
    // that failure mode end to end.
    const scriptDir = await mkdtemp(join(tmpdir(), 'catalogue fragment tool '));
    try {
      const scriptPath = join(scriptDir, 'build-catalogue-fragment.mts');
      await writeFile(scriptPath, await readFile(new URL('./build-catalogue-fragment.mts', import.meta.url)));
      const result = spawnSync(process.execPath, [scriptPath, dist], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const expectedSha = createHash('sha256').update(FRAGMENT_HTML).digest('hex');
      assert.match(result.stdout, new RegExp(`^Catalogue fragment: /catalogue/${expectedSha}\\.html`, 'u'));
      assert.equal(await readFile(join(dist, 'catalogue', `${expectedSha}.html`), 'utf8'), FRAGMENT_HTML);
    } finally { await rm(scriptDir, { recursive: true, force: true }); }
  });
});
