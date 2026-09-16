import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CameraModelPanel, type CameraModelPanelProps } from './camera-model-panel';

const render = (props: CameraModelPanelProps) => renderToStaticMarkup(createElement(CameraModelPanel, props));
test('all camera capabilities use the same ordered controls and Model owner without pose presets', () => {
  for (const camera of [{}, { reset: { onActivate() {} } }, { earth: { onActivate() {} }, orbit: { onActivate() {} } }, { fit: { onActivate() {} } }]) {
    const markup = render({ camera });
    assert.deepEqual([...markup.matchAll(/data-camera-action="([^"]+)"/g)].map(match => match[1]), ['earth', 'orbit', 'fit', 'reset']);
    assert.equal([...markup.matchAll(/<button\b/g)].length, 4);
    assert.equal([...markup.matchAll(/<legend>Model<\/legend>/g)].length, 1);
    assert.doesNotMatch(markup, /<legend[^>]*>Camera|<select|Front|Degrees/);
  }
});
test('fixed models explain missing capabilities while preserving supplied model controls', () => {
  const fixed = render({ camera: { earth: 'No prepared observer.', reset: { onActivate() {} } }, modelReason: 'Fixed prepared density.' });
  assert.match(fixed, /data-camera-action="earth"[^>]*aria-disabled="true"/);
  assert.match(fixed, /No prepared observer\./);
  assert.match(fixed, /data-camera-action="reset"[^>]*aria-disabled="false"/);
  assert.match(fixed, /Fixed prepared density\./);
  const modeled = render({ children: createElement('input', { id: 'actual-model-control', type: 'range', defaultValue: '0.7' }) });
  assert.match(modeled, /id="actual-model-control"/);
  assert.doesNotMatch(modeled, /no editable parameters/);
});
test('legacy and method-specific panels all use the shared camera and Model owner', async () => {
  for (const path of ['ui/camera-panel', 'features/compiler/compiler-panel', 'features/shape-cloud/shape-cloud-workbench',
    'features/joint-fit/joint-fit-panel', 'features/evidence/evidence-fusion', 'features/kinematics/kinematics-panel',
    'features/observations/observation-alignment', 'features/observations/observation-structures', 'features/observations/emission-comparison']) {
    const source = await readFile(`labs/nebula/packages/lab/src/${path}.tsx`, 'utf8');
    assert.match(source, /<CameraModelPanel\b/, path);
    assert.doesNotMatch(source, /<CameraActions\b|<legend>Model<\/legend>/, path);
  }
});
