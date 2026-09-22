import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('saturn');
import { readFile } from "node:fs/promises";
import {createHash} from 'node:crypto';
import {prepareLayeredLeafLayouts} from '../../../../tools/objects/material-composition/leaf-layouts.mts';
import {readPreparedFixture} from '../../fixtures.mts';
const [scene, PREPARED_SATURN_LEAF_LAYOUTS] = await Promise.all([readPreparedFixture('saturn','scene'),readPreparedFixture('saturn','layouts')]);
const stylesheet = await readFile(new URL('../../../../src/renderers/css/styles/saturn-surfaces.css',import.meta.url),'utf8');
const config=JSON.parse(await readFile(new URL('../../../../src/objects/saturn/source/preparation/presentation.json',import.meta.url),'utf8'));
test("missing interior leaf layouts reproduce from checked scene and stylesheet bytes", async () => {
  const generated = prepareLayeredLeafLayouts({scene,stylesheet,config});
  assert.deepEqual(generated, PREPARED_SATURN_LEAF_LAYOUTS);
  assert.equal(JSON.stringify(generated),JSON.stringify(PREPARED_SATURN_LEAF_LAYOUTS));
  assert.equal(scene.interior.shells.flatMap(shell=>shell.leaves).filter(leaf=>!leaf.className?.includes('saturn-interior-pole')).length,162);
});
test("changing checked defaults changes the descriptor; no runtime stylesheet inspection supplies missing values", () => {
  const modified = stylesheet.replace("--polycss-atlas-width, 64px", "--polycss-atlas-width, 80px");
  assert.throws(()=>prepareLayeredLeafLayouts({scene,stylesheet:modified,config}),/pin changed/);
  const generated = prepareLayeredLeafLayouts({scene,stylesheet:modified,config:{...config,stylesheet:{...config.stylesheet,bytes:Buffer.byteLength(modified),sha256:createHash('sha256').update(modified).digest('hex')}}});
  assert.ok(Object.values(generated.classes).every(layout => layout.width === "80px"));
  assert.notEqual(generated.sources[config.stylesheet.path], PREPARED_SATURN_LEAF_LAYOUTS.sources[config.stylesheet.path]);
});
