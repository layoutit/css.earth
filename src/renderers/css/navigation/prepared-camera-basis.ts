import { preparedScenePitch } from '@cssearth/engine';
import type { CameraPlan } from './types.js';
import type { Matrix4 } from '../solar-system/types.js';
import { invertPreparedAffineMatrix4, multiplyPreparedMatrix4, preparedRotationMatrix4, readPreparedMatrix4, serializePreparedMatrix4 } from '../../../platform/math/matrix.mts';

const identity = (): Matrix4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** The authored camera calibration, shared by native publication and live orbiting. */
export function preparedSceneMatrix(camera: CameraPlan, pitch: number, yaw: number): Matrix4 {
  return multiplyPreparedMatrix4(preparedRotationMatrix4('x', preparedScenePitch(pitch, camera)), preparedRotationMatrix4('y', yaw));
}

/** Decode prepared affine transforms; no layout, style discovery or geometry generation. */
export function readPreparedTransform(value: string | null): Matrix4 {
  if (!value || value === 'none') return identity();
  let result = identity(), end = 0;
  for (const match of value.matchAll(/([a-zA-Z0-9]+)\(([^()]*)\)/gu)) {
    if (value.slice(end, match.index).trim()) throw new TypeError('Invalid prepared transform.');
    end = match.index! + match[0].length;
    const name = match[1], parts = match[2].trim().split(/[,\s]+/u);
    const number = (index: number, unit = '') => {
      const token = parts[index];
      if (!token || !(unit ? new RegExp(`^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?${unit}$`, 'iu')
        : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu).test(token)) throw new TypeError('Invalid prepared transform value.');
      const value = Number(unit ? token.slice(0, -unit.length) : token);
      if (!Number.isFinite(value)) throw new TypeError('Invalid prepared transform value.');
      return value;
    };
    let next = identity();
    if (name === 'matrix3d' && parts.length === 16) next = readPreparedMatrix4(match[0]);
    else if (/^rotate[XYZ]?$/u.test(name) && parts.length === 1) next = preparedRotationMatrix4(name === 'rotateX' ? 'x' : name === 'rotateY' ? 'y' : 'z', number(0, 'deg'));
    else if (name === 'matrix' && parts.length === 6) {
      next = [number(0), number(1), 0, 0, number(2), number(3), 0, 0, 0, 0, 1, 0, number(4), number(5), 0, 1];
    } else if (/^translate(?:3d|[XYZ])?$/u.test(name) && parts.length <= 3) {
      const indices = name === 'translateX' ? [12] : name === 'translateY' ? [13] : name === 'translateZ' ? [14] : [12, 13, 14].slice(0, parts.length);
      if (parts.length !== indices.length) throw new TypeError('Invalid prepared translation.');
      next = next.map((value, index) => indices.includes(index) ? number(indices.indexOf(index), parts[indices.indexOf(index)] === '0' ? '' : 'px') : value);
    } else if (/^scale(?:3d|[XYZ])?$/u.test(name) && parts.length <= 3) {
      const x = name === 'scaleY' || name === 'scaleZ' ? 1 : number(0);
      const y = name === 'scaleX' || name === 'scaleZ' ? 1 : name === 'scaleY' ? number(0) : parts.length > 1 ? number(1) : x;
      const z = name === 'scaleZ' ? number(0) : parts.length > 2 ? number(2) : 1;
      next = [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
    } else throw new TypeError(`Unsupported prepared transform: ${name}.`);
    result = multiplyPreparedMatrix4(result, next);
  }
  if (end === 0 || value.slice(end).trim()) throw new TypeError('Invalid prepared transform.');
  return result;
}

export function preparedCameraBasis(camera: CameraPlan, sceneMatrix: string, sunDirection?: readonly number[]) {
  const scene = readPreparedMatrix4(sceneMatrix);
  const reference = preparedSceneMatrix(camera, camera.materialReferenceControlPitchDegrees ?? camera.defaultControlPitchDegrees,
    camera.materialReferenceControlYawDegrees ?? camera.defaultControlYawDegrees);
  const counter = multiplyPreparedMatrix4(invertPreparedAffineMatrix4(scene), reference);
  const light = (matrix: Matrix4) => {
    if (!sunDirection) return null;
    const direction = [0, 1, 2].map(row => matrix[row] * sunDirection[0] + matrix[row + 4] * sunDirection[1] + matrix[row + 8] * sunDirection[2]);
    const length = Math.hypot(...direction);
    if (!(length > 0)) throw new TypeError('Invalid prepared Sun direction.');
    return direction.map(value => value / length);
  };
  return { sceneMatrix, sunViewDirection: light(scene),
    reference: { sceneMatrix: serializePreparedMatrix4(reference), sunViewDirection: light(reference) },
    counterRotation: serializePreparedMatrix4(counter),
    counterRotationFor(transform: string | DOMMatrix | null) {
      if (transform !== null && typeof transform !== 'string') throw new TypeError('Prepared publication requires a transported transform.');
      const local = readPreparedTransform(transform);
      return serializePreparedMatrix4(multiplyPreparedMatrix4(multiplyPreparedMatrix4(invertPreparedAffineMatrix4(local), counter), local));
    },
  };
}
