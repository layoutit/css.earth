/** Neutral source-independent smooth finite field; all image lenses use this exact geometry. */
import type { EmissionBounds, EmissionComponent, EmissionFieldModel } from './field-types.js';

export const EMISSION_KERNEL_CUTOFF = 4;
/** Integral of [(exp(-t²/2)−exp(-8))/(1−exp(-8))]² over −4<t<4. */
export const EMISSION_KERNEL_INTEGRAL = 1.7719617246363955;
const edge = Math.exp(-8), normalization = 1 / (1 - edge);
export function emissionKernel(t: number): number {
  if (Math.abs(t) >= EMISSION_KERNEL_CUTOFF) return 0;
  const value = (Math.exp(-.5 * t * t) - edge) * normalization; return value * value;
}
const tableSteps = 8192, tableScale = tableSteps / 16;
const kernelTable = Float64Array.from({ length: tableSteps + 1 }, (_, i) => emissionKernel(Math.sqrt(i / tableScale)));
function sampledKernelSquared(q: number): number {
  if (q >= 16) return 0;
  const x = q * tableScale, index = Math.floor(x); return kernelTable[index] + (kernelTable[index + 1] - kernelTable[index]) * (x - index);
}
export function emissionComponentBounds(component: EmissionComponent): EmissionBounds {
  const c = Math.cos(component.angleRadians), s = Math.sin(component.angleRadians), [sx, sy, sz] = component.sigma;
  const extent = [4 * (Math.abs(c) * sx + Math.abs(s) * sy), 4 * (Math.abs(s) * sx + Math.abs(c) * sy), 4 * sz];
  return { min: component.center.map((v, axis) => v - extent[axis]) as [number, number, number], max: component.center.map((v, axis) => v + extent[axis]) as [number, number, number] };
}
/** Analytic integration over the entire z support, in the same linear units as the fitted target. */
export function projectEmissionComponent(component: EmissionComponent, x: number, y: number): number {
  const c = Math.cos(component.angleRadians), s = Math.sin(component.angleRadians), dx = x - component.center[0], dy = y - component.center[1];
  return component.projectedWeight * emissionKernel((c * dx + s * dy) / component.sigma[0]) * emissionKernel((-s * dx + c * dy) / component.sigma[1]);
}
export function createEmissionField(model: EmissionFieldModel) {
  const components = model.components.map(component => {
    if (component.center.length !== 3 || component.sigma.length !== 3 || component.center.some(v => !Number.isFinite(v)) ||
        component.sigma.some(v => !Number.isFinite(v) || v <= 0) || !Number.isFinite(component.projectedWeight) || component.projectedWeight < 0 || !Number.isFinite(component.angleRadians))
      throw new TypeError('Invalid smooth emission component.');
    return { source: component, bounds: emissionComponentBounds(component), c: Math.cos(component.angleRadians), s: Math.sin(component.angleRadians),
      ix: 1 / component.sigma[0], iy: 1 / component.sigma[1], iz: 1 / component.sigma[2], gain: component.projectedWeight / (component.sigma[2] * EMISSION_KERNEL_INTEGRAL) };
  }).filter(c => c.gain > 0);
  const bounds: EmissionBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const component of components) for (let a = 0; a < 3; a++) { bounds.min[a] = Math.min(bounds.min[a], component.bounds.min[a]); bounds.max[a] = Math.max(bounds.max[a], component.bounds.max[a]); }
  const empty = components.length === 0;
  if (empty) { bounds.min = [-1, -1, -1]; bounds.max = [1, 1, 1]; }
  const longest = Math.max(...bounds.max.map((v, a) => v - bounds.min[a])), cell = longest / 32;
  const dimensions = bounds.max.map((v, a) => Math.max(1, Math.ceil((v - bounds.min[a]) / cell))), cells = dimensions[0] * dimensions[1] * dimensions[2];
  const counts = new Uint32Array(cells);
  const ranges = components.map(component => ({ min: component.bounds.min.map((v, a) => Math.max(0, Math.floor((v - bounds.min[a]) / cell))),
    max: component.bounds.max.map((v, a) => Math.min(dimensions[a] - 1, Math.floor((v - bounds.min[a]) / cell))) }));
  const visit = (range: typeof ranges[number], callback: (index: number) => void) => {
    for (let z = range.min[2]; z <= range.max[2]; z++) for (let y = range.min[1]; y <= range.max[1]; y++) for (let x = range.min[0]; x <= range.max[0]; x++) callback((z * dimensions[1] + y) * dimensions[0] + x);
  };
  for (const range of ranges) visit(range, index => counts[index]++);
  const offsets = new Uint32Array(cells + 1); for (let i = 0; i < cells; i++) offsets[i + 1] = offsets[i] + counts[i];
  const members = new Uint32Array(offsets[cells]), next = Uint32Array.from(offsets);
  ranges.forEach((range, component) => visit(range, index => { members[next[index]++] = component; }));
  const sampleEmission = (x: number, y: number, z: number, out: { [index: number]: number }): void => {
    let value = 0;
    if (x >= bounds.min[0] && y >= bounds.min[1] && z >= bounds.min[2] && x < bounds.max[0] && y < bounds.max[1] && z < bounds.max[2]) {
      const cx = Math.floor((x - bounds.min[0]) / cell), cy = Math.floor((y - bounds.min[1]) / cell), cz = Math.floor((z - bounds.min[2]) / cell);
      const index = (cz * dimensions[1] + cy) * dimensions[0] + cx;
      for (let at = offsets[index]; at < offsets[index + 1]; at++) {
        const c = components[members[at]], dx = x - c.source.center[0], dy = y - c.source.center[1], dz = (z - c.source.center[2]) * c.iz;
        if (Math.abs(dz) >= 4) continue;
        const u = (c.c * dx + c.s * dy) * c.ix, v = (-c.s * dx + c.c * dy) * c.iy;
        if (Math.abs(u) >= 4 || Math.abs(v) >= 4) continue;
        value += c.gain * sampledKernelSquared(u * u) * sampledKernelSquared(v * v) * sampledKernelSquared(dz * dz);
      }
    }
    out[0] = out[1] = out[2] = value;
  };
  return { bounds, empty, sampleEmission };
}
