/** Neutral source-independent smooth finite field; all image lenses use this exact geometry. */
import type { EmissionBounds, EmissionComponent, EmissionFieldModel, EmissionVector3 } from '../contracts/emission.ts';
import { createEmissionWindowSampler } from './emission-window.ts';

export const EMISSION_KERNEL_CUTOFF = 4;
/** Bounded angular-depth slope, not a measured distance or a recovered viewing angle. */
export const MAX_EMISSION_DEPTH_GRADIENT = 100;
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
function validateGradient(component: EmissionComponent): void {
  const gradient = component.depthGradient;
  if (gradient !== undefined && (!Array.isArray(gradient) || gradient.length !== 2 ||
      gradient.some(value => !Number.isFinite(value) || Math.abs(value) > MAX_EMISSION_DEPTH_GRADIENT)))
    throw new TypeError('Invalid emission depth gradient.');
}
export function emissionComponentBounds(component: EmissionComponent): EmissionBounds {
  validateGradient(component);
  const c = Math.cos(component.angleRadians), s = Math.sin(component.angleRadians), [sx, sy, sz] = component.sigma;
  const gx = component.depthGradient?.[0] ?? 0, gy = component.depthGradient?.[1] ?? 0;
  // The local box axes map to (c*sx,s*sx,g·axis) and (-s*sy,c*sy,g·axis).
  // Summing their absolute contributions includes every sheared finite-support corner.
  const extent = [4 * (Math.abs(c) * sx + Math.abs(s) * sy), 4 * (Math.abs(s) * sx + Math.abs(c) * sy),
    4 * (sz + Math.abs(gx * c + gy * s) * sx + Math.abs(-gx * s + gy * c) * sy)];
  return { min: component.center.map((v, axis) => v - extent[axis]) as [number, number, number], max: component.center.map((v, axis) => v + extent[axis]) as [number, number, number] };
}
/** Analytic integration over the entire z support, in the same linear units as the fitted target. */
export function projectEmissionComponent(component: EmissionComponent, x: number, y: number): number {
  validateGradient(component);
  const c = Math.cos(component.angleRadians), s = Math.sin(component.angleRadians), dx = x - component.center[0], dy = y - component.center[1];
  return component.projectedWeight * emissionKernel((c * dx + s * dy) / component.sigma[0]) * emissionKernel((-s * dx + c * dy) / component.sigma[1]);
}
export interface PreparedEmissionComponent {
  source: EmissionComponent; bounds: EmissionBounds;
  c: number; s: number; ix: number; iy: number; iz: number; gx: number; gy: number; gain: number;
}
/** Cache transforms once before repeated offline material/volume samples. */
export function prepareEmissionComponent(component: EmissionComponent): PreparedEmissionComponent {
  if (component.center.length !== 3 || component.sigma.length !== 3 || component.center.some(v => !Number.isFinite(v)) ||
      component.sigma.some(v => !Number.isFinite(v) || v <= 0) || !Number.isFinite(component.projectedWeight) || component.projectedWeight < 0 || !Number.isFinite(component.angleRadians))
    throw new TypeError('Invalid smooth emission component.');
  const bounds = emissionComponentBounds(component), gain = component.projectedWeight / (component.sigma[2] * EMISSION_KERNEL_INTEGRAL);
  if (!Number.isFinite(gain) || bounds.min.some((n, axis) => !Number.isFinite(n) || !Number.isFinite(bounds.max[axis]) || n >= bounds.max[axis]))
    throw new TypeError('Emission component support exceeds finite representable bounds.');
  return { source: component, bounds, c: Math.cos(component.angleRadians), s: Math.sin(component.angleRadians),
    ix: 1 / component.sigma[0], iy: 1 / component.sigma[1], iz: 1 / component.sigma[2],
    gx: component.depthGradient?.[0] ?? 0, gy: component.depthGradient?.[1] ?? 0, gain };
}
/** A shear has unit z Jacobian: local inclination changes support, never projected light. */
export function samplePreparedEmissionComponent(c: PreparedEmissionComponent, x: number, y: number, z: number): number {
  const dx = x - c.source.center[0], dy = y - c.source.center[1];
  const dz = (z - c.source.center[2] - c.gx * dx - c.gy * dy) * c.iz;
  if (Math.abs(dz) >= 4) return 0;
  const u = (c.c * dx + c.s * dy) * c.ix, v = (-c.s * dx + c.c * dy) * c.iy;
  if (Math.abs(u) >= 4 || Math.abs(v) >= 4) return 0;
  return c.gain * sampledKernelSquared(u * u) * sampledKernelSquared(v * v) * sampledKernelSquared(dz * dz);
}
export function createEmissionField(model: EmissionFieldModel) {
  const windowWeight = createEmissionWindowSampler(model.emissionWindow);
  const components = model.components.map((component, sourceIndex) => ({ ...prepareEmissionComponent(component), sourceIndex })).filter(c => c.gain > 0);
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
      const cx = Math.min(dimensions[0] - 1, Math.floor((x - bounds.min[0]) / cell)),
        cy = Math.min(dimensions[1] - 1, Math.floor((y - bounds.min[1]) / cell)),
        cz = Math.min(dimensions[2] - 1, Math.floor((z - bounds.min[2]) / cell));
      const index = (cz * dimensions[1] + cy) * dimensions[0] + cx;
      for (let at = offsets[index]; at < offsets[index + 1]; at++) {
        value += samplePreparedEmissionComponent(components[members[at]], x, y, z);
      }
    }
    out[0] = out[1] = out[2] = value * windowWeight(x, y);
  };
  /** Attach immutable component colors to this same spatial index; color cannot add support. */
  const createMaterialSampler = (colors: readonly { rgb: EmissionVector3; covered: boolean }[]) => {
    if (colors.length !== model.components.length || colors.some(color => typeof color.covered !== 'boolean' ||
      !Array.isArray(color.rgb) || color.rgb.length !== 3 || color.rgb.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 255)))
      throw new TypeError('Emission material requires one finite RGB color and coverage flag per component.');
    const attached = colors.map(color => ({ rgb: [...color.rgb] as EmissionVector3, covered: color.covered }));
    return (x: number, y: number, z: number, out: EmissionVector3): boolean => {
      out[0] = out[1] = out[2] = 0;
      // The same scalar multiplies every emitter, so it cancels from interior RGB ratios.
      if (!(windowWeight(x, y) > 0)) return false;
      if (!(x >= bounds.min[0] && y >= bounds.min[1] && z >= bounds.min[2] && x < bounds.max[0] && y < bounds.max[1] && z < bounds.max[2])) return false;
      const cx = Math.min(dimensions[0] - 1, Math.floor((x - bounds.min[0]) / cell)),
        cy = Math.min(dimensions[1] - 1, Math.floor((y - bounds.min[1]) / cell)),
        cz = Math.min(dimensions[2] - 1, Math.floor((z - bounds.min[2]) / cell));
      const index = (cz * dimensions[1] + cy) * dimensions[0] + cx;
      let weight = 0, covered = 0;
      for (let at = offsets[index]; at < offsets[index + 1]; at++) {
        const component = components[members[at]], light = samplePreparedEmissionComponent(component, x, y, z);
        if (!(light > 0)) continue;
        const material = attached[component.sourceIndex]; weight += light;
        if (material.covered) covered += light;
        for (let c = 0; c < 3; c++) out[c] += light * material.rgb[c];
      }
      if (!(weight > 0) || !(covered > 0)) return false;
      for (let c = 0; c < 3; c++) out[c] = Math.max(0, Math.min(255, out[c] / weight));
      return true;
    };
  };
  return { bounds, empty, sampleEmission, createMaterialSampler };
}
