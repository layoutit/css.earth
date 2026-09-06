import assert from "node:assert/strict";
import test from "node:test";

import { measureRetainedPlanetTrackball, measureRetainedPlanetFlyToDisc, retainedPlanetUniformScale } from "./camera-layout.mjs";
import { createUnboundedMatrixDragControls } from "./camera-input.mjs";
import {
  createGoogleEarthDragHistory,
  recordGoogleEarthDragSample,
  estimateGoogleEarthDragThrow,
  advanceGoogleEarthDragThrow,
  projectGoogleEarthTrackballDelta,
  googleEarthInteractionTrackball,
} from "./google-earth-drag-inertia.mjs";
import { projectSphereDrag, composeDragRotation, rotationFromAngularVelocity } from "./sphere-drag.mjs";
import { mountRetainedCubicSky } from "./cubic-sky-runtime.mjs";
import { PREPARED_MERCURY_STARFIELD } from "../planets/mercury/runtime/preparedStarfield.mjs";

function mountStarFixture(t, { width = 1440, height = 900 } = {}) {
  const globals = new Map(["document", "HTMLElement", "ResizeObserver"].map(name =>
    [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  let resize, disconnected = false;
  const viewport = { width, height };
  class Element {
    children = [];
    style = { setProperty(name, value) { this[name] = value; } };
    dataset = {};
    className = "";
    ownerDocument = document;
    get clientWidth() { return viewport.width; }
    get clientHeight() { return viewport.height; }
    get childElementCount() { return this.children.length; }
    appendChild(child) { this.children.push(child); }
    prepend(child) { this.children.unshift(child); }
    remove() {}
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(child.className.split(" ").includes(selector.slice(1)) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
  }
  const document = { createElement: () => new Element(),
    defaultView: { getComputedStyle: () => ({ perspective: "1000px" }) } };
  Object.assign(globalThis, { document, HTMLElement: Element, ResizeObserver: class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  } });
  t.after(() => {
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const sky = mountRetainedCubicSky({ host: new Element(), plan: PREPARED_MERCURY_STARFIELD,
    imageDensity: 1, objectId: "mercury" });
  t.after(() => sky.destroy());
  const elements = sky.starGroup.children;
  // CSS multiplies the stored radius by this shared viewport factor; cube
  // perspective transport cancels its own scale at the optical axis.
  const radius = element => parseFloat(element.style["--planet-cubic-sky-star-radius"]) *
    Number(sky.starGroup.style["--planet-cubic-sky-star-screen-factor"]);
  return { sky, elements, radius, disconnected: () => disconnected,
    resize(width, height) { Object.assign(viewport, { width, height }); resize(); } };
}

test("prepared star radii keep Galaxio's pixel ceiling on mount and resize", t => {
  const f = mountStarFixture(t);
  const originalElements = [...f.elements];
  const originalOpacities = f.elements.map(element => element.style.opacity);
  const bright = f.elements.find(element => element.dataset.name === "Sirius");
  const faint = f.elements.find(element => Number(element.dataset.magnitude) === 5);
  assert.ok(bright && faint, "the real retained catalogue exercises bright and faint points");
  for (const [width, height, faintRadius] of [[1440, 900, 1.224], [800, 600, .816],
    [390, 844, .6], [1920, 1080, 1.224]]) {
    if (width !== 1440) f.resize(width, height);
    assert.ok(Math.abs(f.radius(bright) - 1.25) < .0001, "a saturated star stays at the 1.25px cap");
    assert.ok(Math.abs(f.radius(faint) - faintRadius) < .002, "the raw faint radius scales before its pixel floor");
    assert.ok(f.elements.every(element => f.radius(element) <= 1.2501), "no retained disc exceeds the ceiling");
  }
  assert.deepEqual(f.elements, originalElements, "resizing retains the mounted stars");
  assert.deepEqual(f.elements.map(element => element.style.opacity), originalOpacities,
    "radius correction preserves the prepared exposure");
  f.sky.destroy();
  assert.equal(f.disconnected(), true);
});

test("session star radius limits survive resize and reset to the prepared ceiling", t => {
  const f = mountStarFixture(t, { width: 800, height: 600 });
  const bright = f.elements.find(element => element.dataset.name === "Sirius");
  f.sky.setStarExposure({ maxRadiusPx: 2, intensityMax: .7 });
  for (const [width, height] of [[800, 600], [1440, 900], [390, 844]]) {
    f.resize(width, height);
    assert.ok(Math.abs(f.radius(bright) - 2) < .0001, "viewport factor cannot enlarge or shrink the session ceiling");
    assert.equal(bright.style.opacity, "0.7");
  }
  f.sky.setStarExposure(null);
  assert.ok(Math.abs(f.radius(bright) - 1.25) < .0001, "reset applies the prepared ceiling at the current viewport");
  assert.equal(bright.style.opacity, "0.95");
  assert.equal(f.sky.starExposure().source, "prepared");
});

test("release publishes both launch steps once and leaves no idle clock", (t) => {
  const original = globalThis.HTMLElement;
  t.after(() => {
    if (original === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = original;
  });
  const pending = new Map();
  let next = 0;
  class Surface {
    listeners = new Map();
    style = { removeProperty() {} };
    ownerDocument = { defaultView: {
      requestAnimationFrame: callback => { pending.set(++next, callback); return next; },
      cancelAnimationFrame: id => pending.delete(id),
    } };
    captured = false;
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    removeEventListener(type) { this.listeners.delete(type); }
    setPointerCapture() { this.captured = true; }
    hasPointerCapture() { return this.captured; }
    releasePointerCapture() { this.captured = false; }
    emit(type, x, timeStamp) {
      this.listeners.get(type)?.({ type, clientX:x, clientY:300,
        pointerId:1, isPrimary:true, button:0, timeStamp, preventDefault() {} });
    }
  }
  globalThis.HTMLElement = Surface;
  const surface = new Surface(), publications = [];
  const trackball = { centerX:346.5, centerY:300, radius:127.82,
    opticalCenterX:326.5, opticalCenterY:280,
    surfaceRadius:144.65263161811257, focalLength:598.73636504 };
  let metricsReads = 0;
  const controls = createUnboundedMatrixDragControls({ inputSurface:surface,
    trackballMetrics:() => { metricsReads += 1; return { ...trackball }; },
    rotate:value => publications.push(value) });
  const tick = time => { const callbacks=[...pending.values()]; pending.clear(); callbacks.forEach(callback=>callback(time)); };
  const history = createGoogleEarthDragHistory();
  let yaw = 0, previousX = 330;
  for (const [index, [x, time]] of [[330,0],[338,35],[350,70],[368,105],[394,140]].entries()) {
    surface.emit(index === 0 ? "pointerdown" : "pointermove", x, time);
    tick(time);
    if (index > 0) {
      const expected = projectSphereDrag({ ...trackball, radius:trackball.surfaceRadius,
        previousX, previousY:300, currentX:x, currentY:300 });
      publications.at(-1).rotation.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-12));
    }
    yaw += projectGoogleEarthTrackballDelta({ ...trackball,
      previousX, previousY:300, currentX:x, currentY:300 }).yawDegrees;
    recordGoogleEarthDragSample(history,{ x,y:300,timestamp:time,pitch:0,yaw });
    previousX=x;
    assert.equal(pending.size,1);
  }
  const launch = estimateGoogleEarthDragThrow({ history,trackball,
    releaseTimestamp:140.1,frameMilliseconds:35 });
  const first = advanceGoogleEarthDragThrow({ ...launch,elapsedMilliseconds:35 });
  const before = publications.length;
  surface.emit("pointerup",394,140.1);
  assert.equal(publications.length,before+1);
  const expected = composeDragRotation(rotationFromAngularVelocity(launch.angularVelocity,
    35*Math.hypot(first.pitchDegreesPerMillisecond,first.yawDegreesPerMillisecond)/launch.initialSpeedDegreesPerMillisecond),launch.launchRotation);
  publications.at(-1).rotation.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<1e-12));
  tick(175);
  const second = advanceGoogleEarthDragThrow({ ...launch,
    pitchDegreesPerMillisecond:first.pitchDegreesPerMillisecond,
    yawDegreesPerMillisecond:first.yawDegreesPerMillisecond,elapsedMilliseconds:35 });
  assert.ok(Math.abs(publications.at(-1).controlYawDelta-second.yawDeltaDegrees)<1e-12);
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
    "crossing onto the planet does not switch a sky-start gesture to sphere drag");
  surface.emit("pointerup",330,850);
  assert.equal(publications.length,beforeSkyPress+1,
    "a sky-start gesture continues onto the planet");
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
  publications.at(-1).rotation.forEach((value,i)=>assert.ok(Math.abs(value-expectedZoomed[i])<1e-12));
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
  const { Surface } = await import("./test/orbit-fixture.mjs");
  const prior = globalThis.HTMLElement;
  globalThis.HTMLElement = Surface;
  t.after(() => {
    if (prior === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = prior;
  });
  const trackball = { centerX: 500, centerY: 400, radius: 200,
    surfaceRadius: 220, focalLength: 900, angularDegreesPerTrackballRadius: 48,
    pitchResponse: 1.3 };
  const surface = new Surface(), publications = [];
  let reads = 0;
  const controls = createUnboundedMatrixDragControls({ inputSurface: surface,
    trackballMetrics: () => { reads++; return trackball; },
    rotate: value => publications.push(value) });
  const emit = (type, x, y, timeStamp) => surface.dispatch(type, { clientX: x, clientY: y, timeStamp });
  const close = (actual, expected) => actual.forEach((value, i) =>
    assert.ok(Math.abs(value - expected[i]) < 1e-12, `${actual} differs from ${expected}`));
  const screenRotation = (dx, dy) => {
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
      const forward = publications.at(-1).rotation;
      close(forward, screenRotation(dx, dy));
      assert.equal(controls.stats().projection, "screen-plane-orbit");
      emit("pointermove", x, y, 60); surface.tick(60);
      close(composeDragRotation(publications.at(-1).rotation, forward), [0, 0, 0, 1]);
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
      const q = publications.at(-1).rotation;
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
    close(publications.at(-1).rotation, projectSphereDrag({ ...trackball,
      radius: trackball.surfaceRadius, previousX: 500, previousY: 400, currentX: 530, currentY: 420 }));
    assert.equal(controls.stats().projection, "screen-space-sphere",
      "the next planet drag uses the unchanged sphere math");
    emit("pointercancel", 530, 420, 631);
    assert.equal(surface.frames.size, 0);
  } finally { controls.destroy(); }
  assert.equal(surface.listenerCount(), 0);
});

test("wheel takes over a flight without leaving a camera callback", (t) => {
  const original = globalThis.HTMLElement;
  t.after(() => {
    if (original === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = original;
  });
  const pending = new Map();
  let next = 0;
  class Surface {
    listeners = new Map();
    style = { removeProperty() {} };
    ownerDocument = { defaultView: {
      requestAnimationFrame: callback => { pending.set(++next, callback); return next; },
      cancelAnimationFrame: id => pending.delete(id),
    } };
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    removeEventListener(type) { this.listeners.delete(type); }
  }
  globalThis.HTMLElement = Surface;
  const surface = new Surface(), publications = [];
  const controls = createUnboundedMatrixDragControls({
    inputSurface: surface,
    trackballMetrics: () => ({ centerX:500, centerY:400, radius:250,
      surfaceRadius:275, focalLength:900,
      sceneMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] }),
    surfaceFlyToState: () => ({ zoom:1, minimumZoom:0.5, maximumZoom:4 }),
    rotate: value => publications.push(value),
  });
  const tick = time => {
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
  assert.ok(publications.at(-1).zoom > 1, "flight must move before interruption");
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

test("parses only positive retained camera scales", () => {
  assert.equal(retainedPlanetUniformScale("1.25"), 1.25);
  assert.equal(retainedPlanetUniformScale("1.25 0.75"), 0.75);
  assert.equal(retainedPlanetUniformScale("none"), null);
  assert.equal(retainedPlanetUniformScale("invalid"), null);
});

test("retains the separately fitted fly-to target envelope", () => {
  const stage = {
    getBoundingClientRect: () => ({ width: 1411, height: 959 }),
  };
  const cameraElement = {
    getBoundingClientRect: () => ({
      left: 145,
      right: 1265,
      top: -423.5,
      bottom: 1221.5,
      width: 1120,
      height: 1645,
    }),
  };
  assert.deepEqual(measureRetainedPlanetFlyToDisc({
    stage,
    cameraElement,
    logicalBodyDiameter: 460,
  }), {
    centerX: 705,
    centerY: 399,
    radius: 182.56555634301915,
  });
});

test("measures the planet trackball independently of screen roll", () => {
  const stage = {
    getBoundingClientRect: () => ({ width: 1411, height: 959 }),
  };
  const boundsByRoll = [
    { left: 145, right: 1265, top: -423.5, bottom: 1221.5 },
    { left: -498.5, right: 1908.5, top: -668, bottom: 1466 },
    { left: 257.5, right: 1152.5, top: -230, bottom: 1028 },
  ];
  const measurements = boundsByRoll.map((bounds) => {
    const cameraElement = {
      ownerDocument: {
        defaultView: {
          getComputedStyle: () => ({ scale: "1.16792", perspective: "1000000px" }),
        },
      },
      getBoundingClientRect: () => ({
        ...bounds,
        width: bounds.right - bounds.left,
        height: bounds.bottom - bounds.top,
      }),
    };
    return measureRetainedPlanetTrackball({
      stage,
      cameraElement,
      logicalBodyDiameter: 460,
    });
  });
  const expected = {
    centerX: 705,
    centerY: 399,
    opticalCenterX: 705,
    opticalCenterY: 399,
    radius: 268.6216,
    surfaceRadius: 1000000 * (1 / 50) * 1.16792 /
      Math.sqrt((1000000 / 11500) ** 2 - 1),
    focalLength: 1000000 * (1 / 50) * 1.16792,
    viewportWidth: 1411,
    viewportCenterX: 705.5,
    viewportCenterY: 479.5,
  };
  assert.deepEqual(measurements, [expected, expected, expected]);
});

test("measures optical center separately from a translated and scaled body", () => {
  const stage = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
  for (const scale of [.5, 1, 2]) {
    const cameraElement = {
      offsetWidth:800, offsetHeight:600,
      getBoundingClientRect: () => ({ left:120-400*scale, right:120+400*scale,
        top:240-300*scale, bottom:240+300*scale, width:800*scale, height:600*scale }),
      ownerDocument: { defaultView: { getComputedStyle: () => ({ scale:String(scale),
        perspective:"42000px", perspectiveOrigin:"375px 315px" }) } },
    };
    const metrics = measureRetainedPlanetTrackball({ stage, cameraElement,
      logicalBodyDiameter:460, sceneScale:.022 });
    assert.equal(metrics.centerX,120);
    assert.equal(metrics.centerY,240);
    assert.equal(metrics.opticalCenterX,120-25*scale);
    assert.equal(metrics.opticalCenterY,240+15*scale);
  }
});

test("uses the rendered radius without changing the accepted throw envelope", () => {
  const stage = { getBoundingClientRect: () => ({ width: 1408, height: 959 }) };
  const cameraElement = {
    getBoundingClientRect: () => ({ left: 0, right: 1408, top: 0, bottom: 959 }),
    ownerDocument: { defaultView: { getComputedStyle: () => ({ scale: "1.16792", perspective: "1000000px" }) } },
  };
  const metrics = measureRetainedPlanetTrackball({ stage, cameraElement,
    logicalBodyDiameter: 460, sceneScale: 0.022 });
  assert.equal(metrics.radius, 268.6216);
  assert.ok(Math.abs(metrics.surfaceRadius - 295.48376 / Math.sqrt(1 - .0115 ** 2)) < 1e-9);
  assert.throws(() => measureRetainedPlanetTrackball({ stage, cameraElement,
    logicalBodyDiameter: 460, sceneScale: 0 }));
});

test("input rays use the rendered perspective at different camera distances", () => {
  for (const distance of [2.5, 4.25821590423584, 8]) {
    for (const scale of [.4, .8, 1.2]) {
      const depthRadius = 11500, perspective = depthRadius * distance;
      const stage = { getBoundingClientRect: () => ({ width: 693, height: 600 }) };
      const cameraElement = {
        getBoundingClientRect: () => ({ left: 0, right: 693, top: 0, bottom: 600 }),
        ownerDocument: { defaultView: { getComputedStyle: () => ({ scale: String(scale), perspective: `${perspective}px` }) } },
      };
      const metrics = measureRetainedPlanetTrackball({ stage, cameraElement,
        logicalBodyDiameter: 460, sceneScale: .022 });
      assert.ok(Math.abs(Math.hypot(1, metrics.focalLength / metrics.surfaceRadius) - distance) < 1e-12);
    }
  }
});

test("camera scaling keeps input rays on the prepared projection at every zoom", () => {
  const stage = { getBoundingClientRect: () => ({ width: 1600, height: 900 }) };
  const perspective = 1000000;
  const depthRadius = 460 * 50 / 2;
  let reference;
  for (const zoom of [0.42, 1.1, 1.6607, 4]) {
    const scale = 0.88 * zoom / 1.1;
    const cameraElement = {
      getBoundingClientRect: () => ({ left: 0, right: 1600, top: 0, bottom: 900 }),
      ownerDocument: { defaultView: { getComputedStyle: () => ({
        scale: String(scale), perspective: `${perspective}px`,
      }) } },
    };
    const metrics = measureRetainedPlanetTrackball({
      stage, cameraElement, logicalBodyDiameter: 460, sceneScale: 0.022,
    });
    const distance = Math.hypot(1, metrics.focalLength / metrics.surfaceRadius);
    assert.ok(Math.abs(distance - perspective / depthRadius) < 1e-10);
    reference ??= { radius: metrics.surfaceRadius, zoom };
    assert.ok(Math.abs(metrics.surfaceRadius / reference.radius -
      zoom / reference.zoom) < 1e-10);
  }
});

test("Google Earth interaction rays use the viewport FOV without changing prepared rendering", () => {
  for (const renderFocalLength of [600, 12000, 20000]) {
    const measured = { viewportWidth: 693, focalLength: renderFocalLength,
      centerX:553.5, centerY:300, opticalCenterX:553.5, opticalCenterY:300,
      surfaceRadius:145, radius:140 };
    const interaction = googleEarthInteractionTrackball(measured);
    assert.ok(Math.abs(interaction.focalLength - 600.1556396484375) < .00005,
      "input projection must match the observed native 693px viewport");
    assert.equal(interaction.renderFocalLength, renderFocalLength);
    assert.equal(measured.focalLength, renderFocalLength);
    assert.equal(interaction.surfaceRadius, measured.surfaceRadius);
  }
});
