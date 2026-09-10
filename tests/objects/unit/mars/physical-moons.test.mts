import assert from 'node:assert/strict';
import test from 'node:test';
import {runtimeDefinition,PREPARED_MARS_PANEL} from './prepared-fixture.mts';
test('retains the two physical satellites without dormant satellite rendering',async()=>{
 assert.equal(PREPARED_MARS_PANEL.facts.find(f=>f.id==='moon-count').value,'2');
 assert.ok(runtimeDefinition.tree.nodes.every(n=>!n.className?.includes('mars-moon')));
 assert.ok(runtimeDefinition.assets.entries.every(e=>!e.url.includes('moon-billboards')));
});
