import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {densityPreviewAllowed,reconstructionProcessingCapability} from './reconstruction-capabilities.ts';
test('finite emission and unknown saved methods cannot invoke density repaint',()=>{
 for(const method of ['simulation-guided-finite-emission@1','fixed-density-finite-region-material@1',undefined,'future-method']) {
  const capability=reconstructionProcessingCapability(method);
  assert.equal(densityPreviewAllowed(capability),false);assert.match(capability.reason!,/offline recipe/);
 }
 assert.equal(densityPreviewAllowed(undefined),false);
 assert.equal(densityPreviewAllowed(reconstructionProcessingCapability('alignment-density-material-v1')),true);
});
test('saved-result processing and resumed jobs guard the actual callbacks',()=>{
 const source=readFileSync('labs/nebula/packages/lab/src/features/reconstruction/reconstruction-controls-react.tsx','utf8');
 assert.match(source,/actions\.current\.process = \(\) => \{\s*if \(!previewAllowed\(\)\)/);
 assert.match(source,/saved && active\(saved\) && selectedPreviewAllowed\(catalogue, row\)\)/);
 assert.match(source,/actions\.current\.appearance = value => \{\s*if \(!previewAllowed\(\)/);
});
