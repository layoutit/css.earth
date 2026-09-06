import assert from "node:assert/strict";
import test from "node:test";
import { VIEW_LAYERS, formatViewParameters, parseViewParameters, formatSharedView, parseSharedView } from "./view-url.mjs";

const token = "ED1EKjVv3t9gpEAk4O9YP9WQv-vR66IJEclAAYBqIc_PCEJ6B0WPzS42";
// Captured by executing the source-of-truth viewUrl.ts parser itself.
const oracle = { altitudeM: 241732943586926920000, azimuthRad: 10.439326055328621,
  polarRad: -0.869375053859181, orbitRollRad: 2.1877024308722675,
  epochUnixMs: 1788658384082.8882, timeScale: 1, fovDeg: 85 };
const unpack = query => Buffer.from(new URLSearchParams(query).get("v"), "base64url");
const queryFor = bytes => `v=${Buffer.from(bytes).toString("base64url")}`;
const roundTrip = view => parseViewParameters(formatViewParameters(view));

test("the supplied Galaxio link decodes exactly and re-encodes byte for byte", () => {
  assert.deepEqual(parseViewParameters(`?v=${token}`), oracle);
  assert.equal(formatViewParameters(oracle), `v=${token}`);
  assert.deepEqual(parseViewParameters(""), {});
});

test("version1 header, big-endian doubles and omitted defaults match Galaxio", () => {
  const bytes = unpack(formatViewParameters({ altitudeM: 123.456, epochUnixMs: 1788652800123.25, timeScale: -86400 }));
  assert.equal(bytes.readUInt16BE(0), 0x1061);
  assert.equal(bytes.readDoubleBE(2), 123.456);
  assert.equal(bytes.readDoubleBE(10), 1788652800123.25);
  assert.equal(bytes.readDoubleBE(18), -86400);
  assert.equal(formatViewParameters({ timeScale: 0, azimuthRad: 0, polarRad: Math.PI / 2, orbitRollRad: 0, fovDeg: 85,
    panM: [0, 0, 0], hiddenLayers: [] }), "v=GAA");
  assert.deepEqual(parseViewParameters("?v=GAA"), { azimuthRad: 0, polarRad: Math.PI / 2, orbitRollRad: 0, timeScale: 0, fovDeg: 85 });
  assert.equal(formatViewParameters({}), "v=EAA");
});

test("raw quaternion, full tumble, submillisecond time and arbitrary numeric values retain all precision", () => {
  for (let index = 1; index <= 100; index += 1) {
    const view = { distanceM: 10 ** (-1 + index * 0.27), azimuthRad: index * Math.SQRT2,
      polarRad: -index * Math.PI / 13, orbitRollRad: index / Math.E,
      epochUnixMs: Date.UTC(2026, 8, 5) + index * Math.PI,
      panM: [index * 1.234567891234e20, -index / 3, index * Math.PI],
      lookQuaternionXyzw: [Math.sin(index), 0, 0, Math.cos(index)],
      hiddenLayers: VIEW_LAYERS, timeScale: index / 7, fovDeg: 1 + index * Math.SQRT2 };
    assert.deepEqual(roundTrip(view), view);
    assert.ok(formatViewParameters(view).slice(2).length <= 154);
  }
  for (const altitudeM of [0.1, 20, 6371000, 1.495978707e11, 3.086e19, 10 ** Math.log10(4.4e26)]) {
    assert.equal(roundTrip({ altitudeM }).altitudeM, altitudeM);
  }
  for (const timeScale of [-1e9, -86400, -0.123456789, 0, 1, 60, 86400, 31557600, 1e9]) {
    assert.equal(roundTrip({ timeScale }).timeScale, timeScale);
  }
});

test("free-look distinguishes camera semantics without modifying its saved quaternion", () => {
  const view = { lookQuaternionXyzw: [0, 0.6, 0, 0.8] };
  const orbit = formatViewParameters(view), free = formatViewParameters({ ...view, lookMode: "freeLook" });
  assert.equal(orbit.length, free.length);
  assert.equal(unpack(orbit).readUInt16BE(0) ^ unpack(free).readUInt16BE(0), 0x8000);
  assert.equal(parseViewParameters(orbit).lookMode, undefined);
  assert.equal(parseViewParameters(free).lookMode, "freeLook");
  assert.deepEqual(parseViewParameters(free).lookQuaternionXyzw, view.lookQuaternionXyzw);
  assert.throws(() => formatViewParameters({ lookMode: "freeLook" }));
});

test("malformed, repeated, noncanonical, oversized and unknown-version payloads are rejected", () => {
  for (const query of ["v=", "v=A", "v=AA", "v=AAAAA", "v=EAB", "v=EAA=", "v=EA+", "v=EA/", "v=EA!",
    "v=EAA&v=EAA", "v=EAA&rate=0", "v=IA A", "v=IAA", "v=EAAA", `v=${"A".repeat(155)}`, "altitude=20m", "unknown=1"]) {
    assert.throws(() => parseViewParameters(query), undefined, query);
  }
  const bytes = unpack(formatViewParameters({ ...oracle, lookQuaternionXyzw: [0, 0.6, 0, 0.8], panM: [1, 2, 3], hiddenLayers: ["rings"] }));
  for (let length = 0; length < bytes.length; length += 1) assert.throws(() => parseViewParameters(queryFor(bytes.subarray(0, length))));
  assert.throws(() => parseViewParameters(queryFor(Buffer.concat([bytes, Buffer.from([0])]))));
});

test("invalid values are rejected before encoding and after decoding", () => {
  for (const invalid of [{ altitudeM: -1 }, { altitudeM: 0 }, { altitudeM: Infinity }, { distanceM: NaN },
    { altitudeM: 20, distanceM: 8500000 }, { azimuthRad: Infinity }, { polarRad: 1e8 }, { orbitRollRad: NaN },
    { epochUnixMs: NaN }, { epochUnixMs: 253402300800000 }, { epochUnixMs: -62167219200001 },
    { fovDeg: 0 }, { fovDeg: 180 }, { timeScale: NaN }, { timeScale: 1e9 + 1 },
    { lookQuaternionXyzw: [0, 0, 0, 0] }, { lookQuaternionXyzw: [0, 0, 1] }, { lookQuaternionXyzw: [0, 0, 1, 1] },
    { panM: [1, 2] }, { panM: [1, 2, Infinity] }, { panM: [1, 2, 1e28] }, { hiddenLayers: ["unknown"] }, { hiddenLayers: ["rings", "rings"] }]) {
    assert.throws(() => formatViewParameters(invalid));
  }
  const scalar = unpack(formatViewParameters({ altitudeM: 20 }));
  for (const value of [NaN, Infinity, -Infinity, 0, -1, 1e30]) {
    scalar.writeDoubleBE(value, 2);
    assert.throws(() => parseViewParameters(queryFor(scalar)));
  }
  const distance = unpack(formatViewParameters({ altitudeM: 20, fovDeg: 45 }));
  distance.writeUInt16BE(0x1003, 0);
  assert.throws(() => parseViewParameters(queryFor(distance)));
  const rate = unpack(formatViewParameters({ timeScale: 60 }));
  rate.writeUInt16BE(rate.readUInt16BE(0) | 0x800, 0);
  assert.throws(() => parseViewParameters(queryFor(rate)));
  const quaternion = unpack(formatViewParameters({ lookQuaternionXyzw: [0, 0.6, 0, 0.8] }));
  quaternion.fill(0, 2);
  assert.throws(() => parseViewParameters(queryFor(quaternion)));
  const pan = unpack(formatViewParameters({ panM: [1, 2, 3] }));
  pan.writeDoubleBE(Infinity, 2);
  assert.throws(() => parseViewParameters(queryFor(pan)));
  const layers = unpack(formatViewParameters({ hiddenLayers: ["rings"] }));
  layers[2] = 64;
  assert.throws(() => parseViewParameters(queryFor(layers)));
});

const shared = () => ({
  camera: { controlPitch: -123.456789, controlYaw: 723.987654321, zoom: 0.000000333665,
    distanceKilometers: 44012288641.57663,
    pose: { schema: "cssearth-camera-pose@1",
      scene: "matrix3d(0.133333,0.933333,-0.333333,0,-0.666667,0.333333,0.666667,0,0.733333,0.133333,0.666667,0,0,0,0,1)",
      skybox: "matrix3d(0,-1,0,0,1,0,0,0,0,0,1,0,0,0,0,1)",
      sunView: "matrix3d(0,0,-1,0,0,1,0,0,1,0,0,0,0,0,0,1)" } },
  preparedEpochJdTt: 2461286.5,
  playback: { times: [12345.6789, 534.125, 98231.15], speed: 4, motionRequested: true },
});
const sharedQuery = payload => queryFor(Buffer.from(JSON.stringify(payload)));

test("shared camera roundtrip preserves all independent tumble matrices, visual times and fixed TT epoch", () => {
  const input = shared();
  const query = formatSharedView(input);
  assert.deepEqual(parseSharedView(`?${query}`), input);
  assert.ok(unpack(query).length < 1024);
  assert.notEqual(input.camera.pose.scene, input.camera.pose.skybox);
  assert.notEqual(input.camera.pose.scene, input.camera.pose.sunView);
  assert.equal(parseSharedView("") , null);
  delete input.camera.distanceKilometers;
  delete input.preparedEpochJdTt;
  input.playback = { times: [], speed: 0, motionRequested: false };
  assert.deepEqual(parseSharedView(formatSharedView(input)), input);
  input.preparedEpochJdTt = null;
  assert.deepEqual(parseSharedView(formatSharedView(input)), input);
});

test("the real camera state's nonenumerable pose survives serialization", () => {
  const input = shared(), pose = input.camera.pose;
  delete input.camera.pose;
  Object.defineProperty(input.camera, "pose", { value: pose });
  assert.equal(JSON.stringify(input.camera).includes("scene"), false, "control arm exposes the ordinary JSON state-loss bug");
  const restored = parseSharedView(formatSharedView(input));
  assert.deepEqual(restored.camera.pose, pose);
  assert.equal(restored.camera.zoom, input.camera.zoom);
});

test("shared payload validates shape, values and pure rotation matrices before encode and after decode", () => {
  const malformed = [
    value => { value.camera.zoom = 0; }, value => { value.camera.controlPitch = Infinity; },
    value => { value.camera.distanceKilometers = -1; }, value => { value.playback.times = [NaN]; },
    value => { value.playback.times = [-1]; },
    value => { value.playback.speed = -1; }, value => { value.playback.motionRequested = "true"; },
    value => { value.preparedEpochJdTt = Infinity; }, value => { value.camera.pose.schema = "wrong"; },
    value => { value.camera.pose.scene = "rotateX(45deg)"; },
    value => { value.camera.pose.skybox = "matrix3d(2,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)"; },
    value => { value.camera.pose.sunView = "matrix3d(-1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)"; },
    value => { value.camera.pose.scene = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,10,0,0,1)"; },
    value => { value.camera.pose.scene = "matrix3d(,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)"; },
    value => { value.camera.extra = 3; }, value => { value.playback.extra = true; },
  ];
  for (const mutate of malformed) { const input = shared(); mutate(input); assert.throws(() => formatSharedView(input)); }
  const payload = JSON.parse(unpack(formatSharedView(shared())).toString());
  for (const change of [value => { value.v = 2; }, value => { value.c.pop(); }, value => { value.p.push(0); },
    value => { value.c[2] = null; }, value => { value.p[0] = [null]; }, value => { value.p[0] = [-1]; }, value => { value.e = "2026-09-04"; },
    value => { value.x = 0; }, value => { value.c[6] = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,5,0,0,1)"; }]) {
    const bad = structuredClone(payload); change(bad); assert.throws(() => parseSharedView(sharedQuery(bad)));
  }
});

test("shared links reject malformed base64, noncanonical padding, truncation and payloads over4096bytes", () => {
  const query = formatSharedView(shared());
  for (const bad of ["v=", "v=A", "v=AA", "v=AAAAA", "v=EAB", `${query}=`, `${query}&v=EAA`, `${query}&extra=1`, "unknown=1", `v=${token}`]) {
    assert.throws(() => parseSharedView(bad));
  }
  const bytes = unpack(query);
  for (const length of [0, 1, 2, 10, bytes.length - 1]) assert.throws(() => parseSharedView(queryFor(bytes.subarray(0, length))));
  assert.throws(() => parseSharedView(queryFor(Buffer.concat([bytes, Buffer.from([0])]))));
  assert.throws(() => parseSharedView(queryFor(Buffer.from([0xc3, 0x28]))));
  assert.throws(() => parseSharedView(queryFor(Buffer.alloc(4097, 32))));
  const oversized = shared(); oversized.playback.times = Array.from({ length: 4096 }, () => 123.456789);
  assert.throws(() => formatSharedView(oversized));
  const input = shared();
  let canonical = formatSharedView(input).slice(2);
  while (canonical.length % 4 === 0) {
    input.playback.times.push(0);
    canonical = formatSharedView(input).slice(2);
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const alternate = canonical.slice(0, -1) + alphabet[alphabet.indexOf(canonical.at(-1)) | 1];
  assert.deepEqual(Buffer.from(alternate, "base64url"), Buffer.from(canonical, "base64url"));
  assert.throws(() => parseSharedView(`v=${alternate}`));
});
