import { describe, expect, it } from 'vitest';
import { createPreparedInteriorDisc, PREPARED_INTERIOR_DISC_SIZE } from './prepared-interior-disc.js';
import { invertPreparedAffineMatrix4, multiplyPreparedMatrix4, preparedRotationMatrix4, readPreparedMatrix4 } from '@cssearth/core';

const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
const radii = [11500, 11500, 10373] as const;
const sceneFromBody = multiplyPreparedMatrix4(preparedRotationMatrix4('z', 60), preparedRotationMatrix4('y', -26.73));
const inset = .974;
const project = createPreparedInteriorDisc({ sceneFromBody, radii, inset });

describe('physical interior disc', () => {
  it.each([[11500,11500,11500], [11500,11500,10373], [11500,8400,5100]] as const)('keeps its complete boundary inside axes %s,%s,%s at every orientation and distance', (a,b,c) => {
    const radii = [a,b,c] as const;
    const project = createPreparedInteriorDisc({ sceneFromBody, radii, inset });
    const bodyFromScene = invertPreparedAffineMatrix4(sceneFromBody);
    for (const distance of [12500, 17000, 50000, 1e6]) for (let pitch = -90; pitch <= 90; pitch += 15) for (let yaw = 0; yaw < 360; yaw += 15) {
      const eyeFromScene = multiplyPreparedMatrix4(preparedRotationMatrix4('x', pitch), preparedRotationMatrix4('y', yaw));
      eyeFromScene[14] = -distance;
      const result = project({ eyeFromScene, focalPixels: 1000, principalOffsetPixels: [0, 0] });
      expect(result).not.toBeNull();
      const matrix = multiplyPreparedMatrix4(bodyFromScene, readPreparedMatrix4(result!));
      for (let angle = 0; angle < 360; angle += 15) {
        const r = PREPARED_INTERIOR_DISC_SIZE / 2, theta = angle * Math.PI / 180;
        const x = r + r*Math.cos(theta), y = r + r*Math.sin(theta);
        const squaredRadius = [0, 1, 2].reduce((sum, i) => sum + ((matrix[i]*x + matrix[4+i]*y + matrix[12+i])/radii[i])**2, 0);
        expect(squaredRadius).toBeLessThanOrEqual(inset**2 + 1e-9);
      }
    }
  });
  it('hides when the eye enters the inner ellipsoid', () => {
    expect(project({ eyeFromScene: identity, focalPixels: 1000, principalOffsetPixels: [0, 0] })).toBeNull();
  });
  it('rejects nonphysical prepared shapes', () => {
    expect(() => createPreparedInteriorDisc({ sceneFromBody, radii, inset: 1 })).toThrow();
    expect(() => createPreparedInteriorDisc({ sceneFromBody: [...identity.slice(0, 15), 2], radii, inset })).toThrow();
    expect(() => createPreparedInteriorDisc({ sceneFromBody: identity, radii: [0, 1, 1], inset })).toThrow();
  });
});
