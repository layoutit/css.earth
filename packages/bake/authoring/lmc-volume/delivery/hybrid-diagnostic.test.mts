import assert from 'node:assert/strict';
import test from 'node:test';
import {ROOT,json,rec} from '../inputs.mts';
import {qualifySlabViews} from './slab-qualification.mts';

test('the preserved hybrid result cannot be promoted by hiding a failed browser camera',async()=>{
 const value=rec(await json(ROOT+'src/objects/lmc-volume/source/preparation/l36/hybrid-diagnostic.json'));
 assert.equal(value.promoted,false);assert.equal(value.physicalModelParametersChanged,0);
 assert.equal(value.physicalSlabs,26);assert.equal(value.secondOpticalLayers,7);assert.equal(value.opticalLayers,33);
 const browser=rec(value.realCssRenderer);assert.equal(browser.retained,true);
 assert.deepEqual(qualifySlabViews(browser.rows),{passed:false,cameras:21});
 assert.deepEqual(qualifySlabViews(rec(value.decodedPixels).rows),{passed:false,cameras:21});
});
