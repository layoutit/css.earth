import { readCompilerControls, type CompilerControls } from './model.ts';
import { jointRecord, jointPath } from '../joint-fit/model.ts';
import { readCompilerBakeResult, type CompilerBakeResult, type CompilerPin, type SkyBounds } from '@cssearth/bake/volume';
import type { CompilerStep } from '../../server/workflows/compiler/prerequisites.ts';
export interface CompilerSource { id: string; label: string; original: CompilerPin; starless: CompilerPin;
  width: number; height: number; boundsArcsec: SkyBounds; credit: string; page: string }
export interface CompilerResult { schema: 'cssearth-nebula-compiler-result@1'; id: string; label: string; defaultSourceId: string;
  controls: CompilerControls; scene: CompilerBakeResult; sources: CompilerSource[]; pipeline: CompilerStep[];
  /** Full registered image union, translated into this result's actual sky origin. Optional for older receipts. */
  inspectionBoundsArcsec?: SkyBounds;
  metrics: { components: number; unconstrainedComponents: number; stars: number; fitRmse: number; baselineRmse: number; missingSignalFraction: number; excessSignalFraction: number };
  model: CompilerPin; method: CompilerPin; target: CompilerPin; projection: CompilerPin; residual: CompilerPin; interpretation: string }
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function pin(v: unknown): CompilerPin {
  if (!jointRecord(v) || !jointPath(v.path) || !v.path.startsWith('.local/nebula-lab/')) throw new TypeError('Invalid compiler resource.');
  return { path: v.path };
}
function bounds(v: unknown): SkyBounds {
  if (!jointRecord(v) || !Array.isArray(v.min) || !Array.isArray(v.max) || v.min.length !== 2 || v.max.length !== 2 || !v.min.every(finite) || !v.max.every(finite) || v.min[0] >= v.max[0] || v.min[1] >= v.max[1]) throw new TypeError('Invalid compiler image bounds.');
  return { min: [v.min[0], v.min[1]], max: [v.max[0], v.max[1]] };
}
export function readCompilerResult(v: unknown): CompilerResult {
  if (!jointRecord(v) || v.schema !== 'cssearth-nebula-compiler-result@1' || !hash(v.id) || typeof v.label !== 'string' || typeof v.defaultSourceId !== 'string' || typeof v.interpretation !== 'string' ||
      !Array.isArray(v.sources) || !v.sources.length || v.sources.length > 8 || !Array.isArray(v.pipeline) || v.pipeline.length > 12 || !jointRecord(v.metrics)) throw new TypeError('Invalid compiler result.');
  const sources = v.sources.map((s: unknown): CompilerSource => {
    if (!jointRecord(s) || typeof s.id !== 'string' || typeof s.label !== 'string' || typeof s.credit !== 'string' || typeof s.page !== 'string' || !s.page.startsWith('https://') ||
        !finite(s.width) || !finite(s.height) || s.width < 1 || s.height < 1) throw new TypeError('Invalid compiler source.');
    return { id: s.id, label: s.label, credit: s.credit, page: s.page, original: pin(s.original), starless: pin(s.starless), width: s.width, height: s.height, boundsArcsec: bounds(s.boundsArcsec) };
  });
  if (new Set(sources.map(s => s.id)).size !== sources.length || !sources.some(s => s.id === v.defaultSourceId)) throw new TypeError('Invalid compiler source selection.');
  const pipeline = v.pipeline.map((s: unknown): CompilerStep => {
    if (!jointRecord(s) || typeof s.id !== 'string' || typeof s.label !== 'string' || (s.state !== 'complete' && s.state !== 'reused') || !finite(s.seconds) || s.seconds < 0) throw new TypeError('Invalid compiler stage receipt.');
    return { id: s.id, label: s.label, state: s.state, seconds: s.seconds };
  });
  const m = v.metrics;
  for (const key of ['components', 'unconstrainedComponents', 'stars', 'fitRmse', 'baselineRmse', 'missingSignalFraction', 'excessSignalFraction']) if (!finite(m[key]) || m[key] < 0) throw new TypeError('Invalid compiler fit metrics.');
  const scene = readCompilerBakeResult(v.scene);
  if (scene.id !== v.id || scene.stars.length !== m.stars || scene.lenses.length !== sources.length || scene.lenses.some(lens => !sources.some(s => s.id === lens.id))) throw new TypeError('Compiler scene differs from the result.');
  return { schema: v.schema, id: v.id, label: v.label, defaultSourceId: v.defaultSourceId, controls: readCompilerControls(v.controls), scene, sources, pipeline,
    ...(v.inspectionBoundsArcsec === undefined ? {} : { inspectionBoundsArcsec: bounds(v.inspectionBoundsArcsec) }),
    metrics: { components: Number(m.components), unconstrainedComponents: Number(m.unconstrainedComponents), stars: Number(m.stars), fitRmse: Number(m.fitRmse), baselineRmse: Number(m.baselineRmse),
      missingSignalFraction: Number(m.missingSignalFraction), excessSignalFraction: Number(m.excessSignalFraction) }, model: pin(v.model), method: pin(v.method), target: pin(v.target), projection: pin(v.projection), residual: pin(v.residual), interpretation: v.interpretation };
}
