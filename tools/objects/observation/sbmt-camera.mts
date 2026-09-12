import type { SbmtSumPointing, SbmtVector3 } from './sbmt-pointing.mts';

/**
 * Gaskell et al. (2023), DOI 10.3847/PSJ/acc4b9, Equations (1)-(3):
 * x_p = f (Cx dot W) / (Cz dot W), y_p = f (Cy dot W) / (Cz dot W), then
 * [sample, line] = [p0, l0] + [[Kxx, Kxy], [Kyx, Kyy]] [x_p, y_p].
 * The paper states that detector positions begin at (1, 1) in the upper left.
 * It also assigns an odd-mirror handedness change to the sign of Kyy.
 */
export const SBMT_SPC_CAMERA_EQUATIONS_URL = 'https://doi.org/10.3847/PSJ/acc4b9';

export interface SbmtArchivedCamera {
  readonly schema: 'cssearth-archived-camera@1';
  /** Homogeneous forward projection to cssEarth's zero-based array centers, for body-fixed points in kilometres. */
  readonly matrix: readonly [readonly [number, number, number, number], readonly [number, number, number, number], readonly [number, number, number, number]];
  /** Maps cssEarth's zero-based array centers to a body-fixed ray before normalization. */
  readonly rayMatrix: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
  /** Pinhole position in the SUM body-fixed frame, in kilometres. */
  readonly positionKm: SbmtVector3;
  readonly sunDirection: SbmtVector3;
}

const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const add = (a: readonly number[], b: readonly number[]) => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!] as const;
const scale = (factor: number, vector: readonly number[]) => [factor * vector[0]!, factor * vector[1]!, factor * vector[2]!] as const;

function inverse3(rows: readonly SbmtVector3[]): readonly SbmtVector3[] {
  const [[a, b, c], [d, e, f], [g, h, i]] = rows;
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new Error('SBMT SUM camera axes are singular.');
  return [
    [(e * i - f * h) / determinant, (c * h - b * i) / determinant, (b * f - c * e) / determinant],
    [(f * g - d * i) / determinant, (a * i - c * g) / determinant, (c * d - a * f) / determinant],
    [(d * h - e * g) / determinant, (b * g - a * h) / determinant, (a * e - b * d) / determinant],
  ];
}

function requireCameraAxes(pointing: SbmtSumPointing) {
  const axes = [pointing.sampleAxisBodyFixed, pointing.lineAxisBodyFixed, pointing.boresightBodyFixed];
  if (axes.some(axis => Math.abs(Math.hypot(...axis) - 1) > 1e-7) || Math.abs(dot(axes[0]!, axes[1]!)) > 1e-7 || Math.abs(dot(axes[0]!, axes[2]!)) > 1e-7 || Math.abs(dot(axes[1]!, axes[2]!)) > 1e-7) throw new Error('SBMT SUM camera axes are not an orthonormal body-fixed frame.');
  if (Math.abs(Math.hypot(...pointing.sunDirectionBodyFixed) - 1) > 1e-7) throw new Error('SBMT SUM sun direction is not a unit body-fixed vector.');
}

/**
 * Convert the documented zero-distortion framing-camera part of a SUM record
 * into the existing archived-camera transport.  This does not register any
 * terrain or alter the SUM position/pointing solution.
 *
 * SUM stores six K values, but the published equations define only Kxx, Kxy,
 * Kyx and Kyy. Refuse an unexplained third column instead of silently dropping
 * it. Likewise, the four distortion values require a model identifier absent
 * from SUM, so only the documented zero-distortion case is representable.
 */
export function sbmtSumToArchivedCamera(pointing: SbmtSumPointing): SbmtArchivedCamera {
  requireCameraAxes(pointing);
  const [[kxx, kxy, kx0], [kyx, kyy, ky0]] = pointing.kMatrix;
  if (kx0 !== 0 || ky0 !== 0) throw new Error('SBMT SUM K-matrix third-column terms have no published projection equation.');
  if (pointing.distortion.some(value => value !== 0)) throw new Error('SBMT SUM nonzero distortion requires its source distortion model.');
  const determinant = kxx * kyy - kxy * kyx;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new Error('SBMT SUM K-matrix is singular.');

  const inverse = [[kyy / determinant, -kxy / determinant], [-kyx / determinant, kxx / determinant]] as const;
  const [sampleCenter, lineCenter] = pointing.opticalAxisSampleLineCenter;
  const focal = pointing.focalLengthMillimetres;
  // The SUM vectors are rounded text. Use their exact matrix inverse, rather
  // than treating their printed values as perfectly orthogonal, so the inverse
  // ray and forward projection remain mathematical inverses without changing
  // any published vector.
  const basisInverse = inverse3([pointing.sampleAxisBodyFixed, pointing.lineAxisBodyFixed, pointing.boresightBodyFixed]);
  const sampleVector: SbmtVector3 = [
    (basisInverse[0]![0] * inverse[0][0] + basisInverse[0]![1] * inverse[1][0]) / focal,
    (basisInverse[1]![0] * inverse[0][0] + basisInverse[1]![1] * inverse[1][0]) / focal,
    (basisInverse[2]![0] * inverse[0][0] + basisInverse[2]![1] * inverse[1][0]) / focal,
  ];
  const lineVector: SbmtVector3 = [
    (basisInverse[0]![0] * inverse[0][1] + basisInverse[0]![1] * inverse[1][1]) / focal,
    (basisInverse[1]![0] * inverse[0][1] + basisInverse[1]![1] * inverse[1][1]) / focal,
    (basisInverse[2]![0] * inverse[0][1] + basisInverse[2]![1] * inverse[1][1]) / focal,
  ];
  const nativeConstantVector: SbmtVector3 = [
    basisInverse[0]![2] - sampleCenter * sampleVector[0] - lineCenter * lineVector[0],
    basisInverse[1]![2] - sampleCenter * sampleVector[1] - lineCenter * lineVector[1],
    basisInverse[2]![2] - sampleCenter * sampleVector[2] - lineCenter * lineVector[2],
  ];
  // Gaskell et al.'s p/l coordinates begin at (1,1); retained raster arrays
  // here begin at (0,0). Substitute p=x+1 and l=y+1 in both equations.
  const constantVector = add(nativeConstantVector, add(sampleVector, lineVector));
  const positionKm: SbmtVector3 = [-pointing.spacecraftToObjectCenterBodyFixed[0], -pointing.spacecraftToObjectCenterBodyFixed[1], -pointing.spacecraftToObjectCenterBodyFixed[2]];
  const numeratorSample = add(scale(sampleCenter, pointing.boresightBodyFixed), add(scale(focal * kxx, pointing.sampleAxisBodyFixed), scale(focal * kxy, pointing.lineAxisBodyFixed)));
  const numeratorLine = add(scale(lineCenter, pointing.boresightBodyFixed), add(scale(focal * kyx, pointing.sampleAxisBodyFixed), scale(focal * kyy, pointing.lineAxisBodyFixed)));
  const offset = (row: readonly number[]) => -dot(row, positionKm);

  return {
    schema: 'cssearth-archived-camera@1',
    matrix: [[numeratorSample[0] - pointing.boresightBodyFixed[0], numeratorSample[1] - pointing.boresightBodyFixed[1], numeratorSample[2] - pointing.boresightBodyFixed[2], offset(numeratorSample) - offset(pointing.boresightBodyFixed)], [numeratorLine[0] - pointing.boresightBodyFixed[0], numeratorLine[1] - pointing.boresightBodyFixed[1], numeratorLine[2] - pointing.boresightBodyFixed[2], offset(numeratorLine) - offset(pointing.boresightBodyFixed)], [pointing.boresightBodyFixed[0], pointing.boresightBodyFixed[1], pointing.boresightBodyFixed[2], offset(pointing.boresightBodyFixed)]],
    rayMatrix: [[sampleVector[0], lineVector[0], constantVector[0]], [sampleVector[1], lineVector[1], constantVector[1]], [sampleVector[2], lineVector[2], constantVector[2]]],
    positionKm,
    sunDirection: pointing.sunDirectionBodyFixed,
  };
}

/** Project a body-fixed point in kilometres through an adapted SUM camera to zero-based array centers. */
export function projectSbmtArchivedCamera(camera: SbmtArchivedCamera, pointKm: SbmtVector3): readonly [number, number] | null {
  const projective = camera.matrix.map(row => row[0] * pointKm[0] + row[1] * pointKm[1] + row[2] * pointKm[2] + row[3]);
  if (!(projective[2]! > 0) || !projective.every(Number.isFinite)) return null;
  return [projective[0]! / projective[2]!, projective[1]! / projective[2]!];
}
