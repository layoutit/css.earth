import { expect, it } from 'vitest';
import { createPerspectiveDolly, levelOfDetailFor } from './perspective-dolly.js';
import scene from '../../../objects/mercury/prepared/scene.json';

it('crossfades mesh and marker in two stages, drawing no billboard disc', () => {
  const lod = { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 20,
    billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 };
  const samples = [40, 17, 13, 7, 4.5, 4].map(diameter => levelOfDetailFor(lod, diameter));
  // A resolving body goes from its marker straight to its mesh: the marker fades
  // in over the mesh, which stays painted until the marker is opaque.
  expect(samples.map(sample => sample.stage)).toEqual(['geometry', 'geometry', 'geometry', 'geometry', 'marker', 'marker']);
  // No billboard disc is drawn at any size.
  expect(samples.map(sample => sample.billboardOpacity)).toEqual([0, 0, 0, 0, 0, 0]);
  expect(samples.map(sample => sample.markerOpacity)).toEqual([0, 0, 0, 1 / 3.5, 1, 1]);
  // The prepared billboard band only times the selected navigation marker's
  // fade over the mesh, so it is complete well before the mesh hides.
  expect(samples.map(sample => sample.proxyOpacity)).toEqual([0, .5, 1, 1, 1, 1]);
  for (const sample of samples) {
    expect(sample.stage).toBe(sample.markerOpacity >= 1 ? 'marker' : 'geometry');
    if (sample.markerOpacity > 0) expect(sample.proxyOpacity).toBe(1);
  }
});


it('publishes physical scene coordinates without CSS perspective-origin or focal shims', () => {
  let width = 1440, height = 900, focal = 1247;
  let layoutReads = 0;
  const view = { getComputedStyle: () => ({ perspective: `${focal}px`, perspectiveOrigin: `${width/2}px ${height/2}px` }) };
  const make = (x: number) => ({ style: {}, ownerDocument: { defaultView: view },
    getBoundingClientRect: () => { layoutReads++; return { width, height, x, y: 0, left: x, top: 0 }; } });
  const options = { cameraPlan: { ...scene.camera, sceneScale: .3 }, heliocentric: null,
    worldContext: { frame: { referenceFrame: 'test', epochJdTt: 1, originM: [0,0,0],
      presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 100 },
      bodyRadiusUnits: 100, kilometersPerUnit: .001, maximumExtentUnits: 1e8 },
    cameraElement: make(170), viewport: { read: () => ({ bounds: make(0).getBoundingClientRect(), focalPixels: focal, previewTop: null, openArea: null }), subscribe: () => () => {}, destroy() {} }, stage: make(0), sceneElement: { style: {} } };
  const dolly = createPerspectiveDolly(options as unknown as Parameters<typeof createPerspectiveDolly>[0]);
  const bodyCenter = [120, -70, -1200] as const;
  dolly.setBodyCenter(bodyCenter);
  const rotation = { m11: 0, m21: -1, m31: 0, m12: 1, m22: 0, m32: 0, m13: 0, m23: 0, m33: 1 } as DOMMatrix;
  const measured = layoutReads;
  const beforePrepare = { ...options.sceneElement.style };
  const captured = dolly.prepare(rotation, 'rotateZ(90deg)');
  expect(options.sceneElement.style).toEqual(beforePrepare);
  dolly.setBodyCenter([500, 300, -8000]);
  const committed = captured.commit();
  expect(committed.distance).toBe(Math.hypot(...bodyCenter));
  expect(dolly.bodyCenter(), 'Committing an older frame must preserve newer requested input').toEqual([500, 300, -8000]);
  dolly.setBodyCenter(bodyCenter);
  const published = dolly.publish(rotation, 'rotateZ(90deg)');
  expect(committed).toEqual(published);
  expect(layoutReads, 'Camera publication must not force layout after its transform writes').toBe(measured);
  expect(published.stageViewport).toEqual({ focalPixels: focal, widthPixels: width, heightPixels: height,
    principalOffsetPixels: [0, 0] });
  expect(published.projection.focalPixels).toBe(focal);
  expect(published.projection.principalOffsetPixels).toEqual([0, 0]);
  const expected = [0, .3, 0, 0, -.3, 0, 0, 0, 0, 0, .3, 0, ...bodyCenter, 1];
  published.projection.eyeFromScene.forEach((value, index) => expect(value).toBeCloseTo(expected[index]!, 10));
  expect(dolly.state().silhouetteRadius).toBe(published.body!.silhouetteRadius);
  expect(dolly.state().offAxisDegrees).toBe(published.body!.offAxisDegrees);
  const trackball = dolly.trackball();
  expect(trackball.centerX).toBeCloseTo(width / 2 + published.body!.silhouette!.centre[0], 10);
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
  width = 1000; height = 700; focal = 866;
  dolly.remeasure();
  const resizedReads = layoutReads;
  expect(dolly.publish(rotation, 'rotateZ(90deg)').stageViewport).toEqual({
    focalPixels: focal, widthPixels: width, heightPixels: height, principalOffsetPixels: [0, 0],
  });
  expect(layoutReads, 'The next frame uses the refreshed layout cache').toBe(resizedReads);
});

it('overview centering preserves the current view and only converges while dollying out', () => {
  const width = 1440, height = 900, focal = 1247;
  const view = { getComputedStyle: () => ({ perspective: `${focal}px`, perspectiveOrigin: `${width / 2}px ${height / 2}px` }) };
  const make = (left: number) => ({ style: {}, ownerDocument: { defaultView: view },
    getBoundingClientRect: () => ({ width, height, x: left, y: 0, left, top: 0 }) });
  const dolly = createPerspectiveDolly({ cameraPlan: scene.camera, heliocentric: null,
    worldContext: { frame: { referenceFrame: 'test', epochJdTt: 1, originM: [0, 0, 0],
      presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 100 },
      bodyRadiusUnits: 100, kilometersPerUnit: .001, maximumExtentUnits: 1e8 },
    cameraElement: make(170), viewport: { read: () => ({ bounds: make(0).getBoundingClientRect(), focalPixels: focal, previewTop: null, openArea: null }), subscribe: () => () => {}, destroy() {} }, stage: make(0), sceneElement: { style: {} },
  } as unknown as Parameters<typeof createPerspectiveDolly>[0]);
  dolly.setBodyCenter([1300, -600, -3500]);
  const initial = dolly.bodyCenter(), initialDistance = dolly.camera.state.distance;
  const screen = () => { const [x, y, z] = dolly.bodyCenter()!; return [focal * x / -z, focal * y / -z]; };
  const initialOffset = Math.hypot(...screen());
  dolly.setZoomOutCentering(true);
  expect(dolly.bodyCenter(), 'Enabling centering does not move the eye').toEqual(initial);
  let previousOffset = initialOffset;
  for (let step = 1; step <= 100; step++) {
    const distance = initialDistance * (1 + step * .09);
    dolly.camera.update({ distance });
    expect(Math.hypot(...dolly.bodyCenter()!)).toBeCloseTo(distance, 8);
    const offset = Math.hypot(...screen());
    expect(offset).toBeLessThan(previousOffset);
    expect(previousOffset - offset).toBeLessThan(initialOffset * .1);
    previousOffset = offset;
  }
  expect(previousOffset).toBeLessThan(initialOffset * .11);
  const finalScreen = screen();
  dolly.camera.update({ distance: dolly.camera.state.distance * .9 });
  screen().forEach((value, axis) => expect(value).toBeCloseTo(finalScreen[axis]!, 9));
  dolly.setZoomOutCentering(false);
  dolly.camera.update({ distance: dolly.camera.state.distance * 2 });
  screen().forEach((value, axis) => expect(value).toBeCloseTo(finalScreen[axis]!, 9));
  dolly.setBodyCenter([100, 0, 1000]);
  dolly.setZoomOutCentering(true);
  dolly.camera.update({ distance: dolly.camera.state.distance * 2 });
  expect(dolly.bodyCenter(), 'A body behind the eye cannot jump across the camera').toEqual([200, 0, 2000]);
});


it('draws the mesh only once it outgrows its proxy, and restores the same scene', () => {
  const view = { getComputedStyle: () => ({ perspective: '1247px', perspectiveOrigin: '720px 450px' }) };
  const make = () => ({ style: {}, ownerDocument: { defaultView: view },
    getBoundingClientRect: () => ({ width: 1440, height: 900, x: 0, y: 0, left: 0, top: 0 }) });
  let hidden = false, visibilityWrites = 0;
  const element = { style: {} as Record<string, string>, get hidden() { return hidden; },
    set hidden(value: boolean) { hidden = value; visibilityWrites++; } };
  const frame = { referenceFrame: 'test', epochJdTt: 1, originM: [1e8, 0, 0],
    presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 100 };
  const create = (originM: number[]) => createPerspectiveDolly({ cameraPlan: scene.camera, heliocentric: null,
    worldContext: { frame: { ...frame, originM }, bodyRadiusUnits: 100, kilometersPerUnit: .001,
      maximumExtentUnits: 1e9 },
    cameraElement: make(), viewport: { read: () => ({ bounds: make().getBoundingClientRect(), focalPixels: 1247, previewTop: null, openArea: null }), subscribe: () => () => {}, destroy() {} }, stage: make(), sceneElement: element,
  } as unknown as Parameters<typeof createPerspectiveDolly>[0]);
  const dolly = create(frame.originM);
  const identity = { m11: 1, m21: 0, m31: 0, m12: 0, m22: 1, m32: 0, m13: 0, m23: 0, m33: 1 } as DOMMatrix;
  dolly.setBodyCenter([0, 0, -1e5]);
  const near = dolly.publish(identity, 'rotateZ(0deg)').levelOfDetail!;
  expect(near.stage).toBe('marker');
  expect(near.silhouetteDiameter).toBeGreaterThan(1.25);
  expect(hidden, 'The opaque proxy stands for a marker-stage body').toBe(true);
  expect(visibilityWrites).toBe(1);
  dolly.setBodyCenter([0, 0, -1e7]);
  const far = dolly.publish(identity, 'rotateZ(0deg)');
  expect(hidden).toBe(true);
  expect(element.style.transform, 'A hidden scene draws nothing, so it is not transformed').toBeUndefined();
  dolly.setBodyCenter([0, 0, -2e7]);
  const further = dolly.publish(identity, 'rotateZ(0deg)');
  expect(element.style.transform, 'Hidden camera publication writes no scene transform').toBeUndefined();
  expect(further.projection.eyeFromScene[14]).toBe(-2e7);
  expect(far.projection.eyeFromScene[14]).toBe(-1e7);
  expect(visibilityWrites, 'Hidden camera publication does not churn visibility').toBe(1);
  // A resolved mesh returns, also outside the enclosing context's extent.
  const outside = create([1e10, 0, 0]);
  outside.setBodyCenter([0, 0, -1200]);
  expect(outside.publish(identity, 'rotateZ(0deg)').levelOfDetail!.stage).toBe('geometry');
  expect(hidden).toBe(false);
  expect(element.style.transform, 'The shown scene carries the current pose').toMatch(/^translate3d\(/);
});
