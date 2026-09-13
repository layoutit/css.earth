/** Image-conditioned emission in an explicitly supplied geometric depth prior.
 * This is a modeled depth allocation, not single-image tomographic recovery.
 */
import type { InferenceGrid, IterationReport } from './solver.js';
import { projectEmission } from './solver.js';

export interface ShapeComponent {
  kind: 'torus' | 'disk';
  axis: [number, number, number];
  radius: number;
  radialSigma: number;
  axialSigma: number;
  weight: number;
}
export interface ShapePrior { components: ShapeComponent[]; sigmaCutoff: number; }

export function geometricDepth(grid: InferenceGrid, center: readonly number[], prior: ShapePrior): Float32Array {
  if (center.length !== 3 || center.some(v => !Number.isFinite(v)) ||
      !Number.isFinite(prior.sigmaCutoff) || prior.sigmaCutoff <= 0 || prior.sigmaCutoff > 8 || !prior.components.length)
    throw new TypeError('Finite center, bounded positive cutoff and geometric components required.');
  const count = grid.width * grid.height * grid.depth;
  if ([grid.width, grid.height, grid.depth].some(v => !Number.isInteger(v) || v < 2) || count > 4_000_000)
    throw new TypeError('Invalid bounded geometric-prior grid.');
  const components = prior.components.map(component => {
    if (!['torus', 'disk'].includes(component.kind) ||
        [component.radius, component.radialSigma, component.axialSigma, component.weight].some(v => !Number.isFinite(v) || v <= 0) ||
        component.axis.length !== 3 || component.axis.some(v => !Number.isFinite(v)) || Math.hypot(...component.axis) < 1e-10)
      throw new TypeError('Invalid geometric component.');
    const norm = Math.hypot(...component.axis);
    return { ...component, axis: component.axis.map(v => v / norm) };
  });
  const density = new Float32Array(count);
  for (let z = 0; z < grid.depth; z++) for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
    const dx = x - center[0]!, dy = y - center[1]!, dz = z - center[2]!;
    let value = 0;
    for (const component of components) {
      const axial = dx * component.axis[0]! + dy * component.axis[1]! + dz * component.axis[2]!;
      const radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - axial * axial));
      const dr = (component.kind === 'torus' ? radial - component.radius : Math.max(0, radial - component.radius)) / component.radialSigma;
      const da = axial / component.axialSigma, squared = dr * dr + da * da;
      if (squared < prior.sigmaCutoff ** 2) value += component.weight * Math.exp(-.5 * squared);
    }
    density[(z * grid.height + y) * grid.width + x] = value;
  }
  return density;
}

export function conditionEmission(image: Float32Array, density: Float32Array, grid: InferenceGrid): {
  volume: Float32Array; report: IterationReport; uncoveredSignalFraction: number;
} {
  if (image.length !== grid.width * grid.height || image.some(v => !Number.isFinite(v) || v < 0) ||
      density.some(v => !Number.isFinite(v) || v < 0)) throw new TypeError('Invalid image or depth prior.');
  const columns = projectEmission(density, grid), volume = new Float32Array(density.length);
  for (let i = 0; i < volume.length; i++) {
    const pixel = i % image.length, column = columns[pixel]!;
    volume[i] = column > 1e-5 ? image[pixel]! * density[i]! / column : 0;
  }
  const projection = projectEmission(volume, grid);
  let error = 0, norm = 0, missing = 0, total = 0;
  for (let p = 0; p < image.length; p++) {
    error += (projection[p]! - image[p]!) ** 2; norm += image[p]! ** 2;
    total += image[p]!; if (columns[p]! <= 1e-5) missing += image[p]!;
  }
  return { volume, report: { iteration: 0, relativeChange: 0,
    relativeProjectionError: Math.sqrt(error / Math.max(norm, 1e-30)) }, uncoveredSignalFraction: missing / Math.max(total, 1e-30) };
}
