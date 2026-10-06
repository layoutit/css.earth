/** Preserve preexisting production maps instead of hiding them as comparison extras. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {comparisonMapSetting} from './metadata.mts';
test('production source maps remain production comparison inputs',()=>{
 for(const value of [true,'hidden','inline'] as const) {
  assert.equal(comparisonMapSetting('client',value),undefined);
  assert.equal(comparisonMapSetting('worker',value,true),undefined);
 }
 assert.deepEqual(comparisonMapSetting('client',false),{build:{sourcemap:'hidden'}});
 assert.deepEqual(comparisonMapSetting('worker',undefined,true),{build:{sourcemap:'hidden'}});
 assert.equal(comparisonMapSetting('prerender',false),undefined);
});
