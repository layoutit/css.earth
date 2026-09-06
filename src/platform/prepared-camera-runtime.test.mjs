import assert from "node:assert/strict";
import test from "node:test";
import { createPreparedCameraPublisher } from "./prepared-camera-runtime.mjs";
import { selectPreparedResponsiveZoom } from "./camera-layout.mjs";

test("zoom preserves the mounted perspective and prepared layer depths", () => {
  const writes = [];
  const observedStyle = (values, name) => new Proxy(values, {
    set(target, key, value) {
      writes.push(`${name}.${key}`);
      target[key] = value;
      return true;
    },
  });
  const cameraElement = { style: observedStyle({ perspective: "750000px" }, "camera") };
  const sceneElement = { style: observedStyle({}, "scene") };
  const publish = createPreparedCameraPublisher({
    cameraElement, sceneElement, objectId: "future-moon",
    defaultZoom: 1.9, sceneScale: 0.038,
  });
  const sceneMatrix = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
  publish({ sceneMatrix, zoom: 1.9 });
  const preparedTransform = sceneElement.style.transform;
  for (const zoom of [0.42, 1.9, 4]) {
    writes.length = 0;
    publish({ sceneMatrix, zoom });
    assert.deepEqual(writes, ["camera.scale"]);
    assert.equal(cameraElement.style.perspective, "750000px");
    assert.equal(sceneElement.style.transform, preparedTransform);
    writes.length = 0;
    publish({ sceneMatrix, zoom });
    assert.deepEqual(writes, [], "idle publication must not touch retained styles");
  }
  assert.throws(() => publish({ sceneMatrix, zoom: 0 }), /state is invalid/u);
  assert.equal(sceneElement.style.transform, preparedTransform);
});

test("responsive fit does not treat user zoom as a viewport size change", () => {
  const stage = { getBoundingClientRect: () => ({ width: 1440, height: 900 }) };
  let zoom = 1.1;
  const cameraElement = {
    style: {},
    getBoundingClientRect: () => ({ width: 1440 * 0.7 * zoom / 1.1 }),
  };
  const plan = {
    logicalBodyDiameter: 460,
    responsiveFit: {
      model: "continuous-aspect-smoothstep",
      portraitBaseWidthShare: 0.34, narrowPortraitWidthShareGain: 0.08,
      landscapeWidthShareGain: 0.02, narrowPortraitAspectRatio: 0.46,
      portraitAspectRatio: 0.75, squareAspectRatio: 1,
      maximumHeightShare: 0.61, maximumMobilePreviewShare: 0.925,
      minimumZoom: 0.42, maximumZoom: 2,
    },
  };
  const publish = createPreparedCameraPublisher({
    cameraElement, sceneElement: { style: {} }, objectId: "future-moon",
    defaultZoom: 1.1,
  });
  let reference;
  for (zoom of [0.42, 1.1, 1.6607, 4]) {
    publish({ sceneMatrix: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)", zoom });
    const fit = selectPreparedResponsiveZoom({ stage, cameraElement, plan, mobile: false });
    reference ??= fit.zoom;
    assert.ok(Math.abs(fit.zoom - reference) < 1e-12);
  }
});
