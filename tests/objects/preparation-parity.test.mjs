import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { readPreparedFixture, projectRoot } from './fixtures.mjs';

for (const id of ['mercury', 'venus']) {
  test(`${id} retains every accepted image and chart byte`, async () => {
    const baseline = JSON.parse(await readFile(new URL(`./compatibility/${id}-assets.json`, import.meta.url), 'utf8'));
    const manifest = JSON.parse(await readFile(resolve(projectRoot, 'src/planets', id, 'runtime-assets.json'), 'utf8'));
    assert.deepEqual(manifest.assets.toSorted((a, b) => a.filename.localeCompare(b.filename)),
      baseline.assets.toSorted((a, b) => a.filename.localeCompare(b.filename)));
    const directory = process.env.OBJECT_PUBLIC_ROOT ? resolve(process.env.OBJECT_PUBLIC_ROOT, id) : resolve(projectRoot, 'public/scenes', id);
    for (const asset of baseline.assets) {
      const bytes = await readFile(resolve(directory, asset.filename));
      assert.equal(bytes.length, asset.bytes, asset.filename);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.filename);
    }
  });
  test(`${id} is authored entirely as data and uses the shared prepared runtime`, async () => {
    const directory = resolve(projectRoot, 'src/planets', id);
    const visit = async path => {
      for (const entry of await readdir(path, {withFileTypes: true})) {
        if (entry.name.startsWith('.')) continue;
        const child = resolve(path, entry.name);
        if (entry.isDirectory()) await visit(child);
        else assert.ok(!/\.(?:m?js|cjs|tsx?|astro|css)$/.test(entry.name), `Executable object customization: ${child}`);
      }
    };
    await visit(directory);
    const runtime = await readPreparedFixture(id, 'runtime');
    const controls = await readPreparedFixture(id, 'controls');
    assert.deepEqual(runtime.controls, controls);
    assert.equal(runtime.schema, 'cssearth-object-runtime@4');
    assert.equal(runtime.id, id);
    assert.ok(runtime.tree.nodes.length > 100);
    assert.ok(runtime.heliocentricView);
  });
}
