import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CameraModelPanel, type CameraModelPanelProps } from './camera-model-panel';

const render = (props: CameraModelPanelProps) => renderToStaticMarkup(createElement(CameraModelPanel, props));
test('all camera capabilities use the same ordered controls and Model owner; Turn 60° only where supplied', () => {
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
  for (const path of ['ui/camera-panel', 'features/joint-fit/joint-fit-panel', 'features/kinematics/kinematics-panel']) {
    const source = await readFile(`labs/nebula/packages/lab/src/${path}.tsx`, 'utf8');
    assert.match(source, /<CameraModelPanel\b/, path);
    assert.doesNotMatch(source, /<CameraActions\b|<legend>Model<\/legend>/, path);
  }
});

test('the Turn 60° preset and the tool group appear only where supplied, and the Model section can be dropped', () => {
  const markup = render({ camera: { turn: { onActivate() {} } }, showModel: false, toolbox: createElement('button', { id: 'tool' }, 'Tool') });
  assert.deepEqual([...markup.matchAll(/data-camera-action="([^"]+)"/g)].map(match => match[1]), ['earth', 'orbit', 'fit', 'reset', 'turn']);
  assert.match(markup, /role="group" aria-label="Tools"[^>]*>.*id="tool"/s);
  assert.doesNotMatch(markup, /<legend>Model<\/legend>/);
});
