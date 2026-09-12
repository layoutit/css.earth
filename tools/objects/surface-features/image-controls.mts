type Pixel = readonly [number, number];
type Partition = 'fit' | 'holdout';
type Model = 'similarity' | 'reflected-similarity' | 'affine';
type Coefficients = readonly [number, number, number, number] | readonly [number, number, number, number, number, number];

export interface ImageControlResidual {
  readonly id: string;
  readonly partition: Partition;
  readonly sourcePixel: Pixel;
  readonly targetPixel: Pixel;
  readonly transformedPixel: Pixel;
  readonly residualPixels: number;
}

export interface ImageControlStats {
  readonly count: number;
  readonly rmsPixels: number;
  readonly maximumPixels: number;
}

export interface ImageControlsFit {
  readonly model: Model;
  /** Similarity coefficients are [a, b, tx, ty]: x'=ax-by+tx, y'=bx+ay+ty.
   * Affine coefficients are [a, b, tx, c, d, ty]: x'=ax+by+tx, y'=cx+dy+ty. */
  readonly coefficients: Coefficients;
  readonly stats: Readonly<Record<Partition, ImageControlStats>>;
  readonly residuals: readonly ImageControlResidual[];
  transform(point: Pixel): Pixel;
  inverse(point: Pixel): Pixel;
}

interface Control { readonly id: string; readonly partition: Partition; readonly sourcePixel: Pixel; readonly targetPixel: Pixel; }
interface Document { readonly model: Model; readonly controls: readonly Control[]; readonly maximumRmsPixels: number; readonly maximumResidualPixels: number; }

const record = (value: unknown, at: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`);
  return value as Record<string, unknown>;
};
const finite = (value: unknown, at: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${at} must be finite.`);
  return value;
};
const nonnegative = (value: unknown, at: string): number => {
  const result = finite(value, at);
  if (result < 0) throw new TypeError(`${at} must be nonnegative.`);
  return result;
};
const pixel = (value: unknown, at: string): Pixel => {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError(`${at} must have two components.`);
  return [finite(value[0], `${at}[0]`), finite(value[1], `${at}[1]`)];
};

function parse(value: unknown): Document {
  const doc = record(value, 'image controls');
  if (doc.schema !== 'cssearth-image-controls@1') throw new TypeError('Unsupported image-controls schema.');
  const model = doc.model;
  if (model !== 'similarity' && model !== 'reflected-similarity' && model !== 'affine') throw new TypeError('Image controls need a supported model.');
  if (!Array.isArray(doc.controls)) throw new TypeError('Image controls must list controls.');
  const ids = new Set<string>();
  const controls = doc.controls.map((value, index): Control => {
    const control = record(value, `image control ${index}`);
    if (typeof control.id !== 'string' || !control.id.trim() || ids.has(control.id)) throw new TypeError('Image controls need distinct nonempty ids.');
    ids.add(control.id);
    if (control.partition !== 'fit' && control.partition !== 'holdout') throw new TypeError('Image controls need fit or holdout partitions.');
    return { id: control.id, partition: control.partition, sourcePixel: pixel(control.sourcePixel, `image control ${control.id} source pixel`), targetPixel: pixel(control.targetPixel, `image control ${control.id} target pixel`) };
  });
  const fit = controls.filter(control => control.partition === 'fit'), holdout = controls.filter(control => control.partition === 'holdout');
  if (fit.length < 3 || holdout.length < 3) throw new TypeError('Image controls need at least three fit and three holdout controls.');
  if (!nonCollinear(fit.map(control => control.sourcePixel))) throw new TypeError('Image-control fit source pixels are collinear or degenerate.');
  return { model, controls, maximumRmsPixels: nonnegative(doc.maximumRmsPixels, 'Image-control maximum RMS'), maximumResidualPixels: nonnegative(doc.maximumResidualPixels, 'Image-control maximum residual') };
}

function nonCollinear(points: readonly Pixel[]) {
  const minX = Math.min(...points.map(point => point[0])), maxX = Math.max(...points.map(point => point[0]));
  const minY = Math.min(...points.map(point => point[1])), maxY = Math.max(...points.map(point => point[1]));
  const scale = Math.max(maxX - minX, maxY - minY, 1);
  for (let first = 0; first < points.length - 2; first++) for (let second = first + 1; second < points.length - 1; second++) for (let third = second + 1; third < points.length; third++) {
    const a = points[first]!, b = points[second]!, c = points[third]!;
    const twiceArea = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    if (twiceArea > scale * scale * 1e-10) return true;
  }
  return false;
}

function solve(matrix: number[][], vector: number[]) {
  const size = vector.length;
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) if (Math.abs(matrix[row]![column]!) > Math.abs(matrix[pivot]![column]!)) pivot = row;
    const value = matrix[pivot]![column]!;
    if (!Number.isFinite(value) || value === 0) throw new TypeError(`Image-control fit is degenerate at column ${column}.`);
    [matrix[column], matrix[pivot]] = [matrix[pivot]!, matrix[column]!]; [vector[column], vector[pivot]] = [vector[pivot]!, vector[column]!];
    for (let index = column; index < size; index++) matrix[column]![index]! /= value;
    vector[column]! /= value;
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = matrix[row]![column]!;
      for (let index = column; index < size; index++) matrix[row]![index]! -= factor * matrix[column]![index]!;
      vector[row]! -= factor * vector[column]!;
    }
  }
  if (!vector.every(Number.isFinite)) throw new TypeError('Image-control fit has non-finite coefficients.');
  return vector;
}

function fitCoefficients(model: Model, controls: readonly Control[]) {
  if (model === 'affine') {
    const axis = (target: 0 | 1) => {
      const normal = Array.from({ length: 3 }, () => Array(3).fill(0)), rhs = Array(3).fill(0);
      for (const control of controls) {
        const row = [control.sourcePixel[0], control.sourcePixel[1], 1], value = control.targetPixel[target];
        for (let i = 0; i < 3; i++) { rhs[i]! += row[i]! * value; for (let j = 0; j < 3; j++) normal[i]![j]! += row[i]! * row[j]!; }
      }
      return solve(normal, rhs) as [number, number, number];
    };
    const [a, b, tx] = axis(0), [c, d, ty] = axis(1), determinant = a * d - b * c;
    if (!(Math.abs(determinant) > 1e-20)) throw new TypeError('Image-control fit has zero area.');
    return [a, b, tx, c, d, ty] as Coefficients;
  }
  const size = 4;
  const normal = Array.from({ length: size }, () => Array(size).fill(0)), rhs = Array(size).fill(0);
  const add = (row: readonly number[], target: number) => {
    for (let i = 0; i < size; i++) {
      rhs[i]! += row[i]! * target;
      for (let j = 0; j < 4; j++) normal[i]![j]! += row[i]! * row[j]!;
    }
  };
  for (const control of controls) {
    const [x, y] = control.sourcePixel, [u, v] = control.targetPixel;
    if (model === 'similarity') { add([x, -y, 1, 0], u); add([y, x, 0, 1], v); }
    else if (model === 'reflected-similarity') { add([-x, y, 1, 0], u); add([y, x, 0, 1], v); }
    else { add([-x, y, 1, 0], u); add([y, x, 0, 1], v); }
  }
  const coefficients = solve(normal, rhs);
  const determinant = coefficients[0]! ** 2 + coefficients[1]! ** 2;
  if (!(Math.abs(determinant) > 1e-20)) throw new TypeError('Image-control fit has zero scale or area.');
  return coefficients as unknown as Coefficients;
}

export function fitImageControls(value: unknown): ImageControlsFit {
  const doc = parse(value), fitControls = doc.controls.filter(control => control.partition === 'fit');
  const coefficients = fitCoefficients(doc.model, fitControls);
  const transform = ([x, y]: Pixel): Pixel => {
    if (doc.model === 'affine') { const [a, b, tx, c, d, ty] = coefficients as readonly [number, number, number, number, number, number]; return [a * x + b * y + tx, c * x + d * y + ty]; }
    const [a, b, tx, ty] = coefficients as readonly [number, number, number, number];
    return doc.model === 'similarity' ? [a * x - b * y + tx, b * x + a * y + ty] : [-a * x + b * y + tx, b * x + a * y + ty];
  };
  const inverse = ([x, y]: Pixel): Pixel => {
    if (doc.model === 'affine') {
      const [a, b, tx, c, d, ty] = coefficients as readonly [number, number, number, number, number, number], determinant = a * d - b * c, u = x - tx, v = y - ty;
      return [(d * u - b * v) / determinant, (-c * u + a * v) / determinant];
    }
    const [a, b, tx, ty] = coefficients as readonly [number, number, number, number];
    const scaleSquared = a * a + b * b;
    const u = x - tx, v = y - ty;
    return doc.model === 'similarity' ? [(a * u + b * v) / scaleSquared, (-b * u + a * v) / scaleSquared] : [(-a * u + b * v) / scaleSquared, (b * u + a * v) / scaleSquared];
  };
  const residuals = doc.controls.map(control => {
    const transformedPixel = transform(control.sourcePixel);
    return { ...control, transformedPixel, residualPixels: Math.hypot(transformedPixel[0] - control.targetPixel[0], transformedPixel[1] - control.targetPixel[1]) };
  });
  const stat = (partition: Partition): ImageControlStats => {
    const selected = residuals.filter(control => control.partition === partition);
    return { count: selected.length, rmsPixels: Math.sqrt(selected.reduce((sum, control) => sum + control.residualPixels ** 2, 0) / selected.length), maximumPixels: Math.max(...selected.map(control => control.residualPixels)) };
  };
  const stats = { fit: stat('fit'), holdout: stat('holdout') };
  for (const partition of ['fit', 'holdout'] as const) {
    const current = stats[partition];
    if (current.rmsPixels > doc.maximumRmsPixels || current.maximumPixels > doc.maximumResidualPixels) throw new TypeError(`Image-control ${partition} exceeds declared thresholds (RMS ${current.rmsPixels}, maximum ${current.maximumPixels}).`);
  }
  return { model: doc.model, coefficients, stats, residuals, transform, inverse };
}
