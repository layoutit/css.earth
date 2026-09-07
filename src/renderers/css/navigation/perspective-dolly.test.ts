import { expect, it } from 'vitest';
import { createPerspectiveDolly, levelOfDetailFor } from './perspective-dolly.js';
import scene from '../../../planets/mercury/prepared/scene.json';
import earth from '../../../planets/earth/prepared/runtime.json';

  it('crossfades geometry, billboard and marker without hiding the finer stage early', () => {
    const lod = { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 20,
      billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 };
    const samples = [40, 17, 13, 7, 4].map(diameter => levelOfDetailFor(lod, diameter));
    expect(samples.map(sample => sample.stage)).toEqual(['geometry', 'crossfade', 'billboard', 'billboard', 'marker']);
    expect(samples[1].billboardOpacity).toBe(.5);
    for (const sample of samples) if (sample.markerOpacity > 0) expect(sample.billboardOpacity).toBe(1);
  });


it('publishes physical scene coordinates without CSS perspective-origin or focal shims', () => {
  const width = 1440, height = 900, focal = 1247;
  const view = { getComputedStyle: () => ({ perspective: `${focal}px`, perspectiveOrigin: `${width/2}px ${height/2}px` }) };
  const make = (x: number) => ({ style: {}, ownerDocument: { defaultView: view },
    getBoundingClientRect: () => ({ width, height, x, y: 0, left: x, top: 0 }) });
  const options = { cameraPlan: { ...scene.camera, sceneScale: .3 }, heliocentric: null,
    worldContext: { frame: { referenceFrame: 'test', epochJdTt: 1, originM: [0,0,0],
      presentationToReference: [1,0,0,0,1,0,0,0,1], metersPerUnit: 1, bodyRadiusM: 100 },
      bodyRadiusUnits: 100, kilometersPerUnit: .001, maximumExtentUnits: 1e8 },
    cameraElement: make(170), skyElement: make(0), stage: make(0), sceneElement: { style: {} } };
  const dolly = createPerspectiveDolly(options as unknown as Parameters<typeof createPerspectiveDolly>[0]);
  const bodyCenter = [120, -70, -1200] as const;
  dolly.setBodyCenter(bodyCenter);
  const rotation = { m11: 0, m21: -1, m31: 0, m12: 1, m22: 0, m32: 0, m13: 0, m23: 0, m33: 1 } as DOMMatrix;
  const published = dolly.publish(rotation, 'rotateZ(90deg)');
  expect(published.projection.focalPixels).toBe(focal);
  expect(published.projection.principalOffsetPixels).toEqual([-170, 0]);
  const expected = [0, .3, 0, 0, -.3, 0, 0, 0, 0, 0, .3, 0, ...bodyCenter, 1];
  published.projection.eyeFromScene.forEach((value, index) => expect(value).toBeCloseTo(expected[index]!, 10));
  expect(dolly.state().silhouetteRadius).toBe(published.body!.silhouetteRadius);
  expect(dolly.state().offAxisDegrees).toBe(published.body!.offAxisDegrees);
  const trackball = dolly.trackball();
  expect(trackball.centerX).toBeCloseTo(170 + width / 2 + published.body!.silhouette!.centre[0], 10);
  expect(trackball.centerY).toBeCloseTo(height / 2 + published.body!.silhouette!.centre[1], 10);
  expect(published.levelOfDetail!.stage).toBe('geometry');
  const local = [30, 40, 50], eye = [108, -61, -1185];
  const m = published.projection.eyeFromScene;
  [0,1,2].forEach(axis => expect(m[axis]! * local[0]! + m[4+axis]! * local[1]! + m[8+axis]! * local[2]! + m[12+axis]!).toBeCloseTo(eye[axis]!, 10));
  const screen = [0,1].map(axis => published.projection.principalOffsetPixels[axis]! + focal * eye[axis]! / -eye[2]!);
  const translation = published.body!.translate;
  const cssPoint = [translation[0] - 12, translation[1] + 9, translation[2] + 15];
  const cssScreen = [0,1].map(axis => published.principalOffset[axis]! + focal * (cssPoint[axis]! - published.principalOffset[axis]!) / (focal - cssPoint[2]!));
  screen.forEach((value, axis) => expect(value).toBeCloseTo(cssScreen[axis]!, 10));
  dolly.setBodyCenter([120, -70, -1e6]);
  const distant = dolly.publish(rotation, 'rotateZ(90deg)');
  expect(distant.levelOfDetail!.stage).toBe('marker');
  expect(dolly.levelOfDetail()).toEqual(distant.levelOfDetail);
  // A grazing eye outside the sphere has an unbounded silhouette, so close
  // geometry must remain visible and interaction metrics must stay finite.
  dolly.setBodyCenter([100, 0, -20]);
  const grazing = dolly.publish(rotation, 'rotateZ(90deg)');
  expect(grazing.body!.silhouette).toBeNull();
  expect(grazing.levelOfDetail!.stage).toBe('geometry');
  expect(Number.isFinite(dolly.trackball().radius)).toBe(true);

});

it('surface dolly moves below the off-axis silhouette limit and preserves that distance on resize', () => {
  let width = 1440;
  const height = 1000, focal = 1247, bodyRadius = 100;
  const view = { getComputedStyle: () => ({ perspective: `${focal}px`, perspectiveOrigin: `${width/2}px ${height/2}px` }) };
  const make = (x: number) => ({ style: {}, ownerDocument: { defaultView: view },
    getBoundingClientRect: () => ({ width, height, x, y: 0, left: x, top: 0 }) });
  const dolly = createPerspectiveDolly({ cameraPlan: earth.camera, heliocentric: null,
    worldContext: { frame: { referenceFrame: 'test', epochJdTt: 1, originM: [0,0,0],
      presentationToReference: [1,0,0,0,1,0,0,0,1], metersPerUnit: 1, bodyRadiusM: bodyRadius },
      bodyRadiusUnits: bodyRadius, kilometersPerUnit: .001, maximumExtentUnits: 1e8 },
    cameraElement: make(170), skyElement: make(0), stage: make(0), sceneElement: { style: {} },
  } as unknown as Parameters<typeof createPerspectiveDolly>[0]);
  const identity = { m11: 1, m21: 0, m31: 0, m12: 0, m22: 1, m32: 0, m13: 0, m23: 0, m33: 1 } as DOMMatrix;
  dolly.camera.update({ zoom: 1024 });
  const start = dolly.camera.state.distance;
  // One short continuous gesture reduces actual surface clearance, even
  // when the visible globe's ellipse would already cross the eye plane.
  const target = bodyRadius + (start - bodyRadius) * Math.exp(-51 * dolly.wheelDolly.stepPerDelta);
  dolly.camera.update({ distance: target });
  expect(dolly.camera.state.distance).toBeCloseTo(target, 12);
  expect(dolly.camera.state.zoom).toBe(earth.camera.maximumZoom);
  const close = dolly.publish(identity, 'none');
  expect(close.body!.silhouette).toBeNull();
  expect(close.levelOfDetail!.stage).toBe('geometry');
  expect(close.projection.eyeFromScene.every(Number.isFinite)).toBe(true);
  expect(Number.isFinite(dolly.trackball().surfaceRadius)).toBe(true);
  width = 1100;
  dolly.remeasure();
  expect(dolly.camera.state.distance).toBeCloseTo(target, 12);
  dolly.camera.update({ distance: 0 });
  expect(dolly.camera.state.distance).toBeCloseTo(bodyRadius * earth.camera.dolly.minimumDistanceRadii, 12);
});
