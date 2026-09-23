import * as runtimePolicy from "../../site/runtime-policy.mts";
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import { createUnboundedMatrixDragControls } from "../renderers/css/dist/platform/camera-input.js";
import {
  createDragHistory,
  recordDragSample,
  estimateDragThrow,
  advanceDragThrow,
  projectTrackballDelta,
  interactionTrackball,
} from "./trackball-drag-inertia.mts";
import { projectSphereDrag, composeDragRotation, rotationFromAngularVelocity } from "@cssearth/engine";
import type { TrackballMetrics, CameraDelta, Quaternion } from "../renderers/css/navigation/types.ts";

type Rotate = Parameters<typeof createUnboundedMatrixDragControls>[0]["rotate"];
type Publication = Parameters<Rotate>[0];
type AnimationCallback = (time: number) => void;
/** The renderer validates HTMLElement with instanceof; this is the one test-only native boundary. */
function nativeElement<T>(element: T): HTMLElement {
  return element as unknown as HTMLElement;
}

function completeTrackball(metrics: Omit<TrackballMetrics, "viewportWidth">): TrackballMetrics {
  return { ...metrics, viewportWidth: 693 };
}

function lastPublication(publications: readonly Publication[]): Publication {
  const publication = publications.at(-1);
  assert.ok(publication !== undefined, "the input event published a camera update");
  return publication;
}

function requiredThrow<T>(value: T | null): T {
  assert.ok(value !== null, "the recorded drag produces a throw");
  return value;
}

test("release publishes both launch steps once and leaves no idle clock", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
  t.after(() => {
    if (original === undefined) Reflect.deleteProperty(globalThis, "HTMLElement");
    else Object.defineProperty(globalThis, "HTMLElement", original);
  });
  const pending = new Map<number, AnimationCallback>();
  let next = 0;
  class Surface {
    dispatchEvent(_event: Event): boolean { return true; }
    listeners = new Map<string, (event: { type: string; clientX: number; clientY: number; pointerId: number; isPrimary: boolean; button: number; timeStamp: number; preventDefault(): void }) => void>();
    style = { removeProperty() {} };
    ownerDocument = { defaultView: {
      requestAnimationFrame: (callback: AnimationCallback) => { pending.set(++next, callback); return next; },
      cancelAnimationFrame: (id: number) => pending.delete(id),
    } };
    captured = false;
    addEventListener(type: string, listener: (event: { type: string; clientX: number; clientY: number; pointerId: number; isPrimary: boolean; button: number; timeStamp: number; preventDefault(): void }) => void) { this.listeners.set(type, listener); }
    removeEventListener(type: string) { this.listeners.delete(type); }
    setPointerCapture() { this.captured = true; }
    hasPointerCapture() { return this.captured; }
    releasePointerCapture() { this.captured = false; }
    emit(type: string, x: number, timeStamp: number) {
      this.listeners.get(type)?.({ type, clientX:x, clientY:300,
        pointerId:1, isPrimary:true, button:0, timeStamp, preventDefault() {} });
    }
  }
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: Surface });
  const surface = new Surface(), publications: Publication[] = [];
  const trackball: TrackballMetrics = { centerX:346.5, centerY:300, radius:127.82,
    opticalCenterX:326.5, opticalCenterY:280,
    surfaceRadius:144.65263161811257, focalLength:598.73636504, viewportWidth: 693 };
  let metricsReads = 0;
  const controls = createUnboundedMatrixDragControls({ runtimePolicy, inputSurface:nativeElement(surface),
    trackballMetrics:() => { metricsReads += 1; return { ...trackball }; },
    rotate:value => publications.push(value) });
  const tick = (time: number) => { const callbacks=[...pending.values()]; pending.clear(); callbacks.forEach(callback=>callback(time)); };
  const history = createDragHistory();
  let yaw = 0, previousX = 330;
  for (const [index, [x, time]] of [[330,0],[338,35],[350,70],[368,105],[394,140]].entries()) {
    surface.emit(index === 0 ? "pointerdown" : "pointermove", x, time);
    tick(time);
    if (index > 0) {
      const expected = projectSphereDrag({ ...trackball, radius:trackball.surfaceRadius,
        previousX, previousY:300, currentX:x, currentY:300 });
      lastPublication(publications).rotation?.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-12));
    }
    yaw += projectTrackballDelta({ ...trackball,
      previousX, previousY:300, currentX:x, currentY:300 }).yawDegrees;
    recordDragSample(history,{ x,y:300,timestamp:time,pitch:0,yaw });
    previousX=x;
    assert.equal(pending.size,1);
  }
  const launch = requiredThrow(estimateDragThrow({ history,trackball,
    releaseTimestamp:140.1,frameMilliseconds:35 }));
  const first = advanceDragThrow({ ...launch,elapsedMilliseconds:35 });
  const before = publications.length;
  surface.emit("pointerup",394,140.1);
  assert.equal(publications.length,before+1);
  const expected = composeDragRotation(rotationFromAngularVelocity(launch.angularVelocity,
    35*Math.hypot(first.pitchDegreesPerMillisecond,first.yawDegreesPerMillisecond)/launch.initialSpeedDegreesPerMillisecond),launch.launchRotation);
  lastPublication(publications).rotation?.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<1e-12));
  tick(175);
  const second = advanceDragThrow({ ...launch,
    pitchDegreesPerMillisecond:first.pitchDegreesPerMillisecond,
    yawDegreesPerMillisecond:first.yawDegreesPerMillisecond,elapsedMilliseconds:35 });
  assert.ok(Math.abs(lastPublication(publications).controlYawDelta-second.yawDeltaDegrees)<1e-12);
  surface.emit("pointerdown",394,180);
  assert.equal(controls.stats().active,false,"press stops the existing coast");
  const beforeHold = publications.length;
  tick(210);tick(245);
  assert.equal(publications.length,beforeHold,"a held press cannot publish another coast step");
  surface.emit("pointerup",394,246);
  assert.equal(pending.size,0,"a click leaves no cadence or inertia callback");
  const beforeTinyDrag = publications.length;
  surface.emit("pointerdown",330,260);
  surface.emit("pointermove",330,261);
  assert.equal(publications.length,beforeTinyDrag,"stationary pointer is not a drag");
  surface.emit("pointermove",331,270); tick(270);
  assert.equal(publications.length,beforeTinyDrag+1,"one pixel moves on the next frame, without a five-pixel dead zone");
  assert.equal(controls.stats().activeMode,"drag");
  surface.emit("pointerup",331,280);
  assert.equal(pending.size,0,"a tiny drag does not manufacture coast");
  const beforeRoundedRelease = publications.length;
  surface.emit("pointerdown",330,300);
  tick(300);
  surface.emit("pointermove",338,335);
  tick(335);
  surface.emit("pointermove",350,370);
  tick(370);
  surface.emit("pointerup",350.0000002,570);
  assert.equal(publications.length,beforeRoundedRelease+2,
    "sub-pixel release transport noise is not applied as movement");
  assert.equal(controls.stats().starts,1,
    "sub-pixel release transport noise cannot refresh a stale throw");
  assert.equal(pending.size,0,"a stale release leaves no inertia callback");
  const beforeMovedRelease = publications.length;
  surface.emit("pointerdown",330,600);
  tick(600);
  surface.emit("pointermove",338,635);
  tick(635);
  surface.emit("pointermove",350,670);
  tick(670);
  surface.emit("pointerup",368,705);
  assert.equal(publications.length,beforeMovedRelease+3,
    "release launches from consumed moves without publishing its own location");
  assert.equal(controls.stats().starts,2,
    "two consumed movements can launch a throw without a release-position sample");
  const beforeSkyPress = publications.length;
  const skyX = trackball.centerX + trackball.surfaceRadius + 1;
  surface.emit("pointerdown",skyX,710);
  assert.equal(controls.stats().activeMode,"idle",
    "a sky press interrupts the existing coast");
  assert.equal(controls.stats().pendingPointer,true,
    "a sky press reserves an orbit drag");
  assert.equal(surface.captured,true,"sky input captures the pointer");
  assert.equal(controls.stats().projection,"screen-plane-orbit");
  surface.emit("pointermove",330,720); tick(720);
  assert.equal(controls.stats().projection,"screen-plane-orbit",
    "crossing onto the body does not switch a sky-start gesture to sphere drag");
  surface.emit("pointerup",330,850);
  assert.equal(publications.length,beforeSkyPress+1,
    "a sky-start gesture continues onto the body");
  assert.equal(pending.size,0,"a paused sky release leaves no callback");
  surface.emit("pointerdown",skyX,750);
  surface.emit("pointermove",skyX+1,760); tick(760);
  surface.emit("pointerup",skyX+1,770);
  assert.equal(publications.length,beforeSkyPress+2,
    "one-pixel radial sky input moves instead of sticking to the rim");
  assert.equal(pending.size,0,"released sky input schedules no idle work");
  const beforeRimDrag = publications.length;
  const rimX = trackball.centerX + trackball.surfaceRadius - 1;
  surface.emit("pointerdown",rimX,800);
  assert.equal(controls.stats().projection,"screen-space-sphere",
    "a new planet press retains the original sphere mapping");
  surface.emit("pointermove",skyX,810); tick(810);
  const atRim = publications.length;
  assert.equal(atRim,beforeRimDrag+1,
    "a drag starting inside the disc continues across its edge");
  surface.emit("pointermove",skyX+20,820); tick(820);
  assert.equal(publications.length,atRim+1,
    "a captured planet drag keeps moving outside the disc");
  surface.emit("pointerup",skyX+20,1000);
  assert.equal(pending.size,0,"a paused edge release leaves no animation callback");
  surface.emit("pointerdown",330,1100);
  const readsAtPress = metricsReads;
  for (const [x,time] of [[342,1130],[357,1160],[380,1190]]) {
    surface.emit("pointermove",x,time); tick(time);
  }
  assert.equal(metricsReads,readsAtPress,"ordinary drag reuses its measured projection");
  trackball.radius *= 2;
  trackball.surfaceRadius *= 2;
  trackball.focalLength *= 2;
  controls.invalidateTrackball(); controls.invalidateTrackball();
  tick(1200);
  surface.emit("pointermove",380,1201);
  assert.equal(metricsReads,readsAtPress,"zoom and stationary input cause no extra layout read");
  const startsBeforeZoomedRelease = controls.stats().starts;
  surface.emit("pointermove",381,1210); tick(1210);
  assert.equal(metricsReads,readsAtPress+1,"the next movement measures the current zoom once");
  const expectedZoomed = projectSphereDrag({ ...trackball,radius:trackball.surfaceRadius,
    previousX:380,previousY:300,currentX:381,currentY:300 });
  lastPublication(publications).rotation?.forEach((value,i)=>assert.ok(Math.abs(value-expectedZoomed[i])<1e-12));
  surface.emit("pointerup",381,1211);
  assert.equal(controls.stats().starts,startsBeforeZoomedRelease,
    "movement from before zoom cannot launch a new throw on release");
  assert.equal(pending.size,0);
  // The native slow-horizontal corpus consumes the drag samples but rejects
  // the moved mouse-up as a throw. Its last drag pose remains on screen.
  surface.emit("pointerdown",330,1400);
  for (const [x,time] of [[340,1435],[350,1470],[360,1505]]) {
    surface.emit("pointermove",x,time); tick(time);
  }
  const beforeRejectedRelease = publications.length;
  const startsBeforeRejectedRelease = controls.stats().starts;
  surface.emit("pointerup",370,1540);
  assert.equal(publications.length,beforeRejectedRelease,
    "a non-launching release must retain the last consumed drag pose");
  assert.equal(controls.stats().starts,startsBeforeRejectedRelease);
  assert.equal(pending.size,0);
  surface.emit("pointerdown",330,1600);
  for (const [x,time] of [[338,1635],[350,1670],[368,1705]]) {
    surface.emit("pointermove",x,time); tick(time);
  }
  const beforeStaleMovedRelease = publications.length;
  surface.emit("pointerup",394,1900);
  assert.equal(publications.length,beforeStaleMovedRelease,
    "a moved release cannot refresh a paused drag or manufacture a throw");
  assert.equal(controls.stats().starts,startsBeforeRejectedRelease);
  assert.equal(pending.size,0);
  // Three equal movements reject a throw. The final two arrive before a
  // frame and are discarded by the native release path.
  surface.emit("pointerdown",330,2000); tick(2000);
  surface.emit("pointermove",340,2035); tick(2035);
  const lastPresented = publications.length;
  surface.emit("pointermove",350,2070);
  surface.emit("pointermove",360,2071);
  assert.equal(publications.length,lastPresented,"moves await the camera frame");
  surface.emit("pointerup",360,2072); tick(2105);
  assert.equal(publications.length,lastPresented,"a rejected release drops unpublished motion");
  assert.equal(pending.size,0);
  controls.destroy();
  assert.equal(surface.listeners.size,0);
});

test("sky orbit keeps screen axes through reversals, limb crossings and release", async t => {
  const { Surface } = await import("./test/orbit-fixture.mts");
  const prior = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: Surface });
  t.after(() => {
    if (prior === undefined) Reflect.deleteProperty(globalThis, "HTMLElement");
    else Object.defineProperty(globalThis, "HTMLElement", prior);
  });
  const trackball = { centerX: 500, centerY: 400, radius: 200,
    surfaceRadius: 220, focalLength: 900, angularDegreesPerTrackballRadius: 48,
    pitchResponse: 1.3 };
  const surface = new Surface(), publications: Publication[] = [];
  let reads = 0;
  const controls = createUnboundedMatrixDragControls({ runtimePolicy, inputSurface: nativeElement(surface),
    trackballMetrics: () => { reads++; return completeTrackball({ ...trackball }); },
    rotate: value => publications.push(value) });
  const emit = (type: string, x: number, y: number, timeStamp: number) => surface.dispatch(type, { clientX: x, clientY: y, timeStamp });
  const close = (actual: readonly number[], expected: readonly number[]) => actual.forEach((value, i) =>
    assert.ok(Math.abs(value - expected[i]) < 1e-12, `${actual} differs from ${expected}`));
  const screenRotation = (dx: number, dy: number) => {
    const radiansPerPixel = 48 / 200 * Math.PI / 180;
    return rotationFromAngularVelocity([-dy * radiansPerPixel, dx * radiansPerPixel, 0], 1);
  };
  try {
    for (const [x, y, dx, dy] of [[900, 400, 40, 0], [900, 400, 0, 40],
      [100, 100, -20, 30], [900, 400, -400, 0]]) {
      controls.stop();
      emit("pointerdown", x, y, 0); surface.tick(0);
      const readsAtPress = reads;
      emit("pointermove", x + dx, y + dy, 30); surface.tick(30);
      const forward = lastPublication(publications).rotation ?? [];
      close(forward, screenRotation(dx, dy));
      assert.equal(controls.stats().projection, "screen-plane-orbit");
      emit("pointermove", x, y, 60); surface.tick(60);
      close(composeDragRotation(lastPublication(publications).rotation ?? [], forward), [0, 0, 0, 1]);
      assert.equal(reads, readsAtPress, "sky movement does not add layout reads");
      emit("pointerup", x, y, 200);
      assert.equal(surface.frames.size, 0, "paused release leaves no callbacks");
    }
    // Radial movement would be zero under the planet's rim-clamped projection.
    emit("pointerdown", 900, 400, 300); surface.tick(300);
    for (const [x, time] of [[908, 335], [920, 370], [938, 405]]) {
      emit("pointermove", x, 400, time); surface.tick(time);
    }
    emit("pointerup", 938, 400, 405.1);
    assert.equal(controls.stats().activeMode, "inertia");
    assert.equal(controls.stats().projection, "screen-plane-orbit");
    for (const time of [440, 475]) {
      surface.tick(time);
      const q = lastPublication(publications).rotation ?? [];
      assert.ok(q[1] > 0, "release continues the same radial orbit direction");
      close([q[0], q[2]], [0, 0]);
    }
    emit("pointerdown", 900, 400, 480);
    const stopped = publications.length;
    surface.tick(500);
    assert.equal(publications.length, stopped, "a sky click stops the coast");
    emit("pointerup", 900, 400, 501);
    assert.equal(surface.frames.size, 0);
    emit("pointerdown", 500, 400, 600);
    emit("pointermove", 530, 420, 630); surface.tick(630);
    close(lastPublication(publications).rotation ?? [], projectSphereDrag({ ...trackball,
      radius: trackball.surfaceRadius, previousX: 500, previousY: 400, currentX: 530, currentY: 420 }));
    assert.equal(controls.stats().projection, "screen-space-sphere",
      "the next planet drag uses the unchanged sphere math");
    emit("pointercancel", 530, 420, 631);
    assert.equal(surface.frames.size, 0);
  } finally { controls.destroy(); }
  assert.equal(surface.listenerCount(), 0);
});

test("wheel takes over a flight without leaving a camera callback", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
  t.after(() => {
    if (original === undefined) Reflect.deleteProperty(globalThis, "HTMLElement");
    else Object.defineProperty(globalThis, "HTMLElement", original);
  });
  const pending = new Map<number, AnimationCallback>();
  let next = 0;
  class Surface {
    dispatchEvent(_event: Event): boolean { return true; }
    listeners = new Map();
    style = { removeProperty() {} };
    ownerDocument = { defaultView: {
      requestAnimationFrame: (callback: AnimationCallback) => { pending.set(++next, callback); return next; },
      cancelAnimationFrame: (id: number) => pending.delete(id),
    } };
    addEventListener(type: string, callback: (event: { button?: number; detail?: number; clientX?: number; clientY?: number; timeStamp?: number; deltaY?: number; preventDefault(): void }) => void) { this.listeners.set(type, callback); }
    removeEventListener(type: string) { this.listeners.delete(type); }
  }
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: Surface });
  const surface = new Surface(), publications: Publication[] = [];
  const controls = createUnboundedMatrixDragControls({ runtimePolicy,
    inputSurface: nativeElement(surface),
    trackballMetrics: () => ({ centerX:500, centerY:400, radius:250,
      surfaceRadius:275, focalLength:900,
      viewportWidth: 693, sceneMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] }),
    surfaceFlyToState: () => ({ zoom:1, minimumZoom:0.5, maximumZoom:4 }),
    rotate: value => publications.push(value),
  });
  const tick = (time: number) => {
    const callbacks = [...pending.values()]; pending.clear();
    callbacks.forEach(callback => callback(time));
  };
  surface.listeners.get("mousedown")({ button:0, detail:2, clientX:560, clientY:420,
    timeStamp:0, preventDefault() {} });
  assert.equal(controls.stats().surfaceFlyTo.starts,1,"second press starts the flight before release");
  surface.listeners.get("dblclick")({ button:0, clientX:560, clientY:420,
    timeStamp:40, preventDefault() {} });
  assert.equal(controls.stats().surfaceFlyTo.starts,1,"the release's dblclick does not restart the flight");
  tick(0); tick(800);
  assert.equal(controls.stats().activeMode, "fly-to");
  const flightPublication = lastPublication(publications);
  assert.ok(flightPublication.zoom !== undefined && flightPublication.zoom > 1, "flight must move before interruption");
  surface.listeners.get("wheel")({ deltaY:0 });
  assert.equal(pending.size, 1, "horizontal-only wheel does not start zoom or stop flight");
  surface.listeners.get("wheel")({ deltaY:40 });
  const atWheel = publications.length;
  assert.equal(pending.size, 0, "wheel cancels the scheduled flight frame immediately");
  tick(1000); tick(5000);
  assert.equal(publications.length, atWheel, "canceled flight cannot publish again");
  assert.equal(controls.stats().surfaceFlyTo.cancels, 1);
  assert.equal(controls.stats().surfaceFlyTo.completions, 0);
  assert.deepEqual(controls.stats().lastInterruption, { from:"fly-to", to:"wheel" });
  controls.destroy();
});

test("Trackball interaction rays use the viewport FOV without changing prepared rendering", () => {
  for (const renderFocalLength of [600, 12000, 20000]) {
    const measured = { viewportWidth: 693, focalLength: renderFocalLength,
      centerX:553.5, centerY:300, opticalCenterX:553.5, opticalCenterY:300,
      surfaceRadius:145, radius:140 };
    const interaction = interactionTrackball(measured);
    assert.ok(Math.abs(interaction.focalLength - 600.1556396484375) < .00005,
      "input projection must match the observed native 693px viewport");
    assert.equal(interaction.renderFocalLength, renderFocalLength);
    assert.equal(measured.focalLength, renderFocalLength);
    assert.equal(interaction.surfaceRadius, measured.surfaceRadius);
  }
});
