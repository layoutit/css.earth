import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { formatSharedView, parseSharedView } from './view-url.js';
import type { SharedView, PhysicalSharedCamera } from './view-url.js';

const identity = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
const physical = (): SharedView => ({ camera: { distanceKilometers: 39051.89269356484,
  pose: { schema: 'cssearth-camera-pose@2', scene: 'matrix3d(0.951326031283,0.251717501181,-0.177811928175,0,0.137478049482,0.169758540011,0.975849283447,0,0.275823436483,-0.952796063013,0.126890087063,0,0,0,0,1)' } },
  preparedEpochJdTt: 2461286.5, playback: { times: [216.72099993674453], speed: 1, motionRequested: false } });
const bytes = (query: string) => Uint8Array.from(atob(new URLSearchParams(query).get('v')!.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
const encoded = (payload: Uint8Array) => 'v=' + btoa(String.fromCharCode(...payload)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
function translated(): SharedView & { camera: PhysicalSharedCamera } {
  const value = physical();
  const bodyCenterKilometers: readonly [number, number, number] = [3012.125, -890.75, -41200.9375];
  return { ...value, camera: { distanceKilometers: Math.hypot(...bodyCenterKilometers), bodyCenterKilometers,
    pose: { schema: 'cssearth-camera-pose@2', scene: value.camera.pose.scene } } };
}

describe('view URL wire contract', () => {
  it('preserves one physical rotation, distance and time in the current format', () => {
    const view = physical(), query = formatSharedView(view);
    assert.equal((new DataView(bytes(query).buffer).getUint16(0) >>> 12), 5);
    let restored = parseSharedView(query);
    const check = (actual: SharedView | null) => {
      if (!actual) throw new Error('Missing shared camera.');
      assert.equal(actual.preparedEpochJdTt, view.preparedEpochJdTt);
      assert.deepEqual(actual.playback, view.playback);
      assert.equal(actual.camera.distanceKilometers, view.camera.distanceKilometers);
      assert.equal(actual.camera.pose.schema, 'cssearth-camera-pose@2');
      const expected = view.camera.pose.scene.slice(9, -1).split(',').map(Number);
      actual.camera.pose.scene.slice(9, -1).split(',').map(Number).forEach((value, index) => assert.ok(Math.abs(value - (expected[index])) < 10 ** -9 / 2, `${value} is not close to ${expected[index]}`));
    };
    check(restored);
    for (let index = 0; index < 100; index++) {
      if (!restored) throw new Error('Missing shared camera.');
      restored = parseSharedView(formatSharedView(restored));
    }
    check(restored);
    assert.deepEqual(Object.keys(restored!.camera).sort(), ['distanceKilometers', 'pose']);
  });

  it('preserves nonenumerable poses and rejects all retired wire versions', () => {
    const view = physical();
    view.camera.pose.scene = identity;
    Object.defineProperty(view.camera, 'pose', { enumerable: false });
    assert.deepEqual(parseSharedView(formatSharedView(view))?.camera.pose, view.camera.pose);
    const payload = bytes(formatSharedView(view));
    for (const version of [1, 2, 3, 4, 6, 15]) {
      const old = payload.slice(); old[0] = (old[0] & 15) | (version << 4);
      assert.throws(() => parseSharedView(encoded(old)), /unsupported version/);
    }
  });

  it('the current format stores one translated centre instead of a redundant range and round-trips the whole observer', () => {
    const view = translated(), query = formatSharedView(view), payload = bytes(query);
    assert.equal((new DataView(payload.buffer).getUint16(0) >>> 12), 5);
    const centred: SharedView = { ...view, camera: { distanceKilometers: view.camera.distanceKilometers, pose: view.camera.pose } };
    assert.equal(payload.length, bytes(formatSharedView(centred)).length + 16);
    for (let axis = 0; axis < 3; axis++) assert.equal(new DataView(payload.buffer).getFloat64(2 + axis * 8), view.camera.bodyCenterKilometers![axis]);
    let restored = parseSharedView(query);
    for (let index = 0; index < 100; index++) {
      if (!restored || restored.camera.pose.schema !== 'cssearth-camera-pose@2') throw new Error('Missing physical view.');
      assert.deepEqual(restored.camera['bodyCenterKilometers'], view.camera.bodyCenterKilometers);
      assert.equal(restored.camera.distanceKilometers, view.camera.distanceKilometers);
      assert.deepEqual(restored.playback, view.playback);
      assert.equal(restored.preparedEpochJdTt, view.preparedEpochJdTt);
      const expected = view.camera.pose.scene.slice(9, -1).split(',').map(Number);
      restored.camera.pose.scene.slice(9, -1).split(',').map(Number).forEach((component, axis) =>
        assert.ok(Math.abs(component - expected[axis]) < 1e-10));
      restored = parseSharedView(formatSharedView(restored));
    }
  });

  it('rejects malformed translated positions, truncatedv4, nonfinite fields and reserved flags', () => {
    const view = translated(), valid = bytes(formatSharedView(view));
    const mismatch = translated(); mismatch.camera.distanceKilometers *= 2;
    assert.throws(() => formatSharedView(mismatch));
    const sparse = translated(); Reflect.deleteProperty(sparse.camera.bodyCenterKilometers!, '1');
    assert.throws(() => formatSharedView(sparse));
    for (let length = 0; length < valid.length; length++) assert.throws(() => parseSharedView(encoded(valid.slice(0, length))));
    for (const invalidValue of [NaN, Infinity, -Infinity]) {
      const modified = valid.slice(); new DataView(modified.buffer).setFloat64(2, invalidValue);
      assert.throws(() => parseSharedView(encoded(modified)));
    }
    const zero = valid.slice(); zero.fill(0, 2, 26);
    assert.throws(() => parseSharedView(encoded(zero)));
    const reserved = valid.slice(); reserved[0] |= 1;
    assert.throws(() => parseSharedView(encoded(reserved)));
    assert.throws(() => parseSharedView(encoded(Uint8Array.from([...valid, 0]))));
    assert.throws(() => parseSharedView(formatSharedView(view) + '='));
  });

  it('rejects malformed, repeated, noncanonical and truncated input', () => {
    for (const query of ['v=', 'v=A', 'v=AA', 'v=AAAAA', 'v=EAB', 'v=EAA=', 'v=EAA&v=EAA', 'v=EAA&extra=1']) {
      assert.throws(() => parseSharedView(query));
      assert.throws(() => parseSharedView(query));
    }
    const query = formatSharedView(physical());
    for (const cut of [1, 2, 4, 12]) assert.throws(() => parseSharedView(query.slice(0, -cut)));
    const invalid = physical(); invalid.camera.pose.scene = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,10,0,0,1)';
    assert.throws(() => formatSharedView(invalid));
    const noEpoch = physical(); Reflect.deleteProperty(noEpoch, 'preparedEpochJdTt');
    assert.throws(() => formatSharedView(noEpoch), /preparedEpochJdTt/);
    const timeless = { ...physical(), preparedEpochJdTt: null };
    timeless.camera.pose.scene = identity;
    assert.deepEqual(parseSharedView(formatSharedView(timeless)), timeless);
  });
});

const unpack = (query: string) => Buffer.from(bytes(query));
const queryFor = encoded;
it("smallest-three encoding covers every omitted component and exact rounded-matrix fallback", () => {
  const scenes = [
    "matrix3d(1,0,0,0,0,-1,0,0,0,0,-1,0,0,0,0,1)",
    "matrix3d(-1,0,0,0,0,1,0,0,0,0,-1,0,0,0,0,1)",
    "matrix3d(-1,0,0,0,0,-1,0,0,0,0,1,0,0,0,0,1)",
    "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)",
  ];
  for (const [largest, scene] of scenes.entries()) {
    const input = physical(); input.camera.pose.scene = scene;
    const query = formatSharedView(input);
    assert.equal((unpack(query).readUInt16BE(0) >> 6) & 3, largest);
    assert.deepEqual(parseSharedView(query), input);
  }
  const input = physical(); input.camera.pose.scene = "matrix3d(0.133333,0.933333,-0.333333,0,-0.666667,0.333333,0.666667,0,0.733333,0.133333,0.666667,0,0,0,0,1)";
  const query = formatSharedView(input);
  assert.equal(unpack(query).readUInt16BE(0) & 0xe0, 32);
  assert.deepEqual(parseSharedView(query), input);
});

it('view links retain optical framing and reject invalid dataset scales', () => {
  const input = parseSharedView(formatSharedView(physical()))!;
  input.camera.pose.scene = identity;
  input.camera.projectionScale = 3.25;
  assert.deepEqual(parseSharedView(formatSharedView(input)), input);
  for (const scale of [0, -1, NaN, Infinity]) {
    input.camera.projectionScale = scale;
    assert.throws(() => formatSharedView(input));
  }
});

it("current format rejects duplicate camera data, reserved flags, invalid smallest-three values and truncation", () => {
  const mutations: ((value: SharedView) => void)[] = [
    value => { Reflect.set(value.camera, 'zoom', 1); }, value => { Reflect.set(value.camera, 'controlPitch', 0); },
    value => { Reflect.set(value.camera.pose, 'skybox', value.camera.pose.scene); },
    value => { Reflect.deleteProperty(value.camera, 'distanceKilometers'); },
    value => { value.camera.distanceKilometers = 0; }, value => { value.camera.distanceKilometers = Infinity; },
  ];
  for (const mutate of mutations) {
    const input = physical(); mutate(input); assert.throws(() => formatSharedView(input));
  }
  const bytes = unpack(formatSharedView(physical()));
  for (let length = 0; length < bytes.length; length += 1) assert.throws(() => parseSharedView(queryFor(bytes.subarray(0, length))));
  for (const bit of [4, 0x100, 0x200, 0x400, 0x800]) {
    const bad = Buffer.from(bytes); bad.writeUInt16BE(bad.readUInt16BE(0) | bit, 0);
    assert.throws(() => parseSharedView(queryFor(bad)));
  }
  for (const [offset, value] of [[2, -1], [2, 0], [18, NaN], [18, Infinity], [18, 2], [18, 0.8], [bytes.length - 8, -1]]) {
    const bad = Buffer.from(bytes); bad.writeDoubleBE(value, offset);
    assert.throws(() => parseSharedView(queryFor(bad)));
  }
  for (const flags of [0x5004, 0x50e2]) {
    const bad = Buffer.from(bytes); bad.writeUInt16BE(flags, 0);
    assert.throws(() => parseSharedView(queryFor(bad)));
  }
  const count = Buffer.from(bytes); count.writeUInt16BE(2, bytes.length - 10);
  assert.throws(() => parseSharedView(queryFor(count)));
  assert.throws(() => parseSharedView(queryFor(Buffer.concat([bytes, Buffer.from([0])]))));
  const badPadding = formatSharedView(physical()) + "=";
  assert.throws(() => parseSharedView(badPadding));
});

it('validates bounded payloads, playback and pure rotations before encoding', () => {
  for (const scene of ['rotateX(45deg)', 'matrix3d(2,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
    'matrix3d(-1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', 'matrix3d(,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)']) {
    const view = physical(); view.camera.pose.scene = scene;
    assert.throws(() => formatSharedView(view), /pose/);
  }
  for (const times of [[-1], [NaN], Array.from({ length: 4096 }, () => 1)]) {
    const view = physical(); view.playback.times = times;
    assert.throws(() => formatSharedView(view));
  }
  for (const speed of [-1, NaN, Infinity]) {
    const view = physical(); view.playback.speed = speed;
    assert.throws(() => formatSharedView(view));
  }
  assert.throws(() => parseSharedView(encoded(new Uint8Array(4097))));
});
