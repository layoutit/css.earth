import { NEBULA_PHYSICAL_EVIDENCE_SCHEMA, type EmissionComponent, parseDepthRecipe, type DepthSurface, type DepthRecipe } from '@cssearth/objects';
import {jointPath,jointRecord} from '../joint/model.ts';

type Pair = [number, number];
type Triple = [number, number, number];
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,95}$/.test(v);
export function readDepthRecipe(v: unknown, allowedPath: (path: string) => boolean = () => true): DepthRecipe {
  return parseDepthRecipe(v, path => jointPath(path) && allowedPath(path));
}
export function verifyDepthEvidence(recipe: DepthRecipe, v: unknown): string[] {
  if (!jointRecord(v) || v.schema !== NEBULA_PHYSICAL_EVIDENCE_SCHEMA || v.subjectId !== recipe.id || !Array.isArray(v.sources) || !Array.isArray(v.evidence) || !Array.isArray(v.methods))
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
