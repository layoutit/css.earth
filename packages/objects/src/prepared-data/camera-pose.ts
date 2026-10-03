/** Saved CSS camera data; distinct from the engine's metre/quaternion physical pose. */
export const CAMERA_POSE_SCHEMA = 'cssearth-camera-pose@2';
export interface CameraPose { schema: typeof CAMERA_POSE_SCHEMA; scene: string; }

function invalidPose(): never { throw new Error('Invalid “pose” in this view link.'); }

/** The default proper policy admits bounded share-link rotations with historical diagnostics.
 * The finite policy admits live-restore matrices before renderer projects them to a rotation. */
export function parseCameraPoseMatrix(value: unknown, { rotation = 'proper' }: { rotation?: 'proper' | 'finite' } = {}): number[] {
  const fail: () => never = rotation === 'proper' ? invalidPose : (): never => { throw new TypeError('Camera camera scene matrix is invalid.'); };
  if (typeof value !== 'string' || rotation === 'proper' && value.length > 1024) fail();
  const match = /^matrix3d\(([^()]+)\)$/u.exec(value);
  if (!match) fail();
  const fields = match[1].split(',');
  if (fields.length !== 16 || rotation === 'proper' && fields.some(field => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/iu.test(field.trim()))) fail();
  const matrix = fields.map(Number);
  if (!matrix.every(Number.isFinite)) fail();
  if (rotation === 'finite') return matrix;
  if ([3, 7, 11, 12, 13, 14].some(index => Math.abs(matrix[index]) > 1e-9) || Math.abs(matrix[15] - 1) > 1e-9) invalidPose();
  // The saved values are rotations, rounded by the live CSS serializer.
  for (let a = 0; a < 3; a += 1) for (let b = a; b < 3; b += 1) {
    const dot = matrix[a * 4] * matrix[b * 4] + matrix[a * 4 + 1] * matrix[b * 4 + 1] + matrix[a * 4 + 2] * matrix[b * 4 + 2];
    if (Math.abs(dot - (a === b ? 1 : 0)) > 1e-4) invalidPose();
  }
  const determinant = matrix[0] * (matrix[5] * matrix[10] - matrix[6] * matrix[9]) -
    matrix[4] * (matrix[1] * matrix[10] - matrix[2] * matrix[9]) +
    matrix[8] * (matrix[1] * matrix[6] - matrix[2] * matrix[5]);
  if (Math.abs(determinant - 1) > 1e-4) invalidPose();
  return matrix;
}

export function parseCameraPose(value: unknown): CameraPose {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => key !== 'schema' && key !== 'scene') ||
      !('schema' in value) || value.schema !== CAMERA_POSE_SCHEMA || !('scene' in value)) invalidPose();
  parseCameraPoseMatrix(value.scene);
  // Matrix admission above guarantees a string; keep the original serialized bytes.
  if (typeof value.scene !== 'string') invalidPose();
  return { schema: CAMERA_POSE_SCHEMA, scene: value.scene };
}

/** Live restore historically admits finite matrices, then projects them to a rotation in renderer.
 * Keep this admission separate from share-link rotation checks; no DOMMatrix or projection lives here. */
export function parseRestoredCameraPose(value: unknown): number[] {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function') ||
      !('schema' in value) || value.schema !== CAMERA_POSE_SCHEMA) throw new TypeError('Physical camera pose is invalid.');
  const scene = 'scene' in value ? value.scene : undefined;
  return parseCameraPoseMatrix(scene, { rotation: 'finite' });
}
