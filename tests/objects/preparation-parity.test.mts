import {required} from '../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { readPreparedFixture, projectRoot } from './fixtures.mts';

for (const id of ['mercury', 'venus']) {
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
