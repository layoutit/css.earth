import { jointPath, jointRecord, readJointControls, readJointParameters, type JointControls, type JointFit } from './model.ts';
import { readJointVolumeResult, type JointVolumeResult } from '@cssearth/volume-core/contracts/joint-volume';

export interface JointPin { path: string; sha256: string }
export interface JointCandidate { fit: JointFit; volume: JointVolumeResult; outlinePath: string; pointings: { id: string; x: number; y: number; heldOut: boolean; residualKmS: number; color: string; measurements: string }[] }
export interface JointResult {
  schema: 'cssearth-joint-fit-result@1'; id: string; controls: JointControls; spanArcsec: number; diagramSize: number;
  sources: { id: string; label: string; image: JointPin }[]; ridgePaths: string[];
  candidates: JointCandidate[]; graph: JointPin; method: JointPin;
  accounting: { ridgePoints: number; excludedRidgePoints: number; pointings: number; components: number; upperLimits: number; evaluatedModels: number; beamFwhmArcsec: number };
  inputIdentity: string; interpretation: string;
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function pin(v: unknown): JointPin { if (!jointRecord(v) || !jointPath(v.path) || !v.path.startsWith('.local/nebula-lab/') || !hash(v.sha256)) throw new TypeError('Invalid joint result asset.'); return { path: v.path, sha256: v.sha256 }; }
function readFit(v: unknown): JointFit {
  if (!jointRecord(v) || !jointRecord(v.metrics) || !Array.isArray(v.outline) || v.outline.length > 2048 || !Array.isArray(v.residuals) || v.residuals.length > 10000) throw new TypeError('Invalid joint candidate.');
  const m = v.metrics;
  for (const name of ['imageResidualArcsec', 'unrepresentedRidgeFraction', 'trainingCount', 'heldOutCount', 'missingTraining', 'missingHeldOut', 'objective']) if (!finite(m[name]) || m[name] < 0) throw new TypeError('Invalid joint metric.');
  if (!(m.trainingRmsKmS === null || finite(m.trainingRmsKmS) && m.trainingRmsKmS >= 0) || !(m.heldOutRmsKmS === null || finite(m.heldOutRmsKmS) && m.heldOutRmsKmS >= 0)) throw new TypeError('Invalid joint velocity residual.');
  const outline: [number, number][] = v.outline.map((p: unknown) => { if (!Array.isArray(p) || p.length !== 2 || !p.every(finite)) throw new TypeError('Invalid joint outline.'); return [p[0], p[1]]; });
  const residuals = v.residuals.map((p: unknown) => {
    if (!jointRecord(p) || typeof p.id !== 'string' || typeof p.heldOut !== 'boolean' || !finite(p.residualKmS) || !(p.predictedLsrKmS === null || finite(p.predictedLsrKmS))) throw new TypeError('Invalid joint residual.');
    return { id: p.id, heldOut: p.heldOut, residualKmS: p.residualKmS, predictedLsrKmS: p.predictedLsrKmS };
  });
  // All individual numeric fields are checked above; assemble their typed representation explicitly.
  return { parameters: readJointParameters(v.parameters), outline, residuals, metrics: {
    imageResidualArcsec: Number(m.imageResidualArcsec), unrepresentedRidgeFraction: Number(m.unrepresentedRidgeFraction),
    trainingRmsKmS: m.trainingRmsKmS, heldOutRmsKmS: m.heldOutRmsKmS, trainingCount: Number(m.trainingCount), heldOutCount: Number(m.heldOutCount),
    missingTraining: Number(m.missingTraining), missingHeldOut: Number(m.missingHeldOut), objective: Number(m.objective) } };
}
export function readJointResult(v: unknown): JointResult {
  if (!jointRecord(v) || v.schema !== 'cssearth-joint-fit-result@1' || !hash(v.id) || !hash(v.inputIdentity) ||
      !finite(v.spanArcsec) || v.spanArcsec <= 0 || v.diagramSize !== 512 || !Array.isArray(v.sources) || !v.sources.length || v.sources.length > 8 ||
      !Array.isArray(v.ridgePaths) || v.ridgePaths.length > 20000 || !v.ridgePaths.every(p => typeof p === 'string') || !Array.isArray(v.candidates) || v.candidates.length !== 2 ||
      !jointRecord(v.accounting) || typeof v.interpretation !== 'string') throw new TypeError('Invalid joint fit result.');
  const sources = v.sources.map((s: unknown) => { if (!jointRecord(s) || typeof s.id !== 'string' || typeof s.label !== 'string') throw new TypeError('Invalid joint source.'); return { id: s.id, label: s.label, image: pin(s.image) }; });
  const candidates = v.candidates.map((c: unknown): JointCandidate => {
    if (!jointRecord(c) || typeof c.outlinePath !== 'string' || !Array.isArray(c.pointings) || c.pointings.length > 10000) throw new TypeError('Invalid joint candidate rendering.');
    const pointings = c.pointings.map((p: unknown) => {
      if (!jointRecord(p) || typeof p.id !== 'string' || !finite(p.x) || !finite(p.y) || !finite(p.residualKmS) || typeof p.heldOut !== 'boolean' || typeof p.measurements !== 'string' ||
          typeof p.color !== 'string' || !/^hsl\(\d{1,3} 72% 56%\)$/.test(p.color)) throw new TypeError('Invalid joint pointing.');
      return { id: p.id, x: p.x, y: p.y, heldOut: p.heldOut, residualKmS: p.residualKmS, color: p.color, measurements: p.measurements };
    });
    return { fit: readFit(c.fit), volume: readJointVolumeResult(c.volume), outlinePath: c.outlinePath, pointings };
  });
  const a = v.accounting;
  for (const name of ['ridgePoints', 'excludedRidgePoints', 'pointings', 'components', 'upperLimits', 'evaluatedModels', 'beamFwhmArcsec']) if (!finite(a[name]) || a[name] < 0) throw new TypeError('Invalid joint evidence accounting.');
  return { schema: v.schema, id: v.id, controls: readJointControls(v.controls), spanArcsec: v.spanArcsec, diagramSize: 512, sources, candidates,
    ridgePaths: v.ridgePaths, graph: pin(v.graph), method: pin(v.method), inputIdentity: v.inputIdentity, interpretation: v.interpretation,
    accounting: { ridgePoints: Number(a.ridgePoints), excludedRidgePoints: Number(a.excludedRidgePoints), pointings: Number(a.pointings), components: Number(a.components),
      upperLimits: Number(a.upperLimits), evaluatedModels: Number(a.evaluatedModels), beamFwhmArcsec: Number(a.beamFwhmArcsec) } };
}
