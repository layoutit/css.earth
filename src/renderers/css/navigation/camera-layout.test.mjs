import assert from 'node:assert/strict';
import { test } from 'vitest';
import mercury from '../../../../objects/preparation/mercury/runtime.json' with { type: 'json' };
import venus from '../../../../objects/preparation/venus/runtime.json' with { type: 'json' };
import { selectPreparedResponsiveZoom } from './camera-layout.ts';

function responsiveFit(plan, width, height) {
  const bounds = () => ({ width, height });
  return selectPreparedResponsiveZoom({
    stage: { getBoundingClientRect: bounds },
    cameraElement: { getBoundingClientRect: bounds },
    plan,
    mobile: width < 768,
  });
}

test('physical responsive framing honors mobile and desktop diameter independently of legacy scale bounds', () => {
  for (const definition of [mercury, venus]) {
    const plan = definition.camera;
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      const fit = responsiveFit(plan, width, height);
      const diameter = fit.zoom / plan.defaultZoom * plan.logicalBodyDiameter;
      assert.ok(Math.abs(diameter - fit.widthShare * width) < 1e-10);
      if (width === 390) {
        assert.ok(fit.widthShare > .41 && fit.widthShare < .43);
        assert.ok(diameter / plan.logicalBodyDiameter < plan.responsiveFit.minimumZoom,
          'The mobile case must exercise the legacy scale floor that inflated the physical disc.');
      } else {
        assert.ok(Math.abs(diameter / width - .36) < 1e-12);
      }
    }
  }
});

test('legacy camera responsive framing retains its authored scale bounds', () => {
  const plan = { ...venus.camera, projection: undefined };
  assert.equal(responsiveFit(plan, 390, 844).zoom, plan.responsiveFit.minimumZoom);
  assert.equal(responsiveFit(plan, 10000, 10000).zoom, plan.responsiveFit.maximumZoom);
});
