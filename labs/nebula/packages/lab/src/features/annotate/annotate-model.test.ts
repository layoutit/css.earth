import assert from 'node:assert/strict';
import test from 'node:test';
import { annotationText, quadMetrics, skyOffset, type AnnotationFrame } from './annotate-model.ts';

const parsec = 3.0856775814913673e16;
// A frame 1 kpc away toward RA 0, Dec 0 with local axes equal to ICRF and 1 unit = 1 AU-ish metres.
const frame: AnnotationFrame = { referenceFrame: 'sun-icrf', originM: [1000 * parsec, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1.495978707e11 };
test('sky offsets read east, north and depth from the frame origin', () => {
  // 1 AU at 1 kpc is 1 milliarcsec; 1000 units are 1 arcsec.
  const east = skyOffset(frame, [0, 1000, 0])!, north = skyOffset(frame, [0, 0, 1000])!, far = skyOffset(frame, [1000, 0, 0])!;
  assert.ok(Math.abs(east.eastArcsec - 1) < 1e-3 && Math.abs(east.northArcsec) < 1e-9 && Math.abs(east.depthArcsec) < 1e-9);
  assert.ok(Math.abs(north.northArcsec - 1) < 1e-3 && Math.abs(north.eastArcsec) < 1e-9);
  assert.ok(Math.abs(far.depthArcsec - 1) < 1e-3, 'positive depth is farther from the observer');
  // A quarter turn about z carries local +x onto ICRF +y, which is east here.
  const turned = skyOffset({ ...frame, localToReferenceXyzw: [0, 0, Math.SQRT1_2, Math.SQRT1_2] }, [1000, 0, 0])!;
  assert.ok(Math.abs(turned.eastArcsec - 1) < 1e-3 && Math.abs(turned.depthArcsec) < 1e-6);
  assert.equal(skyOffset({ ...frame, referenceFrame: 'lab-sky-west-north-toward' }, [1, 0, 0]), null);
});
test('the projected quad reports its edge lengths and its stretch', () => {
  assert.deepEqual(quadMetrics([[0, 0], [40, 0], [40, 10], [0, 10]]), { screenPx: [40, 10], stretch: 4 });
  assert.equal(quadMetrics([[0, 0], [5, 0], [5, 0], [0, 0]]).stretch, Infinity);
});
test('the copied line is one compact JSON object', () => {
  const text = annotationText({ object: 'cassiopeia-a', dataset: 'default', bank: 'cassiopeia-a-layers', camera: { pose: 'front' } },
    [{ bank: 'cassiopeia-a-layers', layer: 'z', leaf: 'shape-0001', sky: { eastArcsec: -80.04, northArcsec: 12.36, depthArcsec: 3.3 }, screenPx: [40.4, 9.6], stretch: 4.208 }]);
  assert.doesNotMatch(text, /\n/);
  assert.deepEqual(JSON.parse(text).patches, [{ layer: 'z', leaf: 'shape-0001', eastArcsec: -80, northArcsec: 12.4, depthArcsec: 3.3, screenPx: [40, 10], stretch: 4.21 }]);
});
