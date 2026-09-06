import { describe, expect, it } from 'vitest';
import { formatViewParameters, parseViewParameters, formatSharedView, parseSharedView } from './view-url.js';
import type { SharedView, PhysicalSharedCamera } from './view-url.js';

const oracleToken = 'ED1EKjVv3t9gpEAk4O9YP9WQv-vR66IJEclAAYBqIc_PCEJ6B0WPzS42';
// Executed against Galaxio's viewUrl.ts parser: its float64 wire fixture.
const oracle = { altitudeM: 241732943586926920000, azimuthRad: 10.439326055328621,
  polarRad: -0.869375053859181, orbitRollRad: 2.1877024308722675,
  epochUnixMs: 1788658384082.8882, timeScale: 1, fovDeg: 85 };
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
  it('decodes the source oracle and re-encodes every bit', () => {
    expect(parseViewParameters(`?v=${oracleToken}`)).toEqual(oracle);
    expect(formatViewParameters(oracle)).toBe(`v=${oracleToken}`);
    expect(formatViewParameters({ timeScale: 0 })).toBe('v=GAA');
    expect(parseViewParameters('')).toEqual({});
  });

  it('preserves one physical rotation, distance and time in version 3', () => {
    const view = physical(), query = formatSharedView(view);
    expect(new DataView(bytes(query).buffer).getUint16(0) >>> 12).toBe(3);
    let restored = parseSharedView(query);
    const check = (actual: SharedView | null) => {
      if (!actual) throw new Error('Missing shared camera.');
      expect(actual.preparedEpochJdTt).toBe(view.preparedEpochJdTt);
      expect(actual.playback).toEqual(view.playback);
      expect(actual.camera.distanceKilometers).toBe(view.camera.distanceKilometers);
      expect(actual.camera.pose.schema).toBe('cssearth-camera-pose@2');
      const expected = view.camera.pose.scene.slice(9, -1).split(',').map(Number);
      actual.camera.pose.scene.slice(9, -1).split(',').map(Number).forEach((value, index) => expect(value).toBeCloseTo(expected[index], 9));
    };
    check(restored);
    for (let index = 0; index < 100; index++) {
      if (!restored) throw new Error('Missing shared camera.');
      restored = parseSharedView(formatSharedView(restored));
    }
    check(restored);
    expect(Object.keys(restored!.camera).sort()).toEqual(['distanceKilometers', 'pose']);
  });

  it('preserves a nonenumerable pose and reads independent legacy sky frames', () => {
    const view: SharedView = { camera: { controlPitch: -123.4, controlYaw: 723.9, zoom: .000003,
      pose: { schema: 'cssearth-camera-pose@1', scene: identity, skybox: identity,
        sunView: 'matrix3d(0,0,-1,0,0,1,0,0,1,0,0,0,0,0,0,1)' } },
      playback: { times: [12345.6789, 534.125], speed: 4, motionRequested: true } };
    Object.defineProperty(view.camera, 'pose', { enumerable: false });
    const query = formatSharedView(view), restored = parseSharedView(query);
    expect(new DataView(bytes(query).buffer).getUint16(0) >>> 12).toBe(2);
    expect(restored?.camera.pose).toEqual(view.camera.pose);
    expect(restored?.playback).toEqual(view.playback);
  });

  it('version4 stores one translated centre instead of a redundant range and round-trips the whole observer', () => {
    const view = translated(), query = formatSharedView(view), payload = bytes(query);
    expect(new DataView(payload.buffer).getUint16(0) >>> 12).toBe(4);
    const centred: SharedView = { ...view, camera: { distanceKilometers: view.camera.distanceKilometers, pose: view.camera.pose } };
    expect(payload.length).toBe(bytes(formatSharedView(centred)).length + 16);
    for (let axis = 0; axis < 3; axis++) expect(new DataView(payload.buffer).getFloat64(2 + axis * 8)).toBe(view.camera.bodyCenterKilometers![axis]);
    let restored = parseSharedView(query);
    for (let index = 0; index < 100; index++) {
      if (!restored || restored.camera.pose.schema !== 'cssearth-camera-pose@2') throw new Error('Missing physical view.');
      expect(restored.camera).toHaveProperty('bodyCenterKilometers', view.camera.bodyCenterKilometers);
      expect(restored.camera.distanceKilometers).toBe(view.camera.distanceKilometers);
      expect(restored.playback).toEqual(view.playback);
      expect(restored.preparedEpochJdTt).toBe(view.preparedEpochJdTt);
      const expected = view.camera.pose.scene.slice(9, -1).split(',').map(Number);
      restored.camera.pose.scene.slice(9, -1).split(',').map(Number).forEach((component, axis) =>
        expect(Math.abs(component - expected[axis])).toBeLessThan(1e-10));
      restored = parseSharedView(formatSharedView(restored));
    }
  });

  it('rejects malformed translated positions, truncatedv4, nonfinite fields and reserved flags', () => {
    const view = translated(), valid = bytes(formatSharedView(view));
    const mismatch = translated(); mismatch.camera.distanceKilometers *= 2;
    expect(() => formatSharedView(mismatch)).toThrow();
    const sparse = translated(); Reflect.deleteProperty(sparse.camera.bodyCenterKilometers!, '1');
    expect(() => formatSharedView(sparse)).toThrow();
    for (let length = 0; length < valid.length; length++) expect(() => parseSharedView(encoded(valid.slice(0, length)))).toThrow();
    for (const invalidValue of [NaN, Infinity, -Infinity]) {
      const modified = valid.slice(); new DataView(modified.buffer).setFloat64(2, invalidValue);
      expect(() => parseSharedView(encoded(modified))).toThrow();
    }
    const zero = valid.slice(); zero.fill(0, 2, 26);
    expect(() => parseSharedView(encoded(zero))).toThrow();
    const reserved = valid.slice(); reserved[1] |= 1;
    expect(() => parseSharedView(encoded(reserved))).toThrow();
    expect(() => parseSharedView(encoded(Uint8Array.from([...valid, 0])))).toThrow();
    expect(() => parseSharedView(formatSharedView(view) + '=')).toThrow();
  });

  it('rejects malformed, repeated, noncanonical and truncated input', () => {
    for (const query of ['v=', 'v=A', 'v=AA', 'v=AAAAA', 'v=EAB', 'v=EAA=', 'v=EAA&v=EAA', 'v=EAA&extra=1']) {
      expect(() => parseViewParameters(query)).toThrow();
      expect(() => parseSharedView(query)).toThrow();
    }
    const query = formatSharedView(physical());
    for (const cut of [1, 2, 4, 12]) expect(() => parseSharedView(query.slice(0, -cut))).toThrow();
    expect(() => formatViewParameters({ altitudeM: -1 })).toThrow();
    expect(() => formatViewParameters({ altitudeM: 20, distanceM: 8500000 })).toThrow();
    const invalid = physical(); invalid.camera.pose.scene = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,10,0,0,1)';
    expect(() => formatSharedView(invalid)).toThrow();
  });
});
