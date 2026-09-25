import type { DisplayColorMatrix, Vector3 } from '../contracts/volume-recipe.ts';

const IDENTITY_DISPLAY_COLOR_MATRIX: DisplayColorMatrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Apply a bounded display transform to premultiplied emitted RGB. */
export function gradePremultipliedDisplayRgb(rgb: Vector3, matrix: DisplayColorMatrix = IDENTITY_DISPLAY_COLOR_MATRIX): Vector3 {
  return [
    matrix[0] * rgb[0] + matrix[1] * rgb[1] + matrix[2] * rgb[2],
    matrix[3] * rgb[0] + matrix[4] * rgb[1] + matrix[5] * rgb[2],
    matrix[6] * rgb[0] + matrix[7] * rgb[1] + matrix[8] * rgb[2],
  ];
}
