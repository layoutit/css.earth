/** Bounded positive multiscale fit, followed by explicitly conditional 3D depth assignment. */
import { createHash } from 'node:crypto';
import { jointRayDepths } from '../joint/geometry.ts';
import { readJointParameters } from '@cssearth/volume-core/contracts/joint-parameters';
import { createEmissionField, emissionKernel, projectEmissionComponent } from '@cssearth/volume-core/fields/emission';
import { defaultCompilerControls, readCompilerControls, type CompilerControls, type EmissionComponent, type EmissionFieldModel, type EmissionFitInput, type EmissionFitResult } from '@cssearth/volume-core/contracts/emission';
import { conditionDepthComponents, readDepthRecipe, type DepthRecipe } from './depth-model.ts';
import { createEmissionWindowSampler, readEmissionWindow } from '@cssearth/volume-core/fields/emission-window';

interface Basis {
  x: number; y: number; sigma: number; weight: number; pixels: Uint32Array; values: Float32Array; norm: number;
  depths: number[]; halo: boolean;
}
interface FitGrid { width: number; height: number; target: Float64Array; coverage: Float64Array; dx: number; dy: number; window?: Float64Array }
function validateInput(input: EmissionFitInput): void {
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width < 2 || input.height < 2 || input.width * input.height > 2_000_000 ||
      !(input.target instanceof Float32Array) || input.target.length !== input.width * input.height || input.target.some(v => !Number.isFinite(v) || v < 0)) throw new TypeError('Compiler target requires a bounded finite nonnegative Float32 raster.');
  if (!input.bounds || input.bounds.min.length !== 2 || input.bounds.max.length !== 2 || input.bounds.min.some((v, i) => !Number.isFinite(v) || !Number.isFinite(input.bounds.max[i]) || v >= input.bounds.max[i]))
    throw new TypeError('Compiler sky bounds must contain increasing finite xWest/yNorth coordinates.');
  if (input.coverage && (input.coverage.length !== input.target.length || input.coverage.some(v => v !== 0 && v !== 1))) throw new TypeError('Compiler coverage must match the target with 0/1 eligibility.');
  if (input.scaffold) readJointParameters(input.scaffold);
  if (input.emissionWindow) readEmissionWindow(input.emissionWindow);
  if (input.velocityCoverage?.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.radiusArcsec) || p.radiusArcsec <= 0)) throw new TypeError('Invalid measured velocity footprint.');
}
function fitGrid(input: EmissionFitInput, detail: number): FitGrid {
  const limit = Math.round(256 + 256 * detail), ratio = Math.min(1, limit / Math.max(input.width, input.height));
  const width = Math.max(2, Math.round(input.width * ratio)), height = Math.max(2, Math.round(input.height * ratio));
  const target = new Float64Array(width * height), coverage = new Float64Array(width * height), total = new Uint32Array(width * height);
  for (let y = 0; y < input.height; y++) for (let x = 0; x < input.width; x++) {
    const p = y * input.width + x, q = Math.min(height - 1, Math.floor(y * height / input.height)) * width + Math.min(width - 1, Math.floor(x * width / input.width));
    total[q]++; if (!input.coverage || input.coverage[p]) { target[q] += input.target[p]; coverage[q]++; }
  }
  for (let p = 0; p < target.length; p++) { if (coverage[p]) target[p] /= coverage[p]; coverage[p] /= Math.max(1, total[p]); }
  const dx = (input.bounds.max[0] - input.bounds.min[0]) / width, dy = (input.bounds.max[1] - input.bounds.min[1]) / height;
  const sampleWindow = createEmissionWindowSampler(input.emissionWindow);
  const window = input.emissionWindow ? Float64Array.from({ length: target.length }, (_, p) =>
    sampleWindow(input.bounds.min[0] + (p % width + .5) * dx, input.bounds.max[1] - (Math.floor(p / width) + .5) * dy)) : undefined;
  return { width, height, target, coverage, dx, dy, ...(window ? { window } : {}) };
}
function newBasis(x: number, y: number, sigma: number, grid: FitGrid, input: EmissionFitInput, depths: number[], halo: boolean): Basis {
  const minX = Math.max(0, Math.floor((x - 4 * sigma - input.bounds.min[0]) / grid.dx));
  const maxX = Math.min(grid.width - 1, Math.ceil((x + 4 * sigma - input.bounds.min[0]) / grid.dx));
  const minY = Math.max(0, Math.floor((input.bounds.max[1] - y - 4 * sigma) / grid.dy));
  const maxY = Math.min(grid.height - 1, Math.ceil((input.bounds.max[1] - y + 4 * sigma) / grid.dy));
  const pixels: number[] = [], values: number[] = []; let norm = 0;
  for (let py = minY; py <= maxY; py++) {
    const gy = emissionKernel((input.bounds.max[1] - (py + .5) * grid.dy - y) / sigma); if (!gy) continue;
    for (let px = minX; px <= maxX; px++) {
      const p = py * grid.width + px; if (!grid.coverage[p]) continue;
      const value = gy * emissionKernel((input.bounds.min[0] + (px + .5) * grid.dx - x) / sigma) * (grid.window?.[p] ?? 1); if (value < 1e-8) continue;
      pixels.push(p); values.push(value); norm += grid.coverage[p] * value * value;
    }
  }
  return { x, y, sigma, pixels: Uint32Array.from(pixels), values: Float32Array.from(values), norm, weight: 0, depths, halo };
}
function correlation(basis: Basis, residual: Float64Array, grid: FitGrid): number {
  let sum = 0; for (let i = 0; i < basis.pixels.length; i++) { const p = basis.pixels[i]; sum += basis.values[i] * residual[p] * grid.coverage[p]; } return sum;
}
function applyWeight(basis: Basis, next: number, residual: Float64Array): void {
  const delta = next - basis.weight; for (let i = 0; i < basis.pixels.length; i++) residual[basis.pixels[i]] -= delta * basis.values[i]; basis.weight = next;
}
function refine(bases: Basis[], residual: Float64Array, grid: FitGrid, rounds: number): void {
  for (let round = 0; round < rounds; round++) for (const basis of bases)
    if (basis.norm > 0) applyWeight(basis, Math.max(0, basis.weight + correlation(basis, residual, grid) / basis.norm), residual);
}
function objective(residual: Float64Array, grid: FitGrid): number {
  let sum = 0; for (let p = 0; p < residual.length; p++) sum += residual[p] ** 2 * grid.coverage[p]; return sum;
}
function parabolicOffset(left: number, center: number, right: number): number {
  const denominator = left - 2 * center + right; return denominator < -1e-12 ? Math.max(-.5, Math.min(.5, .5 * (left - right) / denominator)) : 0;
}
function diffuseDepthExtent(input: EmissionFitInput, grid: FitGrid): number {
  // The scaffold supplies a conservative extent regardless of orientation. Without one, use
  // the observed emission's central second moment, not empty image margins or distance from origin.
  if (input.scaffold) return input.scaffold.radiusArcsec * Math.max(1, input.scaffold.depthRatio);
  let weight = 0, sumX = 0, sumY = 0;
  for (let p = 0; p < grid.target.length; p++) {
    const w = grid.coverage[p] * grid.target[p] ** 2;
    weight += w; sumX += w * (p % grid.width + .5) * grid.dx; sumY += w * (Math.floor(p / grid.width) + .5) * grid.dy;
  }
  let variance = 0;
  if (weight > 0) for (let p = 0; p < grid.target.length; p++) {
    const x = (p % grid.width + .5) * grid.dx - sumX / weight, y = (Math.floor(p / grid.width) + .5) * grid.dy - sumY / weight;
    variance += grid.coverage[p] * grid.target[p] ** 2 * (x * x + y * y);
  }
  return Math.max(Math.max(grid.dx, grid.dy) * 4, weight > 0 ? 2 * Math.sqrt(variance / weight) : 0);
}
function buildComponents(bases: Basis[], input: EmissionFitInput, controls: CompilerControls, diffuseExtent: number): EmissionComponent[] {
  const components: EmissionComponent[] = [];
  for (let i = 0; i < bases.length; i++) {
    const basis = bases[i]; if (basis.weight <= 1e-8) continue;
    const velocityCovered = !basis.halo && Boolean(input.velocityCoverage?.some(p => Math.hypot(basis.x - p.x, basis.y - p.y) <= p.radiusArcsec));
    // A centered, positive diffuse prior has no invented remote near/far surfaces. Its full
    // finite support is bounded by the conditional extent; XY size smoothly varies thickness.
    const sigmaZ = (basis.halo ? Math.min(diffuseExtent / 4, Math.max(diffuseExtent / 8, basis.sigma * .85))
      : Math.max(basis.sigma * .85, (input.scaffold?.radiusArcsec ?? basis.sigma) * .025)) * controls.depth;
    for (let depth = 0; depth < basis.depths.length; depth++) components.push({ id: `component-${components.length}`, basisId: `basis-${i}`,
      center: [basis.x, basis.y, basis.depths[depth] * controls.depth], sigma: [basis.sigma, basis.sigma, sigmaZ], angleRadians: 0,
      projectedWeight: basis.weight / basis.depths.length,
      depthAssignment: basis.halo ? 'halo-diffuse' : depth < basis.depths.length / 2 ? 'scaffold-near' : 'scaffold-far', velocityCovered });
  }
  return components;
}
/** Fit only the supplied target. Image colors, source selection and stellar overlays never enter this field. */
export function fitEmissionField(input: EmissionFitInput, requested: unknown = defaultCompilerControls,
  options: { signal?: AbortSignal; onProgress?(message: string): void; depthRecipe?: DepthRecipe; externalDepthAssignment?: boolean; maximumComponents?: number } = {}): EmissionFitResult {
  validateInput(input); const controls = readCompilerControls(requested), grid = fitGrid(input, controls.detail);
  const depthRecipe = options.depthRecipe && readDepthRecipe(options.depthRecipe);
  if (depthRecipe && input.scaffold) throw new TypeError('Choose a surface depth model or a joint velocity scaffold; do not silently combine incompatible depth methods.');
  if (options.externalDepthAssignment && (depthRecipe || input.scaffold)) throw new TypeError('External density conditioning cannot combine with a surface or velocity scaffold.');
  const externallyConditioned = Boolean(depthRecipe || options.externalDepthAssignment);
  const residual = Float64Array.from(grid.target), bases: Basis[] = [], blocked = new Uint8Array(grid.target.length);
  if (options.maximumComponents !== undefined && (!Number.isInteger(options.maximumComponents) || options.maximumComponents < 16 || options.maximumComponents > 8192))
    throw new TypeError('Finite component budget must be an integer between 16 and 8192.');
  const componentBudget = options.maximumComponents ?? Math.round(144 + 336 * controls.detail), cutoff = grid.target.reduce((a, b) => Math.max(a, b), 0) * (.004 + .056 * (1 - controls.faint));
  let outerRadius = 0;
  for (let p = 0; p < grid.target.length; p++) if (grid.coverage[p] && grid.target[p] > cutoff) {
    const x = input.bounds.min[0] + (p % grid.width + .5) * grid.dx, y = input.bounds.max[1] - (Math.floor(p / grid.width) + .5) * grid.dy;
    outerRadius = Math.max(outerRadius, Math.hypot(x, y));
  }
  const haloRadiusArcsec = Math.max((input.scaffold?.radiusArcsec ?? 0) * 1.5, outerRadius * 1.1, Math.max(grid.dx, grid.dy) * 4);
  const diffuseDepthExtentArcsec = diffuseDepthExtent(input, grid);
  const minSigma = Math.max(grid.dx, grid.dy) * (2.1 - 1.2 * controls.detail), history = [objective(residual, grid)];
  let allocated = 0, attempts = 0;
  while (allocated < componentBudget && attempts < componentBudget * 3) {
    options.signal?.throwIfAborted(); attempts++;
    let peak = -1, maximum = cutoff;
    for (let p = 0; p < residual.length; p++) if (!blocked[p] && grid.coverage[p] && residual[p] > maximum) { maximum = residual[p]; peak = p; }
    if (peak < 0) break;
    const px = peak % grid.width, py = Math.floor(peak / grid.width);
    const ox = px > 0 && px + 1 < grid.width ? parabolicOffset(residual[peak - 1], residual[peak], residual[peak + 1]) : 0;
    const oy = py > 0 && py + 1 < grid.height ? parabolicOffset(residual[peak - grid.width], residual[peak], residual[peak + grid.width]) : 0;
    const x = input.bounds.min[0] + (px + .5 + ox) * grid.dx, y = input.bounds.max[1] - (py + .5 + oy) * grid.dy;
    let depths = input.scaffold ? jointRayDepths(x, y, input.scaffold) : [];
    const halo = depths.length === 0;
    if (halo) depths = [0];
    // Tangency is one coherent surface sample; separate resolved bipolar crossings remain distinct.
    depths = depths.filter((z, i) => i === 0 || Math.abs(z - depths[i - 1]) > 1e-3);
    // Preserve the existing projected-basis budget: changing only the depth prior must not
    // consume extra image evidence or change its NNLS weights and residuals.
    const depthSlots = externallyConditioned ? 1 : halo ? 2 : depths.length;
    if (allocated + depthSlots > componentBudget) break;
    const narrowest = Math.max(minSigma, halo && !externallyConditioned ? haloRadiusArcsec * .028 : 0);
    let best: Basis | undefined, improvement = 0, coefficient = 0;
    for (const scale of externallyConditioned ? [1, 1.6, 2.7, 4.5, 7.5, 12, 20, 32] : [1, 1.6, 2.7, 4.5, 7.5]) {
      const basis = newBasis(x, y, narrowest * scale, grid, input, depths, halo), dot = correlation(basis, residual, grid);
      const gain = dot > 0 && basis.norm > 0 ? dot * dot / basis.norm : 0;
      if (gain > improvement) { best = basis; improvement = gain; coefficient = dot / basis.norm; }
    }
    if (!best || improvement < history[0] * 1e-10) { blocked[peak] = 1; continue; }
    applyWeight(best, coefficient, residual); bases.push(best); allocated += depthSlots;
    if (bases.length % 16 === 0) { refine(bases, residual, grid, 3); history.push(objective(residual, grid)); options.onProgress?.(`Fitting ${bases.length} smooth emission supports…`); }
  }
  refine(bases, residual, grid, 16); history.push(objective(residual, grid));
  const rawComponents = buildComponents(bases, input, controls, diffuseDepthExtentArcsec);
  const conditioned = depthRecipe && conditionDepthComponents(rawComponents, depthRecipe, controls.depth);
  const components = conditioned?.components ?? rawComponents;
  const model: EmissionFieldModel = { schema: 'cssearth-conditional-emission-field@1', identity: '', controls, components, bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
    skyBounds: input.bounds, scaffold: input.scaffold ?? null, ...(input.emissionWindow ? { emissionWindow: readEmissionWindow(input.emissionWindow) } : {}),
    assumptions: { kernel: 'C1 finite separable squared shifted Gaussian; ±4 sigma support; analytic z integral with a sampled-kernel bake approximation.',
      projectionUnits: 'Linear integrated relative emission, usable as dimensionless display optical depth; rendered alpha is 1−exp(−exposure×projection). No calibrated flux or gas density.',
      depth: 'At depth=1, fitted image supports are split equally among the scaffold ray intersections. Velocities condition that scaffold; individual feature depths and thicknesses remain authored assumptions. Other depth values stretch z and thickness while preserving integrated light; they are authored departures and do not refit the velocity law.',
      halo: 'Unconstrained supports use one centered diffuse conditional prior at z=0, not remote surfaces. At depth=1 its sigmaZ varies with projected support width between 1/8 and 1/4 of the scaffold maximum radius, or twice the signal-squared central RMS radius without a scaffold. Its full finite depth support is bounded by that extent. The separate projected halo extent only sets minimum XY width (2.8%). This is authored uncertain depth, with no measured velocity assignment; analytic integration preserves the fitted light.',
      haloRadiusArcsec, diffuseDepthExtentArcsec, equalNearFarSplit: true, velocityUncoveredComponents: components.filter(c => !c.velocityCovered).length } };
  if (depthRecipe && conditioned) {
    model.depthConstraints = { recipeId: depthRecipe.id, evidencePath: depthRecipe.evidence.path,
      paperGuidedComponents: conditioned.paperGuidedComponents, authoredComponents: conditioned.authoredComponents, assignments: conditioned.assignments };
    model.assumptions.depth = 'Evidence-addressed, spatially curved emitting surfaces with locally tilted finite supports. Projected signal controls emission weight; it is never a depth coordinate. All normal thicknesses and surface interpolation remain authored. Depth control scales the assumed z geometry and thickness while preserving analytic projected light. No velocity-to-distance conversion or new kinematic fit.';
    model.assumptions.halo = 'Outside scoped paper-guided features, the explicitly authored background surface supplies uncertain continuity. Small-scale supports use their own bounded thickness rather than a global depth floor. No observed 3D density or foreground membership is asserted.';
  }
  model.bounds = createEmissionField(model).bounds;
  model.identity = createHash('sha256').update(JSON.stringify(model)).digest('hex');
  const projection = new Float32Array(input.target.length), fullResidual = new Float32Array(input.target.length), unassigned = new Float32Array(input.target.length);
  const coverage = input.coverage ? Uint8Array.from(input.coverage) : new Uint8Array(input.target.length).fill(1);
  const dx = (input.bounds.max[0] - input.bounds.min[0]) / input.width, dy = (input.bounds.max[1] - input.bounds.min[1]) / input.height;
  // Identical XY supports share one analytic projection, regardless of their chosen depth split.
  for (const basis of bases) if (basis.weight > 1e-8) {
    options.signal?.throwIfAborted();
    const component: EmissionComponent = { id: '', basisId: '', center: [basis.x, basis.y, 0], sigma: [basis.sigma, basis.sigma, 1], angleRadians: 0,
      projectedWeight: basis.weight, depthAssignment: 'halo-diffuse', velocityCovered: false };
    const minX = Math.max(0, Math.floor((basis.x - 4 * basis.sigma - input.bounds.min[0]) / dx)), maxX = Math.min(input.width - 1, Math.ceil((basis.x + 4 * basis.sigma - input.bounds.min[0]) / dx));
    const minY = Math.max(0, Math.floor((input.bounds.max[1] - basis.y - 4 * basis.sigma) / dy)), maxY = Math.min(input.height - 1, Math.ceil((input.bounds.max[1] - basis.y + 4 * basis.sigma) / dy));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) projection[y * input.width + x] += projectEmissionComponent(component, input.bounds.min[0] + (x + .5) * dx, input.bounds.max[1] - (y + .5) * dy);
  }
  if (input.emissionWindow) {
    const window = createEmissionWindowSampler(input.emissionWindow);
    for (let p = 0; p < projection.length; p++) projection[p] *= window(input.bounds.min[0] + (p % input.width + .5) * dx,
      input.bounds.max[1] - (Math.floor(p / input.width) + .5) * dy);
  }
  let before = 0, after = 0, targetSum = 0, modeledSum = 0, unassignedSum = 0, excessSum = 0, coveredPixels = 0;
  for (let p = 0; p < projection.length; p++) if (coverage[p]) {
    const difference = input.target[p] - projection[p]; fullResidual[p] = difference; unassigned[p] = Math.max(0, difference);
    coveredPixels++; before += input.target[p] ** 2; after += difference ** 2; targetSum += input.target[p]; modeledSum += projection[p]; unassignedSum += Math.max(0, difference); excessSum += Math.max(0, -difference);
  }
  return { field: model, projection, residual: fullResidual, unassigned, coverage,
    metrics: { beforeRmse: Math.sqrt(before / Math.max(1, coveredPixels)), afterRmse: Math.sqrt(after / Math.max(1, coveredPixels)), relativeSquaredError: before > 0 ? after / before : 0,
      targetSum, modeledSum, unassignedSum, excessSum, coveredPixels, basisCount: bases.filter(b => b.weight > 1e-8).length, componentCount: components.length,
      iterations: attempts, fitWidth: grid.width, fitHeight: grid.height, objectiveHistory: history } };
}
