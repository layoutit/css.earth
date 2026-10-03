import { array, number, shape, text } from '@cssearth/core';

export const ARCHIVED_CAMERA_SCHEMA = 'cssearth-archived-camera@1';

/** Historical authored reader; geometric admission is a separate policy. */
export const archivedCameraFields = {schema:text,matrix:array(array(number)),rayMatrix:array(array(number)),positionKm:array(number),sunDirection:array(number)};
export const parseArchivedCamera = shape(archivedCameraFields);
export type ArchivedCamera = ReturnType<typeof parseArchivedCamera>;

/** Preserve the matrix-camera reader's geometric checks and diagnostics. */
export function parseMatrixArchivedCamera(value: unknown): ArchivedCamera {
  const camera = parseArchivedCamera(value);
  if (camera.schema !== ARCHIVED_CAMERA_SCHEMA ||
      camera.matrix?.length !== 3 || camera.matrix.some(r => r.length !== 4 || !r.every(Number.isFinite)) ||
      camera.rayMatrix?.length !== 3 || camera.rayMatrix.some(r => r.length !== 3 || !r.every(Number.isFinite)) ||
      camera.positionKm?.length !== 3 || !camera.positionKm.every(Number.isFinite) ||
      camera.sunDirection?.length !== 3 || Math.abs(Math.hypot(...camera.sunDirection) - 1) > 1e-9) throw new Error('Invalid archived source camera.');
  return camera;
}

export interface SpiceCamera {
  readonly schema: typeof ARCHIVED_CAMERA_SCHEMA;
  /** Body-fixed kilometres to pixel (column, row) with a positive third coordinate in front of the camera. */
  readonly matrix: number[][];
  /** Pixel (column, row, 1) to an unnormalised ray in the body-fixed frame. */
  readonly rayMatrix: number[][];
  readonly positionKm: number[]; readonly sunDirection: number[];
  readonly width: number; readonly height: number;
  readonly report: { instrumentFrame: string; focalLengthMm: number; pixelPitchMm: number; focalLengthPixels: number; center: number[]; boresight: number[];
    rangeKm: number; lightTimeSeconds: number; emissionEt: number; aberration: 'LT+S' | 'LT' | 'CN+S' | 'CN' | 'NONE'; aberrationMicroradians: number; sunDistanceKm: number; phaseAngleDegrees: number };
}
