import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { projectSphereDrag, composeDragRotation, rotationFromAngularVelocity } from './sphere-drag.js';
import { sampleDestinationFlight, rotationAxisAngle } from './destination-flight.js';
import { createDragHistory, recordDragSample, estimateDragThrow, advanceDragThrow } from './trackball-drag-inertia.js';

const trackball = { centerX: 704, centerY: 479.5, radius: 295.4867, surfaceRadius: 295.4867,
  focalLength: 1408 * Math.sqrt(3) / 2, viewportWidth: 1408 };
const drag = (a: readonly number[], b: readonly number[]) => projectSphereDrag({ ...trackball,
  previousX: a[0], previousY: a[1], currentX: b[0], currentY: b[1] });
const close = (a: readonly number[], b: readonly number[]) => a.forEach((value, i) => assert.ok(Math.abs(value - (b[i])) < 10 ** -10 / 2, `${value} is not close to ${b[i]}`));

describe('retained navigation math', () => {
  it('retains roll in off-centre drags and reverses the entire orientation', () => {
    const left = drag([660, 410], [660, 550]), right = drag([748, 410], [748, 550]);
    assert.ok(left[0] < 0); assert.ok(right[0] < 0);
    assert.ok(left[2] < 0); assert.ok(right[2] > 0);
    close(composeDragRotation(drag([780, 420], [650, 530]), drag([650, 530], [780, 420])), [0, 0, 0, 1]);
    close(rotationFromAngularVelocity([0, 0, 0], 200), [0, 0, 0, 1]);
  });

  it('preserves coalesced sample ordering, including a closed path roll', () => {
    const a = [680, 530], b = [750, 420], c = [800, 500];
    const ordered = composeDragRotation(drag(b, c), drag(a, b));
    const reversed = composeDragRotation(drag(a, b), drag(b, c));
    assert.ok(Math.abs(ordered[2] - reversed[2]) > .01);
    assert.ok(Math.abs(Math.hypot(...ordered) - (1)) < 10 ** -12 / 2, `${Math.hypot(...ordered)} is not close to ${1}`);
    assert.ok(Math.abs(composeDragRotation(drag(c, a), ordered)[2]) > .01);
  });

  it('keeps destination endpoint framing exact and distant pullback bounded', () => {
    const flight = { startZoom: 512, targetZoom: 256, overviewZoom: 1.1, angularDistance: 160 };
    assert.deepEqual(sampleDestinationFlight(flight, 0), { rotation: 0, zoom: 512 });
    assert.deepEqual(sampleDestinationFlight(flight, 1), { rotation: 1, zoom: 256 });
    for (let index = 0; index <= 100; index++) assert.ok(sampleDestinationFlight(flight, index / 100).zoom >= 128);
    assert.ok(Math.abs(sampleDestinationFlight({ ...flight, targetZoom: 512 }, .5).zoom - (256)) < 10 ** -8 / 2, `${sampleDestinationFlight({ ...flight, targetZoom: 512 }, .5).zoom} is not close to ${256}`);
  });

  it('extracts a stable antipodal rotation', () => {
    const identity = { m11: 1, m12: 0, m13: 0, m21: 0, m22: 1, m23: 0, m31: 0, m32: 0, m33: 1 };
    assert.equal(rotationAxisAngle(identity).degrees, 0);
    assert.deepEqual(rotationAxisAngle({ ...identity, m11: -1, m22: -1 }), { axis: [0, 0, 1], degrees: 180 });
  });

  it('rejects stale releases and decays a qualified throw', () => {
    const history = createDragHistory();
    for (const [x, timestamp, yaw] of [[600, 0, 0], [620, 16, 5], [670, 32, 17], [760, 48, 39]]) {
      recordDragSample(history, { x, y: 450, timestamp, yaw, pitch: 0 });
    }
    assert.equal(estimateDragThrow({ history, releaseTimestamp: 149, trackball }), null);
    const motion = estimateDragThrow({ history, releaseTimestamp: 48, trackball });
    assert.notEqual(motion, null);
    if (!motion) throw new Error('Expected a qualified release.');
    const step = advanceDragThrow({ ...motion, elapsedMilliseconds: 16 });
    assert.equal(step.active, true);
    assert.ok(Math.abs(step.yawDegreesPerMillisecond) < Math.abs(motion.yawDegreesPerMillisecond));
    assert.equal(advanceDragThrow({ ...motion, elapsedMilliseconds: 1200 }).active, false);
  });


});
