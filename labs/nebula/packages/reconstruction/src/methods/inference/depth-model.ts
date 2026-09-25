import {jointPath,jointRecord} from '../joint/model.ts';
import type { EmissionComponent } from '@cssearth/bake/volume';
type Pair = [number, number];
type Triple = [number, number, number];
export interface DepthSurface {
  id: string; methodId: string; evidenceIds: string[];
  support: 'paper-guided' | 'unconstrained';
  /** A window scopes a hypothesis; it is not a measured nebular boundary. */
  centerArcsec: Pair; radiusArcsec: Pair; angleDegrees: number;
  depthArcsec: number; gradient: Pair; curvaturePerArcsec: Triple;
  thicknessArcsec: number; strength: number; rationale: string;
}
export interface DepthRecipe {
  schema: 'cssearth-nebula-depth-model@1'; id: string;
  centerIcrsDegrees: Pair;
  evidence: { path: string };
  background: DepthSurface; features: DepthSurface[];
  /** The unobserved normal thickness may shrink with projected feature scale, never grow into rods. */
  detailThicknessRatio: number; minimumThicknessArcsec: number;
  interpretation: string;
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const number = (v: unknown, low: number, high: number): v is number => finite(v) && v >= low && v <= high;
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,95}$/.test(v);
function pair(v: unknown, low: number, high: number): Pair {
  if (!Array.isArray(v) || v.length !== 2 || !v.every(n => number(n, low, high))) throw new TypeError('Invalid depth-model pair.');
  return [v[0], v[1]];
}
function surface(v: unknown): DepthSurface {
  if (!jointRecord(v) || !id(v.id) || v.methodId !== 'coherent-irregular-front' || !Array.isArray(v.evidenceIds) || !v.evidenceIds.length || !v.evidenceIds.every(id) ||
      (v.support !== 'paper-guided' && v.support !== 'unconstrained') || !number(v.angleDegrees, -360, 360) || !number(v.depthArcsec, -1e6, 1e6) ||
      !number(v.thicknessArcsec, .01, 1e5) || !number(v.strength, 0, 1) || typeof v.rationale !== 'string' || !v.rationale.trim() ||
      !Array.isArray(v.curvaturePerArcsec) || v.curvaturePerArcsec.length !== 3 || !v.curvaturePerArcsec.every(n => number(n, -.1, .1)))
    throw new TypeError('Invalid evidence-addressed depth surface.');
  return { id: v.id, methodId: v.methodId, evidenceIds: [...v.evidenceIds], support: v.support,
    centerArcsec: pair(v.centerArcsec, -1e6, 1e6), radiusArcsec: pair(v.radiusArcsec, .01, 1e6), angleDegrees: v.angleDegrees,
    depthArcsec: v.depthArcsec, gradient: pair(v.gradient, -50, 50), curvaturePerArcsec: [v.curvaturePerArcsec[0], v.curvaturePerArcsec[1], v.curvaturePerArcsec[2]],
    thicknessArcsec: v.thicknessArcsec, strength: v.strength, rationale: v.rationale };
}
export function readDepthRecipe(v: unknown, allowedPath: (path: string) => boolean = () => true): DepthRecipe {
  if (!jointRecord(v) || v.schema !== 'cssearth-nebula-depth-model@1' || !id(v.id) || !jointRecord(v.evidence) ||
      !jointPath(v.evidence.path) || !allowedPath(v.evidence.path) ||
      !Array.isArray(v.features) || v.features.length > 64 || !number(v.detailThicknessRatio, .05, 2) || !number(v.minimumThicknessArcsec, .01, 1000) ||
      typeof v.interpretation !== 'string' || !v.interpretation.trim()) throw new TypeError('Invalid nebula depth-model recipe.');
  const center = pair(v.centerIcrsDegrees, -360, 360), background = surface(v.background), features = v.features.map(surface);
  if (center[0] < 0 || center[0] >= 360 || Math.abs(center[1]) > 90 || new Set([background.id, ...features.map(f => f.id)]).size !== features.length + 1 ||
      background.support !== 'unconstrained') throw new TypeError('Invalid depth frame, duplicate surface, or unsupported background claim.');
  return { schema: v.schema, id: v.id, centerIcrsDegrees: center, evidence: { path: v.evidence.path }, background, features,
    detailThicknessRatio: v.detailThicknessRatio, minimumThicknessArcsec: v.minimumThicknessArcsec, interpretation: v.interpretation };
}
export function verifyDepthEvidence(recipe: DepthRecipe, v: unknown): string[] {
  if (!jointRecord(v) || v.schema !== 'cssearth-nebula-physical-evidence@1' || v.subjectId !== recipe.id || !Array.isArray(v.sources) || !Array.isArray(v.evidence) || !Array.isArray(v.methods))
    throw new TypeError('Depth model requires its object-owned physical evidence ledger.');
  const sources = new Set<string>(), evidence = new Map<string, 'observed' | 'published-model' | 'authored'>(), methods = new Set<string>();
  for (const source of v.sources) {
    if (!jointRecord(source) || !id(source.id) || sources.has(source.id) || typeof source.url !== 'string' || !source.url.startsWith('https://')) throw new TypeError('Invalid physical source record.');
    sources.add(source.id);
  }
  for (const item of v.evidence) {
    if (!jointRecord(item) || !id(item.id) || evidence.has(item.id) || !['observed', 'published-model', 'authored'].includes(String(item.classification)) ||
        !Array.isArray(item.sourceIds) || item.sourceIds.some(s => typeof s !== 'string' || !sources.has(s)) ||
        (item.classification !== 'authored' && !item.sourceIds.length)) throw new TypeError('Invalid physical evidence attribution.');
    evidence.set(item.id, item.classification as 'observed' | 'published-model' | 'authored');
  }
  for (const method of v.methods) {
    if (!jointRecord(method) || !id(method.id) || methods.has(method.id) || !Array.isArray(method.inputRequirements) || !method.inputRequirements.every(x => typeof x === 'string') ||
        !Array.isArray(method.evidenceIds) || !method.evidenceIds.length || method.evidenceIds.some(x => typeof x !== 'string' || !evidence.has(x))) throw new TypeError('Invalid physical method record.');
    methods.add(method.id);
  }
  const selected = new Set<string>();
  for (const feature of [recipe.background, ...recipe.features]) {
    if (!methods.has(feature.methodId) || feature.evidenceIds.some(key => !evidence.has(key)) ||
        feature.support === 'paper-guided' && !feature.evidenceIds.some(key => evidence.get(key) !== 'authored'))
      throw new TypeError(`Depth surface ${feature.id} lacks its declared method/evidence.`);
    selected.add(feature.methodId);
  }
  return [...selected];
}
function patch(f: DepthSurface, x: number, y: number) {
  const angle = f.angleDegrees * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), dx = x - f.centerArcsec[0], dy = y - f.centerArcsec[1];
  const u = c * dx + s * dy, v = -s * dx + c * dy, q = (u / f.radiusArcsec[0]) ** 2 + (v / f.radiusArcsec[1]) ** 2;
  const [xx, xy, yy] = f.curvaturePerArcsec;
  return { q, depth: f.depthArcsec + f.gradient[0] * dx + f.gradient[1] * dy + xx * dx * dx + xy * dx * dy + yy * dy * dy };
}
/** Smooth scoped constraints deform one connected front; they never duplicate the photograph on stacked planes. */
export function depthSurfaceAt(recipe: DepthRecipe, x: number, y: number) {
  let depth = patch(recipe.background, x, y).depth, thickness = recipe.background.thicknessArcsec;
  let strongest = 0, feature = recipe.background;
  for (const next of recipe.features) {
    const local = patch(next, x, y); if (local.q >= 1) continue;
    const weight = next.strength * (1 - local.q) ** 2 * (1 + 2 * local.q);
    depth += weight * (local.depth - depth); thickness += weight * (next.thicknessArcsec - thickness);
    if (weight > strongest) { strongest = weight; feature = next; }
  }
  return { depth, thickness, feature, paperGuided: strongest >= .25 && feature.support === 'paper-guided' };
}
export function conditionDepthComponents(components: EmissionComponent[], recipe: DepthRecipe, depthScale: number) {
  if (!Number.isFinite(depthScale) || depthScale <= 0) throw new TypeError('Invalid positive depth scale.');
  let paperGuidedComponents = 0;
  const assignments: { componentId: string; featureId: string; methodId: string; evidenceIds: string[]; support: string }[] = [];
  const conditioned = components.map(component => {
    const [x, y] = component.center, local = depthSurfaceAt(recipe, x, y), epsilon = Math.max(.05, Math.min(component.sigma[0], component.sigma[1]) * .02);
    const gradient: Pair = [(depthSurfaceAt(recipe, x + epsilon, y).depth - depthSurfaceAt(recipe, x - epsilon, y).depth) / (2 * epsilon) * depthScale,
      (depthSurfaceAt(recipe, x, y + epsilon).depth - depthSurfaceAt(recipe, x, y - epsilon).depth) / (2 * epsilon) * depthScale];
    if (gradient.some(value => !Number.isFinite(value) || Math.abs(value) > 100)) throw new TypeError('Depth constraints produce an unsupported surface slope.');
    if (local.paperGuided) paperGuidedComponents++;
    // Thickness is a characteristic emitting-layer width, not eight-sigma support or a measured gas density.
    const sigmaZ = Math.min(Math.min(component.sigma[0], component.sigma[1]) * recipe.detailThicknessRatio,
      Math.max(recipe.minimumThicknessArcsec, local.thickness / 2));
    assignments.push({ componentId: component.id, featureId: local.feature.id, methodId: local.feature.methodId, evidenceIds: local.feature.evidenceIds,
      support: local.paperGuided ? 'paper-guided' : 'unconstrained' });
    return { ...component, center: [x, y, local.depth * depthScale] as Triple,
      sigma: [component.sigma[0], component.sigma[1], sigmaZ * depthScale] as Triple, depthGradient: gradient,
      depthAssignment: 'evidence-surface' as const, velocityCovered: false };
  });
  return { components: conditioned, assignments, paperGuidedComponents, authoredComponents: components.length - paperGuidedComponents };
}
