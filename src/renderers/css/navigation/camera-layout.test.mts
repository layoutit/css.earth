import assert from 'node:assert/strict';
import { test } from 'vitest';
import mercury from '../../../../src/objects/mercury/prepared/runtime.json' with { type: 'json' };
import venus from '../../../../src/objects/venus/prepared/runtime.json' with { type: 'json' };
import { selectPreparedResponsiveZoom } from './camera-layout.ts';

type ResponsiveFitOptions = Parameters<typeof selectPreparedResponsiveZoom>[0];
function responsiveFit(plan: ResponsiveFitOptions["plan"], width: number, height: number, options: Partial<ResponsiveFitOptions> = {}) {
  const bounds = (): DOMRect => ({ width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON() { return { width, height }; } });
  return selectPreparedResponsiveZoom({
    // The fixture provides the only DOM operation used by responsive framing.
    viewport: { read: () => ({ bounds: bounds(), focalPixels: 1000, previewTop: null, openArea: null }), subscribe: () => () => {}, destroy() {} },
    plan,
    mobile: width < 768,
    ...options,
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

test('physical responsive framing uses the world context framing reference', () => {
  const plan = mercury.camera;
  const authored = responsiveFit(plan, 1440, 900);
  const worldReference = responsiveFit(plan, 1440, 900, { framingReferenceZoom: 1 });
  assert.ok(Math.abs(worldReference.zoom / authored.zoom - 1 / plan.defaultZoom) < 1e-12);
});
