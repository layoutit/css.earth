import assert from 'node:assert/strict';
import test from 'node:test';
import { compilerInspectionCamera } from './compiler-framing.js';

test('compiler Earth fit matches Alignment full-footprint bounds and 18px inset', () => {
  const viewport = { width: 1000, height: 700 }, boundsArcsec = { min: [-1500, -1134] as [number, number], max: [1445, 1121] as [number, number] };
  const fit = compilerInspectionCamera({ boundsArcsec, paddingPixels: 18 }, [-275, -100, -3], viewport,
    { zoom: 1, panX: 0, panY: 0 }, 0, 0);
  const topLeft = fit.project(boundsArcsec.min[0], boundsArcsec.max[1], 0), bottomRight = fit.project(boundsArcsec.max[0], boundsArcsec.min[1], 0);
  const left = viewport.width / 2 + topLeft[0], top = viewport.height / 2 + topLeft[1];
  const right = viewport.width / 2 + bottomRight[0], bottom = viewport.height / 2 + bottomRight[1];
  assert.ok(Math.abs(top - 18) < 1e-10); assert.ok(Math.abs(bottom - (viewport.height - 18)) < 1e-10);
  assert.ok(left > 18 && right < viewport.width - 18);
  assert.deepEqual(fit.project((boundsArcsec.min[0] + boundsArcsec.max[0]) / 2,
    (boundsArcsec.min[1] + boundsArcsec.max[1]) / 2, 0), [0, 0]);
});

test('inspection center remains the orbit pivot without changing the user pan', () => {
  const fit = compilerInspectionCamera({ boundsArcsec: { min: [-10, -20], max: [30, 40] } }, [4, 5, 6],
    { width: 900, height: 600 }, { zoom: 1.5, panX: 12, panY: -7 }, 57, 31);
  assert.deepEqual(fit.project(10, 10, 0), [12, -7]);
  assert.ok(fit.framing.panX !== 12 && fit.framing.panY !== -7, 'Camera transport compensates for the volume-local origin.');
});
