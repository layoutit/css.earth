import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {runtimeDefinition,PREPARED_MARS_PANEL} from './prepared-fixture.mjs';
test('retains the two physical satellites without dormant satellite rendering',async()=>{
 const sourceRoot=new URL('../../../../src/planets/mars/source/',import.meta.url);
 const physical=await readFile(new URL('moons/jpl-physical-parameters.html',sourceRoot),'utf8');
 const elements=await readFile(new URL('moons/jpl-mean-elements.html',sourceRoot),'utf8');
 for(const name of ['Phobos','Deimos']){assert.ok(physical.includes(name));assert.ok(elements.includes(name));}
 assert.equal(PREPARED_MARS_PANEL.facts.find(f=>f.id==='moon-count').value,'2');
 assert.ok(runtimeDefinition.tree.nodes.every(n=>!n.className?.includes('mars-moon')));
 assert.ok(runtimeDefinition.assets.entries.every(e=>!e.url.includes('moon-billboards')));
});
