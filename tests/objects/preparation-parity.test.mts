import {shape,array,text,number} from '../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../tools/test-values.mts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { readPreparedFixture, projectRoot } from './fixtures.mts';
const parseAssets=shape({assets:array(shape({filename:text,bytes:number,sha256:text}))});

for (const id of ['mercury', 'venus']) {
  test(`${id} retains every accepted image and chart byte`, async () => {
    const baseline = parseAssets(JSON.parse(await readFile(new URL(`./compatibility/${id}-assets.json`, import.meta.url), 'utf8')));
    const manifest = parseAssets(JSON.parse(await readFile(resolve(projectRoot, 'src/objects', id, 'inventory.json'), 'utf8')));
    const acceptedNames=new Set(baseline.assets.filter(asset=>!/-system-markers(?:@2x)?\.webp$/.test(asset.filename)).map(asset=>asset.filename));
    assert.deepEqual(manifest.assets.filter(asset=>acceptedNames.has(asset.filename)).toSorted((a, b) => a.filename.localeCompare(b.filename)),
      baseline.assets.filter(asset=>acceptedNames.has(asset.filename)).toSorted((a, b) => a.filename.localeCompare(b.filename)));
    const directory = process.env.OBJECT_PUBLIC_ROOT ? resolve(process.env.OBJECT_PUBLIC_ROOT, id) : resolve(projectRoot, 'public/scenes', id);
    for (const asset of baseline.assets.filter(asset=>acceptedNames.has(asset.filename))) {
      const bytes = await readFile(resolve(directory, asset.filename));
      assert.equal(bytes.length, asset.bytes, asset.filename);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.filename);
    }
  });
  test(`${id} is authored entirely as data and uses the shared prepared runtime`, async () => {
    const directory = resolve(projectRoot, 'src/objects', id);
    const visit = async (path: string):Promise<void> => {
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
  });
}

for (const id of ['mercury', 'saturn']) {
  test(`${id} downloads its cutaway on selection and then makes it visible`, async () => {
    const runtime = await readPreparedFixture(id, 'runtime');
    const target = runtime.tree.nodes.findIndex(n => n.className === `polycss-mesh ${id}-cutaway`);
    assert.ok(target >= 0);
    assert.ok(runtime.tree.nodes[target].properties.some((i:number) => runtime.tree.properties[i].name === 'display' && runtime.tree.properties[i].value === 'none'));
    assert.ok(runtime.assets.startup.every((key: string) => !key.startsWith('interior:')));
    for (const variant of runtime.variants) {
      const interior = variant.writes.some(w => "value" in w && w.name === 'data-view' && w.value === 'interior');
      const write=required(variant.writes.find(w => w.target === target && w.name === 'display'));assert.ok('value' in write);
      assert.equal(write.value,interior?'block':'none');
    }
  });
}
