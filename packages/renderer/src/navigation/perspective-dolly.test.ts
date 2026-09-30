import { fixedCameraOrientation } from '../../test/camera-orientation-fixture.mts';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import type { PerspectiveDolly } from './perspective-dolly.js';
import type { PreparedWorldCameraFrame } from './world-camera.js';
import type { PositionM } from '@cssearth/engine';
import { createPerspectiveDolly, levelOfDetailFor } from './perspective-dolly.js';
import scene from '../../../../src/objects/mercury/prepared/scene.json' with { type: 'json' };

// Restore through the public camera boundary; the presenter cannot mutate a body centre.
function place(dolly: PerspectiveDolly, bodyCenterUnits: PositionM) {
  const [x, y, z] = bodyCenterUnits;
  dolly.camera.restore({}, undefined, [x * .001, y * .001, z * .001]);
}

it('keeps detail hidden through the prepared billboard band', () => {
  const lod = { model: 'silhouette-diameter-crossfade', billboardFadeStartDiscPixels: 20,
    billboardFullDiscPixels: 14, markerFadeStartDiscPixels: 8, markerFullDiscPixels: 4.5 };
  const samples = [40, 17, 14, 13, 7, 4.5, 4].map(diameter => levelOfDetailFor(lod, diameter));
  assert.deepEqual(samples.map(sample => sample.stage), ['geometry', 'geometry', 'billboard', 'billboard', 'billboard', 'marker', 'marker']);
  assert.deepEqual(samples.map(sample => sample.proxyOpacity), [0, .5, 1, 1, 1, 1, 1]);
  assert.equal(samples[2]!.billboardOpacity, 1);
  assert.equal(samples[5]!.billboardOpacity, 0);
});


it('publishes physical scene coordinates without CSS perspective-origin or focal shims', () => {
  let width = 1440, height = 900, focal = 1247;
  let layoutReads = 0;
  const view = { getComputedStyle: () => ({ perspective: `${focal}px`, perspectiveOrigin: `${width/2}px ${height/2}px` }) };
  const make = (x: number) => ({ style: {}, ownerDocument: { defaultView: view },
    getBoundingClientRect: () => { layoutReads++; return { width, height, x, y: 0, left: x, top: 0 }; } });
  const options = { cameraPlan: { ...scene.camera, sceneScale: .3 }, heliocentric: null,
    worldContext: { frame: { referenceFrame: 'test', epochJdTt: 1, originM: [0,0,0],
      presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 100 } satisfies PreparedWorldCameraFrame,
      bodyRadiusUnits: 100, kilometersPerUnit: .001, maximumExtentUnits: 1e8 },
    cameraElement: make(170), viewport: { read: () => ({ bounds: make(0).getBoundingClientRect(), focalPixels: focal, previewTop: null, openArea: null }), subscribe: () => () => {}, destroy() {} }, stage: make(0), sceneElement: { style: {} } };
  const dolly = createPerspectiveDolly(options as unknown as Parameters<typeof createPerspectiveDolly>[0], () => fixedCameraOrientation([0, -1, 0, 1, 0, 0, 0, 0, 1]));
  const bodyCenter = [120, -70, -1200] as const;
  place(dolly, bodyCenter);
  const measured = layoutReads;
  const beforePrepare = { ...options.sceneElement.style };
  const captured = dolly.prepare();
  assert.deepEqual(options.sceneElement.style, beforePrepare);
  place(dolly, [500, 300, -8000]);
  const committed = captured.commit();
  assert.equal(committed.distance, Math.hypot(...bodyCenter));
  assert.deepEqual(dolly.camera.bodyCenter(), [500, 300, -8000], 'Committing an older frame must preserve newer requested input');
  place(dolly, bodyCenter);
  const published = dolly.prepare().commit();
  assert.deepEqual(committed, published);
  assert.equal(layoutReads, measured, 'Camera publication must not force layout after its transform writes');
  assert.deepEqual(published.stageViewport, { focalPixels: focal, widthPixels: width, heightPixels: height,
    principalOffsetPixels: [0, 0] });
  assert.equal(published.projection.focalPixels, focal);
  assert.deepEqual(published.projection.principalOffsetPixels, [0, 0]);
  const expected = [0, .3, 0, 0, -.3, 0, 0, 0, 0, 0, .3, 0, ...bodyCenter, 1];
  published.projection.eyeFromScene.forEach((value, index) => assert.ok(Math.abs(value - (expected[index]!)) < 10 ** -10 / 2, `${value} is not close to ${expected[index]!}`));
  assert.equal(dolly.state().silhouetteRadius, published.body!.silhouetteRadius);
  assert.equal(dolly.state().offAxisDegrees, published.body!.offAxisDegrees);
  const trackball = dolly.trackball();
  assert.ok(Math.abs(trackball.centerX - (width / 2 + published.body!.silhouette!.centre[0])) < 10 ** -10 / 2, `${trackball.centerX} is not close to ${width / 2 + published.body!.silhouette!.centre[0]}`);
  assert.ok(Math.abs(trackball.centerY - (height / 2 + published.body!.silhouette!.centre[1])) < 10 ** -10 / 2, `${trackball.centerY} is not close to ${height / 2 + published.body!.silhouette!.centre[1]}`);
  assert.equal(published.levelOfDetail!.stage, 'geometry');
  const local = [30, 40, 50], eye = [108, -61, -1185];
  const m = published.projection.eyeFromScene;
  [0,1,2].forEach(axis => assert.ok(Math.abs((m[axis]! * local[0]! + m[4+axis]! * local[1]! + m[8+axis]! * local[2]! + m[12+axis]!) - (eye[axis]!)) < 10 ** -10 / 2, `${(m[axis]! * local[0]! + m[4+axis]! * local[1]! + m[8+axis]! * local[2]! + m[12+axis]!)} is not close to ${eye[axis]!}`));
  const screen = [0,1].map(axis => published.projection.principalOffsetPixels[axis]! + focal * eye[axis]! / -eye[2]!);
  const translation = published.body!.translate;
  const cssPoint = [translation[0] - 12, translation[1] + 9, translation[2] + 15];
  const cssScreen = [0,1].map(axis => published.principalOffset[axis]! + focal * (cssPoint[axis]! - published.principalOffset[axis]!) / (focal - cssPoint[2]!));
  screen.forEach((value, axis) => assert.ok(Math.abs(value - (cssScreen[axis]!)) < 10 ** -10 / 2, `${value} is not close to ${cssScreen[axis]!}`));
  // Optical framing changes only the camera root transform. CSS perspective
  // stays fixed, while the physical projection used by labels/picking includes
  // the same focal multiplier. A point with depth must agree, not just a disc.
  const perspective = Reflect.get(options.cameraElement.style, 'perspective');
  const beforeFramingReads = layoutReads;
  dolly.camera.setProjectionScale(3.25);
  const enlarged = dolly.prepare().commit();
  assert.equal(Reflect.get(options.cameraElement.style, 'perspective'), perspective);
  assert.equal(Reflect.get(options.cameraElement.style, 'scale'), '3.25');
  assert.equal(enlarged.projection.focalPixels, focal * 3.25);
  assert.equal(enlarged.stageViewport.projectionScale, 3.25);
  assert.equal(dolly.camera.capture(options.worldContext.frame).projectionScale, 3.25);
  assert.ok(Reflect.get(options.sceneElement.style, 'transform').includes(`translate3d(120px, -70px, ${focal - 1200}px)`));
  for (const axis of [0, 1]) {
    const projected = enlarged.projection.focalPixels * eye[axis]! / -eye[2]!;
    assert.ok(Math.abs(projected - (cssScreen[axis]! * 3.25)) < 10 ** -10 / 2, `${projected} is not close to ${cssScreen[axis]! * 3.25}`);
  }
  assert.equal(layoutReads, beforeFramingReads);
  dolly.camera.setProjectionScale(1);
  place(dolly, [120, -70, -1e6]);
  const distant = dolly.prepare().commit();
  assert.equal(distant.levelOfDetail!.stage, 'marker');
  assert.deepEqual(dolly.levelOfDetail(), distant.levelOfDetail);
  // A grazing eye outside the sphere has an unbounded silhouette, so close
  // geometry must remain visible and interaction metrics must stay finite.
  place(dolly, [100, 0, -20]);
  const grazing = dolly.prepare().commit();
  assert.equal(grazing.body!.silhouette, null);
  assert.equal(grazing.levelOfDetail!.stage, 'geometry');
  assert.equal(Number.isFinite(dolly.trackball().radius), true);
  width = 1000; height = 700; focal = 866;
  dolly.remeasure();
  const resizedReads = layoutReads;
  assert.deepEqual(dolly.prepare().commit().stageViewport, {
    focalPixels: focal, widthPixels: width, heightPixels: height, principalOffsetPixels: [0, 0],
  });
  assert.equal(layoutReads, resizedReads, 'The next frame uses the refreshed layout cache');
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
  } as unknown as Parameters<typeof createPerspectiveDolly>[0], () => fixedCameraOrientation());
  place(dolly, [1300, -600, -3500]);
  const initial = dolly.camera.bodyCenter(), initialDistance = dolly.camera.state.distance;
  const screen = () => { const [x, y, z] = dolly.camera.bodyCenter()!; return [focal * x / -z, focal * y / -z]; };
  const initialOffset = Math.hypot(...screen());
  dolly.camera.setZoomOutCentering(true);
  assert.deepEqual(dolly.camera.bodyCenter(), initial, 'Enabling centering does not move the eye');
  let previousOffset = initialOffset;
  for (let step = 1; step <= 100; step++) {
    const distance = initialDistance * (1 + step * .09);
    dolly.camera.dolly({ distance });
    assert.ok(Math.abs(Math.hypot(...dolly.camera.bodyCenter()!) - (distance)) < 10 ** -8 / 2, `${Math.hypot(...dolly.camera.bodyCenter()!)} is not close to ${distance}`);
    const offset = Math.hypot(...screen());
    assert.ok(offset < previousOffset);
    assert.ok((previousOffset - offset) < initialOffset * .1);
    previousOffset = offset;
  }
  assert.ok(previousOffset < initialOffset * .11);
  const finalScreen = screen();
  dolly.camera.dolly({ distance: dolly.camera.state.distance * .9 });
  screen().forEach((value, axis) => assert.ok(Math.abs(value - (finalScreen[axis]!)) < 10 ** -9 / 2, `${value} is not close to ${finalScreen[axis]!}`));
  dolly.camera.setZoomOutCentering(false);
  dolly.camera.dolly({ distance: dolly.camera.state.distance * 2 });
  screen().forEach((value, axis) => assert.ok(Math.abs(value - (finalScreen[axis]!)) < 10 ** -9 / 2, `${value} is not close to ${finalScreen[axis]!}`));
  place(dolly, [100, 0, 1000]);
  dolly.camera.setZoomOutCentering(true);
  dolly.camera.dolly({ distance: dolly.camera.state.distance * 2 });
  assert.deepEqual(dolly.camera.bodyCenter(), [200, 0, 2000], 'A body behind the eye cannot jump across the camera');
});


it('draws the mesh only once it outgrows its proxy, and restores the same scene', () => {
  const view = { getComputedStyle: () => ({ perspective: '1247px', perspectiveOrigin: '720px 450px' }) };
  const make = () => ({ style: {}, ownerDocument: { defaultView: view },
    getBoundingClientRect: () => ({ width: 1440, height: 900, x: 0, y: 0, left: 0, top: 0 }) });
  let hidden = false, visibilityWrites = 0, moving = false;
  const element = { style: {} as Record<string, string>, get hidden() { return hidden; },
    set hidden(value: boolean) { hidden = value; visibilityWrites++; } };
  const frame = { referenceFrame: 'test', epochJdTt: 1, originM: [1e8, 0, 0],
    presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 100 };
  const create = (originM: number[]) => createPerspectiveDolly({ cameraPlan: scene.camera, heliocentric: null, isCameraMoving: () => moving,
    worldContext: { frame: { ...frame, originM }, bodyRadiusUnits: 100, kilometersPerUnit: .001,
      maximumExtentUnits: 1e9 },
    cameraElement: make(), viewport: { read: () => ({ bounds: make().getBoundingClientRect(), focalPixels: 1247, previewTop: null, openArea: null }), subscribe: () => () => {}, destroy() {} }, stage: make(), sceneElement: element,
  } as unknown as Parameters<typeof createPerspectiveDolly>[0], () => fixedCameraOrientation());
  const dolly = create(frame.originM);
  place(dolly, [0, 0, -1e5]);
  const near = dolly.prepare().commit().levelOfDetail!;
  assert.equal(near.stage, 'marker');
  assert.ok(near.silhouetteDiameter > 1.25);
  assert.equal(hidden, true, 'The opaque proxy stands for a marker-stage body');
  assert.equal(visibilityWrites, 1);
  place(dolly, [0, 0, -1e7]);
  const far = dolly.prepare().commit();
  assert.equal(hidden, true);
  assert.equal(element.style.transform, undefined, 'A hidden scene draws nothing, so it is not transformed');
  place(dolly, [0, 0, -2e7]);
  const further = dolly.prepare().commit();
  assert.equal(element.style.transform, undefined, 'Hidden camera publication writes no scene transform');
  assert.equal(further.projection.eyeFromScene[14], -2e7);
  assert.equal(far.projection.eyeFromScene[14], -1e7);
  assert.equal(visibilityWrites, 1, 'Hidden camera publication does not churn visibility');
  // A resolved mesh returns, also outside the enclosing context's extent.
  const outside = create([1e10, 0, 0]);
  place(outside, [0, 0, -1200]);
  assert.equal(outside.prepare().commit().levelOfDetail!.stage, 'geometry');
  assert.equal(hidden, false);
  assert.match(element.style.transform, /^translate3d\(/, 'The shown scene carries the current pose');
  const writes = visibilityWrites;
  moving = true;
  for (const distance of [1e7, 1200, 1e7, 1200, 1e7]) {
    place(outside, [0, 0, -distance]);
    assert.equal(outside.prepare().commit().levelOfDetail!.stage, 'geometry');
    assert.equal(hidden, false);
  }
  assert.equal(visibilityWrites, writes, 'Reversals retain the presented mesh instead of restarting reveal');
  assert.equal(outside.retainedDetail(), true);
  assert.equal(outside.levelOfDetail().markerOpacity, 1, 'The distant marker still follows projected size');
  moving = false;
  assert.equal(outside.prepare().commit().levelOfDetail!.stage, 'marker');
  assert.equal(hidden, true);
  assert.equal(outside.retainedDetail(), false);
  moving = true;
  const cold = create(frame.originM);
  place(cold, [0, 0, -1e7]);
  assert.equal(cold.prepare().commit().levelOfDetail!.stage, 'marker');
  assert.equal(hidden, true, 'Motion alone must not activate a cold distant mesh');
  // Recorded Earth departure: its oblique silhouette is large but millions of
  // pixels off-screen. A hidden source must not restart all its reveal groups.
  for (const center of [[-20023716, 318451, -4017], [20023716, -318451, -4017],
    [20000, 0, -50], [0, 20000, -50], [0, 0, 1000]] as const) {
    place(cold, center);
    const view = cold.prepare().commit();
    assert.equal(view.levelOfDetail.stage, 'marker', `Offscreen body at ${center}`);
    assert.equal(hidden, true);
  }
  // A partly clipped sphere still needs its mesh, even with its centre outside.
  place(cold, [750, 0, -1200]);
  assert.equal(cold.prepare().commit().levelOfDetail.stage, 'geometry');
  assert.equal(hidden, false);
  place(cold, [20000, 0, -50]);
  assert.equal(cold.prepare().commit().levelOfDetail.stage, 'geometry', 'Coast retains admitted detail');
  assert.equal(hidden, false);
  moving = false;
  assert.equal(cold.prepare().commit().levelOfDetail.stage, 'marker');
  assert.equal(hidden, true);
  place(cold, [0, 0, -1200]);
  assert.equal(cold.prepare().commit().levelOfDetail.stage, 'geometry', 'Returning to the viewport restores detail');
  assert.equal(hidden, false);


});

it('stops the zoom where one CSS pixel shows the least surface arc the imagery supports', () => {
  const build = (surfaceArcPerCssPixelRadians: number | undefined, focal: number) => {
    const view = { getComputedStyle: () => ({ perspective: `${focal}px`, perspectiveOrigin: '720px 450px' }) };
    const make = () => ({ style: {}, ownerDocument: { defaultView: view },
      getBoundingClientRect: () => ({ width: 1440, height: 900, x: 0, y: 0, left: 0, top: 0 }) });
    const dolly = { ...scene.camera.dolly, ...(surfaceArcPerCssPixelRadians === undefined ? {} : { surfaceArcPerCssPixelRadians }) };
    const options = { cameraPlan: { ...scene.camera, sceneScale: .3, dolly }, heliocentric: null,
      worldContext: { frame: { referenceFrame: 'test', epochJdTt: 1, originM: [0,0,0],
        presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 100 },
        bodyRadiusUnits: 100, kilometersPerUnit: .001, maximumExtentUnits: 1e8 },
      cameraElement: make(), viewport: { read: () => ({ bounds: make().getBoundingClientRect(), focalPixels: focal, previewTop: null, openArea: null }), subscribe: () => () => {}, destroy() {} }, stage: make(), sceneElement: { style: {} } };
    return createPerspectiveDolly(options as unknown as Parameters<typeof createPerspectiveDolly>[0], () => fixedCameraOrientation([0, -1, 0, 1, 0, 0, 0, 0, 1])).camera;
  };
  const plain = build(undefined, 1000).minimumDistance();
  // 1 mrad of arc is 0.1 units of ground on a 100-unit body: one CSS pixel covers it at an altitude of 0.1 x focal.
  assert.ok(Math.abs(build(.001, 1000).minimumDistance() - (Math.max(plain, 100 + 100))) < 10 ** -9 / 2, `${build(.001, 1000).minimumDistance()} is not close to ${Math.max(plain, 100 + 100)}`);
  assert.ok(Math.abs(build(.001, 1500).minimumDistance() - (Math.max(plain, 100 + 150))) < 10 ** -9 / 2, `${build(.001, 1500).minimumDistance()} is not close to ${Math.max(plain, 100 + 150)}`);
  // A body without a declared arc keeps the prepared radius floor.
  assert.ok(plain < 200);
});


it('uses the prepared geometry threshold before a context icon fills a body view', () => {
  const plan = scene.camera.levelOfDetail;
  assert.equal(levelOfDetailFor(plan, 13).stage, 'billboard');
  assert.equal(levelOfDetailFor(plan, 14).proxyOpacity, 1);
  assert.equal(levelOfDetailFor(plan, 17).proxyOpacity, .5);
  assert.equal(levelOfDetailFor(plan, 20).proxyOpacity, 0);
  // Saturn's 900px context image previously overrode the threshold to 450px.
  assert.equal(levelOfDetailFor(plan, 37).stage, 'geometry');
  assert.equal(levelOfDetailFor(plan, 439).proxyOpacity, 0);
});
