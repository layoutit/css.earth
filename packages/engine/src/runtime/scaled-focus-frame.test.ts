import { describe, expect, it } from 'vitest';
import { containsScaledFocusPosition, presentPhysicalPoseInVolume } from './scaled-focus-frame.js';
import type { PhysicalCameraPose } from './selection-flight.js';
import type { ScaledFocusFrame } from './scaled-focus-frame.js';

const quarterTurn = [0, Math.SQRT1_2, 0, Math.SQRT1_2] as const;
const frame: ScaledFocusFrame = {
  referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [8.2e20, -1.1e20, 3.4e19],
  localToReferenceXyzw: quarterTurn, metersPerUnit: 8.269676e19,
  boundsUnits: { min: [-10, -10, -1.25], max: [10, 10, 1.25] },
};

describe('scaled focus frame', () => {
  it('maps physical observers across solar and galaxy scales without changing their orientation', () => {
    const observer: PhysicalCameraPose = {
      positionM: [1.495978707e11, -6.4e7, 2.1e7], orientationXyzw: [0, 0, 0, 1],
    };
    const original = structuredClone(observer);
    const local = presentPhysicalPoseInVolume(observer, frame);
    expect(local.positionUnits.every(Number.isFinite)).toBe(true);
    expect(local.orientationXyzw).toEqual([0, -Math.SQRT1_2, 0, Math.SQRT1_2]);
    expect(observer).toEqual(original);
  });

  it('keeps kpc-scale observers finite and treats prepared bounds as non-clamping coverage', () => {
    const local = presentPhysicalPoseInVolume({ positionM: [-7e20, 6e20, 9e19], orientationXyzw: quarterTurn }, frame);
    expect(local.positionUnits.every(Number.isFinite)).toBe(true);
    expect(containsScaledFocusPosition(frame, [0, 0, 0])).toBe(true);
    expect(containsScaledFocusPosition(frame, [11, 0, 0])).toBe(false);
  });

  it.each([
    [{ ...frame, metersPerUnit: 0 } as ScaledFocusFrame],
    [{ ...frame, boundsUnits: { min: [0, 0, 0], max: [0, 1, 1] } } as ScaledFocusFrame],
    [{ ...frame, localToReferenceXyzw: [0, 0, 0, 2] } as ScaledFocusFrame],
  ])('rejects invalid physical frame %#', invalid => {
    expect(() => presentPhysicalPoseInVolume({ positionM: [0, 0, 0], orientationXyzw: [0, 0, 0, 1] }, invalid)).toThrow();
  });
});
