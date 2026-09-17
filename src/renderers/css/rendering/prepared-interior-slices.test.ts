import { describe, expect, it } from 'vitest';
import { createPreparedInteriorSliceSelection } from './prepared-interior-slices.js';
import { multiplyPreparedMatrix4, preparedRotationMatrix4 } from '../solar-system/prepared-ellipsoid-projection.js';

const normals = [[0, 0, 1], [1, 0, 0], [0, 1, 0]] as const;
const sceneFromBody = multiplyPreparedMatrix4(preparedRotationMatrix4('z', 40), preparedRotationMatrix4('x', -20));
const select = createPreparedInteriorSliceSelection({ sceneFromBody, slices: normals.map((normal, i) => ({ normal, nodes: [10 + i] })) });

/** An eye at a scene position, looking at the origin. */
function projectionFrom(eye: readonly number[]) {
  const eyeFromScene = [1,0,0,0, 0,1,0,0, 0,0,1,0, -eye[0],-eye[1],-eye[2],1];
  return { eyeFromScene, focalPixels: 1000, principalOffsetPixels: [0, 0] as [number, number] };
}
const toScene = (v: readonly number[]) => [0, 1, 2].map(i => sceneFromBody[i] * v[0] + sceneFromBody[4 + i] * v[1] + sceneFromBody[8 + i] * v[2]);

describe('prepared interior slices', () => {
  it('shows the slice whose normal is nearest the body-frame direction to the eye, on either side', () => {
    normals.forEach((normal, index) => {
      for (const sign of [1, -1]) {
        const off = [.2, .1, .15], direction = normal.map((v, i) => sign * v + off[i]);
        expect(select(projectionFrom(toScene(direction.map(v => v * 5e4))))).toBe(index);
      }
    });
  });
  it('shows none without a view', () => {
    expect(select(undefined)).toBe(-1);
  });
  it('rejects a non-unit normal', () => {
    expect(() => createPreparedInteriorSliceSelection({ sceneFromBody, slices: [{ normal: [0, 0, 2], nodes: [1] }] })).toThrow(/unit slice normals/);
  });
});
