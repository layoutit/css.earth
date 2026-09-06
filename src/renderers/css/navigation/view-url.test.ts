import { describe, expect, it } from 'vitest';
import { formatViewParameters, parseViewParameters, formatSharedView, parseSharedView } from './view-url.js';
import type { SharedView } from './view-url.js';

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
