import { describe, expect, it } from 'vitest';
import { projectSphereDrag, composeDragRotation, rotationFromAngularVelocity } from './sphere-drag.js';
import { sampleDestinationFlight, rotationAxisAngle } from './destination-flight.js';
import { createDragHistory, recordDragSample, estimateDragThrow, advanceDragThrow } from './trackball-drag-inertia.js';

const trackball = { centerX: 704, centerY: 479.5, radius: 295.4867, surfaceRadius: 295.4867,
  focalLength: 1408 * Math.sqrt(3) / 2, viewportWidth: 1408 };
const drag = (a: readonly number[], b: readonly number[]) => projectSphereDrag({ ...trackball,
  previousX: a[0], previousY: a[1], currentX: b[0], currentY: b[1] });
const close = (a: readonly number[], b: readonly number[]) => a.forEach((value, i) => expect(value).toBeCloseTo(b[i], 10));

describe('retained navigation math', () => {
  it('retains roll in off-centre drags and reverses the entire orientation', () => {
    const left = drag([660, 410], [660, 550]), right = drag([748, 410], [748, 550]);
    expect(left[0]).toBeLessThan(0); expect(right[0]).toBeLessThan(0);
    expect(left[2]).toBeLessThan(0); expect(right[2]).toBeGreaterThan(0);
    close(composeDragRotation(drag([780, 420], [650, 530]), drag([650, 530], [780, 420])), [0, 0, 0, 1]);
    close(rotationFromAngularVelocity([0, 0, 0], 200), [0, 0, 0, 1]);
  });

  it('preserves coalesced sample ordering, including a closed path roll', () => {
    const a = [680, 530], b = [750, 420], c = [800, 500];
    const ordered = composeDragRotation(drag(b, c), drag(a, b));
    const reversed = composeDragRotation(drag(a, b), drag(b, c));
    expect(Math.abs(ordered[2] - reversed[2])).toBeGreaterThan(.01);
    expect(Math.hypot(...ordered)).toBeCloseTo(1, 12);
    expect(Math.abs(composeDragRotation(drag(c, a), ordered)[2])).toBeGreaterThan(.01);
  });

  it('keeps destination endpoint framing exact and distant pullback bounded', () => {
    const flight = { startZoom: 512, targetZoom: 256, overviewZoom: 1.1, angularDistance: 160 };
    expect(sampleDestinationFlight(flight, 0)).toEqual({ rotation: 0, zoom: 512 });
    expect(sampleDestinationFlight(flight, 1)).toEqual({ rotation: 1, zoom: 256 });
    for (let index = 0; index <= 100; index++) expect(sampleDestinationFlight(flight, index / 100).zoom).toBeGreaterThanOrEqual(128);
    expect(sampleDestinationFlight({ ...flight, targetZoom: 512 }, .5).zoom).toBeCloseTo(256, 8);
  });

  it('extracts a stable antipodal rotation', () => {
    const identity = { m11: 1, m12: 0, m13: 0, m21: 0, m22: 1, m23: 0, m31: 0, m32: 0, m33: 1 };
    expect(rotationAxisAngle(identity).degrees).toBe(0);
    expect(rotationAxisAngle({ ...identity, m11: -1, m22: -1 })).toEqual({ axis: [0, 0, 1], degrees: 180 });
  });

  it('rejects stale releases and decays a qualified throw', () => {
    const history = createDragHistory();
    for (const [x, timestamp, yaw] of [[600, 0, 0], [620, 16, 5], [670, 32, 17], [760, 48, 39]]) {
      recordDragSample(history, { x, y: 450, timestamp, yaw, pitch: 0 });
    }
    expect(estimateDragThrow({ history, releaseTimestamp: 149, trackball })).toBeNull();
    const motion = estimateDragThrow({ history, releaseTimestamp: 48, trackball });
    expect(motion).not.toBeNull();
    if (!motion) throw new Error('Expected a qualified release.');
    const step = advanceDragThrow({ ...motion, elapsedMilliseconds: 16 });
    expect(step.active).toBe(true);
    expect(Math.abs(step.yawDegreesPerMillisecond)).toBeLessThan(Math.abs(motion.yawDegreesPerMillisecond));
    expect(advanceDragThrow({ ...motion, elapsedMilliseconds: 1200 }).active).toBe(false);
  });


});
