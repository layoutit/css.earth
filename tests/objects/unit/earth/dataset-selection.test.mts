import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeDefinition as runtime } from './prepared-fixture.mts';
import { initialObjectSelection, resolvePreparedPresentation } from '../../../../src/renderers/css/dist/testing.js';

test('manual Earth datasets reuse one surface and require only their selected image bank', () => {
  const clear = required(runtime.variants.find(v => v.when.lensId === 'normal'));
  const clouds = required(runtime.variants.find(v => v.when.lensId === 'clouds'));
  const cloudKeys = clouds.required.filter(key => key.startsWith('page:clouds:'));
  assert.equal(cloudKeys.length, 7);
  for (const level of required(runtime.textureLevels).levels) {
    const view = { sceneMatrix: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)", sunViewDirection: required(required(runtime.sun).referenceViewDirection),
      levelOfDetail: { stage: "geometry", silhouetteDiameter: level.minimumDiameter, billboardOpacity: 0, markerOpacity: 0 } };
    const plan = resolvePreparedPresentation(runtime, { selection: { ...initialObjectSelection(runtime.controls), lensId: 'clouds' }, view });
    const selectedPages = plan.required.filter(key => required(runtime.assets.entries.find(entry => entry.key === key)).pool === 'pages');
    assert.deepEqual(selectedPages, cloudKeys.map(key => level.resources[key]));
    assert.ok(selectedPages.every(key => !runtime.assets.startup.includes(key)));
  }
  assert.ok(!clouds.required.some(key => key.startsWith('page:normal:')));
  assert.equal(required(runtime.controls.lenses).zoomSelection, undefined);
  assert.ok(!runtime.tree.nodes.some(node => node.className?.includes('polycss-dataset-overlay')));
  const pageTargets = (variant: (typeof runtime.variants)[number]) => variant.writes.filter(w => w.kind === 'texture' && w.name.startsWith('--earth-surface-page-') && w.resource).map(w => w.target);
  assert.deepEqual(pageTargets(clear), pageTargets(clouds));
});
