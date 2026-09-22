import assert from 'node:assert/strict';import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();import { familiesForProductKind,mapIvoaProductType } from './product-type.mts';
test('IVOA product terms retain their source term, mapping version and preliminary status',()=>{
  assert.deepEqual(mapIvoaProductType('dynamic-spectrum'),{sourceTerm:'dynamic-spectrum',vocabulary:'http://www.ivoa.net/rdf/product-type/2026-01-15',vocabularyVersion:'2026-01-15',status:'mapped',families:['F07']});
  assert.equal(mapIvoaProductType('event-bundle')?.status,'preliminary');assert.deepEqual(familiesForProductKind('visibility'),['F11']);
  assert.deepEqual(mapIvoaProductType('future-type'),{sourceTerm:'future-type',vocabulary:'http://www.ivoa.net/rdf/product-type/2026-01-15',vocabularyVersion:'2026-01-15',status:'unmapped',families:[]});
});
