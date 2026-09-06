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
const legacyPayload = input => ({ v: 1,
  c: [input.camera.controlPitch, input.camera.controlYaw, input.camera.zoom, input.camera.distanceKilometers ?? null,
    input.camera.pose.scene, input.camera.pose.skybox, input.camera.pose.sunView],
  p: [input.playback.times, input.playback.speed, input.playback.motionRequested],
  ...(input.preparedEpochJdTt === undefined ? {} : { e: input.preparedEpochJdTt }) });

test("shared camera roundtrip preserves all independent tumble matrices, visual times and fixed TT epoch", () => {
  const input = shared();
  const query = formatSharedView(input);
  assert.deepEqual(parseSharedView(`?${query}`), input);
  assert.equal(unpack(query).readUInt16BE(0) >>> 12, 2);
  assert.ok(query.length < 350, `compact query has ${query.length} characters`);
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
  const payload = legacyPayload(shared());
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

// Captured from actual off-center pointer drags and wheel input, including
// the prepared sky registration's small nonorthogonal rounding residual.
const browserView = () => ({
  camera: { controlPitch: -8.344334516874545, controlYaw: 15.28337057607725,
    zoom: 0.3768049762789915, distanceKilometers: 39051.89269356484,
    pose: { schema: "cssearth-camera-pose@1",
      scene: "matrix3d(0.951326031283,0.251717501181,-0.177811928175,0,0.137478049482,0.169758540011,0.975849283447,0,0.275823436483,-0.952796063013,0.126890087063,0,0,0,0,1)",
      skybox: "matrix3d(-0.943384469895,-0.277813597555,0.181232789273,0,-0.222274708501,0.935020521597,0.276279625676,0,-0.246210605565,0.220354464937,-0.943834784798,0,0,0,0,1)",
      sunView: "matrix3d(0.951326031283,0.251717501181,0.177811928175,0,-0.071981591576,0.74248809011,-0.66598054515,0,-0.29966219761,0.620765443339,0.724467274402,0,0,0,0,1)" } },
  preparedEpochJdTt: 2461286.5,
  playback: { times: [216.72099993674453], speed: 1, motionRequested: false },
});
const matrixValues = matrix => matrix.slice(9, -1).split(",").map(Number);
function assertSharedPrecision(actual, expected) {
  assert.deepEqual(actual.playback, expected.playback);
  assert.equal(actual.preparedEpochJdTt, expected.preparedEpochJdTt);
  for (const key of ["controlPitch", "controlYaw", "zoom", "distanceKilometers"]) assert.equal(actual.camera[key], expected.camera[key]);
  for (const key of ["scene", "skybox", "sunView"]) {
    const a = matrixValues(actual.camera.pose[key]), b = matrixValues(expected.camera.pose[key]);
    assert.ok(Math.max(...a.map((value, index) => Math.abs(value - b[index]))) <= 1e-10, `${key} changed orientation`);
  }
}

test("actual legacy Mercury link shrinks from835 to251token characters with no drift over100roundtrips", () => {
  const original = browserView(), legacy = sharedQuery(legacyPayload(original));
  assert.equal(legacy.slice(2).length, 835);
  assert.deepEqual(parseSharedView(legacy), original, "previous JSON links must retain their original meaning");
  const compact = formatSharedView(parseSharedView(legacy));
  assert.equal(compact.slice(2).length, 251);
  assert.ok(compact.length < 350);
  assert.equal(unpack(compact).readUInt16BE(0) & 0xe0, 0x40, "only the rounded sky registration needs the nine-component escape");
  let next = original;
  for (let index = 0; index < 100; index += 1) {
    next = parseSharedView(formatSharedView(next));
    assertSharedPrecision(next, original);
  }
});

test("binary defaults, field ordering, Float64 precision and all three quaternion slots are explicit", () => {
  const input = shared();
  delete input.camera.distanceKilometers;
  delete input.preparedEpochJdTt;
  input.playback = { times: [], speed: 1, motionRequested: false };
  for (const field of ["scene", "skybox", "sunView"]) input.camera.pose[field] = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
  const bytes = unpack(formatSharedView(input));
  assert.equal(bytes.length, 124);
  assert.equal(bytes.readUInt16BE(0), 0x2000);
  assert.equal(bytes.readDoubleBE(2), input.camera.controlPitch);
  assert.equal(bytes.readDoubleBE(10), input.camera.controlYaw);
  assert.equal(bytes.readDoubleBE(18), input.camera.zoom);
  for (const offset of [26, 58, 90]) {
    assert.deepEqual([0, 8, 16, 24].map(delta => bytes.readDoubleBE(offset + delta)), [0, 0, 0, 1]);
  }
  assert.equal(bytes.readUInt16BE(122), 0);
  assert.deepEqual(parseSharedView(queryFor(bytes)), input);
});

test("quaternion branches retain independent axis-angle rotations including every180degree axis", () => {
  // Independent Rodrigues formula: column-major CSS matrices from axis-angle,
  // without importing or copying the codec's quaternion conversion.
  const rotation = (axis, radians) => {
    const length = Math.hypot(...axis), [x, y, z] = axis.map(value => value / length);
    const c = Math.cos(radians), s = Math.sin(radians), t = 1 - c;
    return `matrix3d(${[t*x*x+c, t*x*y+s*z, t*x*z-s*y, 0,
      t*x*y-s*z, t*y*y+c, t*y*z+s*x, 0, t*x*z+s*y, t*y*z-s*x, t*z*z+c, 0,
      0, 0, 0, 1].map(value => Math.abs(value) < 1e-15 ? 0 : value).join(",")})`;
  };
  for (let index = 0; index < 120; index += 1) {
    const input = shared(), axes = index < 3 ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] :
      [[Math.sin(index), Math.cos(index * 3), Math.sin(index * 7)], [1, index / 7, -3], [-2, 3, index / 9]];
    for (const [slot, field] of ["scene", "skybox", "sunView"].entries()) input.camera.pose[field] = rotation(axes[slot], index < 3 ? Math.PI : index / 13 + slot / 7);
    const query = formatSharedView(input);
    assert.equal(unpack(query).readUInt16BE(0) & 0xe0, 0, "proper rotations use quaternion storage");
    assertSharedPrecision(parseSharedView(query), input);
  }
});

test("rounded nonorthogonal rotations retain all nine values and still fit under500characters", () => {
  const input = shared();
  input.camera.pose.skybox = input.camera.pose.scene;
  input.camera.pose.sunView = input.camera.pose.scene;
  const query = formatSharedView(input);
  assert.equal(unpack(query).readUInt16BE(0) & 0xe0, 0xe0);
  assert.ok(query.length < 500);
  assert.deepEqual(parseSharedView(query), input);
});

test("binary decoder rejects reserved bits, unknown versions, invalid quaternions and everytruncation", () => {
  const bytes = unpack(formatSharedView(browserView()));
  for (let length = 0; length < bytes.length; length += 1) assert.throws(() => parseSharedView(queryFor(bytes.subarray(0, length))), undefined, `truncation at ${length}`);
  for (const bit of [0x100, 0x200, 0x400, 0x800]) {
    const bad = Buffer.from(bytes); bad.writeUInt16BE(bad.readUInt16BE(0) | bit, 0);
    assert.throws(() => parseSharedView(queryFor(bad)));
  }
  for (const flags of [0x3047, 0x2045]) {
    const bad = Buffer.from(bytes); bad.writeUInt16BE(flags, 0);
    assert.throws(() => parseSharedView(queryFor(bad)));
  }
  // Real fixture: header, three controls, distance and epoch precede scene q.
  for (const value of [NaN, Infinity, -Infinity, 2, 0.5]) {
    const bad = Buffer.from(bytes); bad.writeDoubleBE(value, 42);
    assert.throws(() => parseSharedView(queryFor(bad)), undefined, `invalid quaternion component ${value}`);
  }
  const zero = Buffer.from(bytes); zero.fill(0, 42, 74);
  assert.throws(() => parseSharedView(queryFor(zero)));
  const invalidMatrix = Buffer.from(bytes); invalidMatrix.writeDoubleBE(2, 74);
  assert.throws(() => parseSharedView(queryFor(invalidMatrix)));
  const count = Buffer.from(bytes); count.writeUInt16BE(65535, bytes.length - 10);
  assert.throws(() => parseSharedView(queryFor(count)));
  const negativeTime = Buffer.from(bytes); negativeTime.writeDoubleBE(-1, bytes.length - 8);
  assert.throws(() => parseSharedView(queryFor(negativeTime)));
});

const minimalView = () => {
  const full = browserView();
  return { ...full, camera: { distanceKilometers: full.camera.distanceKilometers,
    pose: { schema: "cssearth-camera-pose@2", scene: full.camera.pose.scene } } };
};
function assertMinimalPrecision(actual, expected) {
  assert.deepEqual(Object.keys(actual.camera).sort(), ["distanceKilometers", "pose"]);
  assert.deepEqual(Object.keys(actual.camera.pose).sort(), ["scene", "schema"]);
  assert.equal(actual.camera.pose.schema, "cssearth-camera-pose@2");
  assert.equal(actual.camera.distanceKilometers, expected.camera.distanceKilometers);
  assert.deepEqual(actual.playback, expected.playback);
  assert.equal(actual.preparedEpochJdTt, expected.preparedEpochJdTt);
  const a = matrixValues(actual.camera.pose.scene), b = matrixValues(expected.camera.pose.scene);
  assert.ok(Math.max(...a.map((value, index) => Math.abs(value - b[index]))) <= 1e-10);
}

test("minimal physical v3 saves one orientation and distance in70characters without redundant camera fields", () => {
  const original = minimalView(), query = formatSharedView(original), bytes = unpack(query);
  assert.equal(query.slice(2).length, 70);
  assert.equal(bytes.readUInt16BE(0) >>> 12, 3);
  assert.equal(bytes.length, 52);
  assert.equal(bytes.readDoubleBE(2), original.camera.distanceKilometers);
  assert.equal(bytes.readDoubleBE(10), original.preparedEpochJdTt);
  let current = original;
  for (let index = 0; index < 100; index += 1) {
    current = parseSharedView(formatSharedView(current));
    assertMinimalPrecision(current, original);
    assert.ok(formatSharedView(current).slice(2).length <= 80);
  }
  original.playback.speed = 4; original.playback.motionRequested = true;
  assert.equal(formatSharedView(original).slice(2).length, 80);
  assertMinimalPrecision(parseSharedView(formatSharedView(original)), original);
  for (const epoch of [undefined, null]) {
    original.preparedEpochJdTt = epoch;
    original.playback = { times: [], speed: 0, motionRequested: false };
    assertMinimalPrecision(parseSharedView(formatSharedView(original)), original);
  }
});

test("smallest-three encoding covers every omitted component and exact rounded-matrix fallback", () => {
  const scenes = [
    "matrix3d(1,0,0,0,0,-1,0,0,0,0,-1,0,0,0,0,1)",
    "matrix3d(-1,0,0,0,0,1,0,0,0,0,-1,0,0,0,0,1)",
    "matrix3d(-1,0,0,0,0,-1,0,0,0,0,1,0,0,0,0,1)",
    "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)",
  ];
  for (const [largest, scene] of scenes.entries()) {
    const input = minimalView(); input.camera.pose.scene = scene;
    const query = formatSharedView(input);
    assert.equal((unpack(query).readUInt16BE(0) >> 6) & 3, largest);
    assertMinimalPrecision(parseSharedView(query), input);
  }
  const input = minimalView(); input.camera.pose.scene = shared().camera.pose.scene;
  const query = formatSharedView(input);
  assert.equal(unpack(query).readUInt16BE(0) & 0xe0, 32);
  assert.deepEqual(parseSharedView(query), input);
});

test("minimal v3 rejects duplicate camera data, reserved flags, invalid smallest-three values and truncation", () => {
  for (const mutate of [value => { value.camera.zoom = 1; }, value => { value.camera.controlPitch = 0; },
    value => { value.camera.pose.skybox = value.camera.pose.scene; }, value => { delete value.camera.distanceKilometers; },
    value => { value.camera.distanceKilometers = 0; }, value => { value.camera.distanceKilometers = Infinity; }]) {
    const input = minimalView(); mutate(input); assert.throws(() => formatSharedView(input));
  }
  const bytes = unpack(formatSharedView(minimalView()));
  for (let length = 0; length < bytes.length; length += 1) assert.throws(() => parseSharedView(queryFor(bytes.subarray(0, length))));
  for (const bit of [1, 0x100, 0x200, 0x400, 0x800]) {
    const bad = Buffer.from(bytes); bad.writeUInt16BE(bad.readUInt16BE(0) | bit, 0);
    assert.throws(() => parseSharedView(queryFor(bad)));
  }
  for (const [offset, value] of [[2, -1], [2, 0], [18, NaN], [18, Infinity], [18, 2], [18, 0.8], [bytes.length - 8, -1]]) {
    const bad = Buffer.from(bytes); bad.writeDoubleBE(value, offset);
    assert.throws(() => parseSharedView(queryFor(bad)));
  }
  for (const flags of [0x4006, 0x3004, 0x30e6]) {
    const bad = Buffer.from(bytes); bad.writeUInt16BE(flags, 0);
    assert.throws(() => parseSharedView(queryFor(bad)));
  }
  const count = Buffer.from(bytes); count.writeUInt16BE(2, bytes.length - 10);
  assert.throws(() => parseSharedView(queryFor(count)));
  assert.throws(() => parseSharedView(queryFor(Buffer.concat([bytes, Buffer.from([0])]))));
  const badPadding = formatSharedView(minimalView()) + "=";
  assert.throws(() => parseSharedView(badPadding));
});
