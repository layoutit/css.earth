import assert from 'node:assert/strict';
import { test } from 'vitest';
import { registeredOverlayCorners, type ImageRegistration } from './overlay-registration.ts';
import { overlayCorners, rayToOverlayPlane, wcsPixelRay, type ImageWcs, type OverlayFrame } from './overlay-wcs.ts';

const wcs: ImageWcs = { projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [80, 60],
  referencePixel: [40.5, 30.5], referenceValueDeg: [0, 0], scaleDeg: [-.02, .02], rotationDeg: 13 };
const frame: OverlayFrame = { referenceFrame: 'ICRS', epochJdTt: 2451545, originM: [1000, 0, 0],
  localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1 };
const close = (actual: readonly number[][], expected: readonly number[][]) => actual.forEach((point, corner) =>
  point.forEach((value, axis) => assert.ok(Math.abs(value - expected[corner]![axis]!) < 1e-10,
    `corner ${corner}, axis ${axis}: ${value} !== ${expected[corner]![axis]}`)));

test('identity registration preserves the publisher WCS footprint', () => {
  const registration: ImageRegistration = { referenceWcs: wcs, referenceWidthPx: 80, referenceHeightPx: 60,
    imageToReferenceMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
  close(registeredOverlayCorners(registration, 80, 60, frame), overlayCorners(wcs, frame));
});

test('a nontrivial projective registration maps all four image corners through H', () => {
  const registration: ImageRegistration = { referenceWcs: wcs, referenceWidthPx: 80, referenceHeightPx: 60,
    imageToReferenceMatrix: [1.5, .1, 5, -.05, 1.4, 6, .001, -.0005, 1] };
  const referencePixels = [[4.201050262565642, 5.326331582895724], [61.74561192594374, 3.1978841067564323],
    [65.57696999268114, 44.23030007318857], [7.311500380807312, 48.05788271134805]];
  const expected = referencePixels.map(([u, v]) => rayToOverlayPlane(wcsPixelRay(wcs, u! + 1, 60 - v!), frame));
  close(registeredOverlayCorners(registration, 40, 30, frame), expected);
});
