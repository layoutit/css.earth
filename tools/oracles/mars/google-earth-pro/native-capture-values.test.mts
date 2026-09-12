import assert from "node:assert/strict";
import test from "node:test";
import { appBundleForMember } from "./native-evidence.mts";
import { parseCaptureEvent, eventNumber, parseLayerManifest, parseCameraCalibration, parseBrowserRegistration, parseMapping } from "./native-capture-values.mts";

test("native event intake retains heterogeneous records without invented receipt fields", () => {
  const ready = parseCaptureEvent({ event: "ready" });
  assert.deepEqual(ready, { event: "ready" });
  const batch = parseCaptureEvent({ event: "native-input-batch-accepted", revision: 7, acceptedMonotonicSeconds: 12.5 });
  assert.equal(eventNumber(batch, "revision"), 7);
  assert.equal("acceptedInputSerial" in batch, false);
  assert.throws(() => eventNumber(batch, "acceptedInputSerial"), /must be finite/u);
  const posted = { event: "native-input-posted", id: "drag-1", revision: 7, delivered: true, sourceMonotonicSeconds: 12.5, postedMonotonicSeconds: 12.6 };
  assert.deepEqual(parseCaptureEvent(posted), posted);
  assert.throws(() => parseCaptureEvent({ ...posted, delivered: "true" }), /boolean/u);
  assert.throws(() => parseCaptureEvent({ ...posted, postedMonotonicSeconds: Infinity }), /finite/u);
});

test("native layer and registration inputs validate paths and measured geometry", () => {
  const manifest = { sourceFragmentShaderSha256: "a".repeat(64), hook: { path: "/tmp/oracle/hook.dylib" } };
  assert.deepEqual(parseLayerManifest(manifest), manifest);
  assert.throws(() => parseLayerManifest({ ...manifest, hook: { path: 3 } }), /string/u);
  const calibration = { cameraCalibration: { qualification: "measured", candidateCount: 40, camera: { latitude: 30, longitude: 45 }, selectedProbe: { score: { changedPixelRatioAboveTolerance: .2 } } } };
  assert.deepEqual(parseCameraCalibration(calibration), calibration.cameraCalibration);
  assert.throws(() => parseCameraCalibration({ cameraCalibration: { ...calibration.cameraCalibration, camera: { latitude: "30", longitude: 45 } } }), /finite/u);
  const view = { latitude: 0, longitude: 0, distance: 11_000_000, tilt: 0, azimuth: 0 };
  const registration = { qualification: "measured", viewport: { width: 1408, height: 959 }, crop: { left: 0, top: 80, width: 1408, height: 800 }, densities: [{ density: 1, captures: [{ nativeCamera: view, nativeDisc: { centerX: 704, centerY: 400, width: 600, height: 600 } }] }] };
  assert.deepEqual(parseBrowserRegistration(registration), registration);
  assert.throws(() => parseBrowserRegistration({ ...registration, crop: { ...registration.crop, width: "1408" } }), /finite/u);
  assert.throws(() => parseMapping({ ok: true, mappingCount: 1.5, reportPath: "/tmp/report.json" }), /integer/u);
});

test("native executable paths resolve to their actual app bundle", () => {
  const app = "/tmp/oracles/Google Earth Pro Mars Native Input Oracle.app";
  assert.equal(appBundleForMember(`${app}/Contents/MacOS/Google Earth`), app);
  assert.equal(appBundleForMember(`${app}/Contents/Frameworks/lib.dylib`), app);
  assert.throws(() => appBundleForMember("/tmp/src/planets/mars"), /Not a native application member/u);
});
