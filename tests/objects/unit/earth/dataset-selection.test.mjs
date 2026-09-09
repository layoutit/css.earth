import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeDefinition as runtime } from './prepared-fixture.mjs';
import { initialObjectSelection, resolvePreparedPresentation } from '../../../../src/renderers/css/dist/testing.js';

test('manual Earth datasets reuse one surface and require only their selected image bank', () => {
  const clear = runtime.variants.find(v => v.when.lensId === 'normal');
  const clouds = runtime.variants.find(v => v.when.lensId === 'clouds');
  const cloudKeys = clouds.required.filter(key => key.startsWith('page:clouds:'));
  assert.equal(cloudKeys.length, 7);
  for (const level of runtime.textureLevels.levels) {
    const view = { sunViewDirection: runtime.sun.referenceViewDirection,
      levelOfDetail: { silhouetteDiameter: level.minimumDiameter } };
    const plan = resolvePreparedPresentation(runtime, { selection: { ...initialObjectSelection(runtime.controls), lensId: 'clouds' }, view });
    const selectedPages = plan.required.filter(key => runtime.assets.entries.find(entry => entry.key === key).pool === 'pages');
    assert.deepEqual(selectedPages, cloudKeys.map(key => level.resources[key]));
    assert.ok(selectedPages.every(key => !runtime.assets.startup.includes(key)));
  }
  assert.ok(!clouds.required.some(key => key.startsWith('page:normal:')));
  assert.equal(runtime.controls.lenses.zoomSelection, undefined);
  assert.ok(!runtime.tree.nodes.some(node => node.className?.includes('polycss-dataset-overlay')));
  const pageTargets = variant => variant.writes.filter(w => w.kind === 'texture' && w.name.startsWith('--earth-surface-page-') && w.resource).map(w => w.target);
  assert.deepEqual(pageTargets(clear), pageTargets(clouds));
});
