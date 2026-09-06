/** Numeric preparation only. Renderer adapters supply their actual authored axes and scale. */
export type Vector3 = readonly [number, number, number];
export type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];
export interface PhysicalWorldFrame {
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  readonly originM: Vector3;
  readonly presentationToReference: Matrix3;
  readonly orbitUpReference: Vector3;
  readonly metersPerUnit: number;
  readonly bodyRadiusM: number;
}
export interface PhysicalFrameInput {
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  readonly originM: Vector3;
  readonly bodyToReference: Matrix3;
  readonly bodyToPresentation: Matrix3;
  readonly orbitUpReference: Vector3;
  readonly renderedRadiusUnits: number;
  readonly physicalRadiusM: number;
}

export function preparePhysicalWorldFrame(input: PhysicalFrameInput): PhysicalWorldFrame {
  if (!input.referenceFrame || !(input.epochJdTt > 0)) throw new TypeError('Physical frame needs a reference and epoch.');
  vector(input.originM); unitVector(input.orbitUpReference);
  rotation(input.bodyToReference); rotation(input.bodyToPresentation);
  if (![input.renderedRadiusUnits, input.physicalRadiusM].every(value => Number.isFinite(value) && value > 0)) throw new TypeError('Physical frame radii must be positive.');
  return Object.freeze({ referenceFrame: input.referenceFrame, epochJdTt: input.epochJdTt,
    originM: Object.freeze([...input.originM]) as Vector3,
    presentationToReference: multiply(input.bodyToReference, transpose(input.bodyToPresentation)),
    orbitUpReference: Object.freeze([...input.orbitUpReference]) as Vector3,
    metersPerUnit: input.physicalRadiusM / input.renderedRadiusUnits, bodyRadiusM: input.physicalRadiusM });
}

export function multiply(left: Matrix3, right: Matrix3): Matrix3 {
  return Object.freeze(Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3), column = index % 3;
    return left[row * 3] * right[column] + left[row * 3 + 1] * right[3 + column] + left[row * 3 + 2] * right[6 + column];
  })) as unknown as Matrix3;
}
export function transpose(matrix: Matrix3): Matrix3 {
  return Object.freeze([matrix[0], matrix[3], matrix[6], matrix[1], matrix[4], matrix[7], matrix[2], matrix[5], matrix[8]]);
}
export function transform(matrix: Matrix3, value: Vector3): Vector3 {
  return [0, 1, 2].map(row => matrix[row * 3] * value[0] + matrix[row * 3 + 1] * value[1] + matrix[row * 3 + 2] * value[2]) as unknown as Vector3;
}
export function rotation(value: readonly number[]): asserts value is Matrix3 {
  if (value.length !== 9 || value.some(component => !Number.isFinite(component))) throw new TypeError('Physical frame needs a finite rotation.');
  const matrix = value as Matrix3, product = multiply(matrix, transpose(matrix));
  if (product.some((component, index) => Math.abs(component - (index % 4 === 0 ? 1 : 0)) > 1e-8)) throw new TypeError('Physical frame axes must be orthonormal.');
  const determinant = matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) - matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) + matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6]);
  if (Math.abs(determinant - 1) > 1e-8) throw new TypeError('Physical frame must preserve handedness.');
}
function vector(value: Vector3): void {
  if (!Array.isArray(value) || value.length !== 3 || value.some(component => !Number.isFinite(component))) throw new TypeError('Physical frame position must be finite.');
}
function unitVector(value: Vector3): void {
  vector(value);
  if (Math.abs(Math.hypot(...value) - 1) > 1e-8) throw new TypeError('Physical frame orbit pole must be unit length.');
}
