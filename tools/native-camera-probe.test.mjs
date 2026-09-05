import assert from "node:assert/strict";
import test from "node:test";
import { instrumentNativeCameraModule } from "./native-camera-probe.mjs";
test("the camera probe wraps every call through the actual exported factory", async () => {
  const source = 'function cameraFactory(value) { return {value}; } export { cameraFactory as createPolyCamera };';
  const recorded = []; globalThis.__nativeCameraProbe = {recordCamera: camera => recorded.push(camera)};
  try {
    const module = await import(`data:text/javascript,${encodeURIComponent(instrumentNativeCameraModule(source))}`);
    const one = module.createPolyCamera(1), two = module.createPolyCamera(2);
    assert.deepEqual(recorded, [one,two]); assert.equal(one.value,1); assert.equal(two.value,2);
  } finally { delete globalThis.__nativeCameraProbe; }
  assert.throws(()=>instrumentNativeCameraModule('export const camera = {};'),/one actual factory/);
});
