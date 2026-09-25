/** A qualified spatial sample set and explicitly authored analytic components. No object-specific code. */
const jointRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const jointPath = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && !v.startsWith('/') && !/[\\:?#\s]/.test(v) && v.split('/').every(p => p && p !== '.' && p !== '..');
import type { EmissionVector3 } from './emission.ts';
import { readSampledEmissionFit, type SampledEmissionFit } from './sampled-emission-fit.ts';

export interface SamplePin { path: string }
interface TermBase { id: string; weight: number; evidenceIds: string[] }
export type SampleTerm = TermBase & (
  { kind: 'torus'; centerArcsec: EmissionVector3; axis: EmissionVector3; radiusArcsec: number; sigmaArcsec: number } |
  { kind: 'jet'; startArcsec: EmissionVector3; endArcsec: EmissionVector3; sigmaArcsec: number } |
  { kind: 'ellipsoid'; centerArcsec: EmissionVector3; sigmaArcsec: EmissionVector3 });
export interface ComponentWeights { ejecta: number; pwn: number }
export interface SampledRecipe {
  schema: 'cssearth-sampled-nebula@1'; id: string; centerIcrsDegrees: [number, number]; evidence: SamplePin;
  source: SamplePin & { url: string; width: number; height: number; columns: [number, number, number, number] };
  rawToArcsec: number[];
  grid: { longestAxis: number; blurSigmaCells: number; weightExponent: number; peakOpticalDepth: number };
  terms: SampleTerm[]; lensComponents: Record<string, ComponentWeights>;
  emissionFit?: SampledEmissionFit;
  pulsar?: { id: string; positionArcsec: EmissionVector3; rgb: [number, number, number]; diameterArcsec: number; alpha: number; evidenceIds: string[] };
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function number(v: unknown, min: number, max: number): number {
  if (!finite(v) || v < min || v > max) throw new TypeError('Sampled prior parameter is outside its supported range.'); return v;
}
function vector(v: unknown): EmissionVector3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(finite)) throw new TypeError('Expected a finite 3D coordinate.');
  return [v[0], v[1], v[2]];
}
function id(v: unknown): string { if (typeof v !== 'string' || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(v)) throw new TypeError('Invalid sampled component identity.'); return v; }
function evidenceIds(v: unknown): string[] {
  if (!Array.isArray(v) || !v.length || v.length > 30) throw new TypeError('Every sampled component needs evidence identities.'); return v.map(id);
}
function pin(v: unknown, allowedSourcePath: (path: string) => boolean): SamplePin {
  if (!jointRecord(v) || !jointPath(v.path) || !allowedSourcePath(v.path)) throw new TypeError('Invalid sampled source path.');
  return { path: v.path };
}
export function readSampledRecipe(v: unknown, allowedSourcePath: (path: string) => boolean = () => true): SampledRecipe {
  if (!jointRecord(v) || v.schema !== 'cssearth-sampled-nebula@1' || !jointRecord(v.source) || !jointRecord(v.grid) ||
      !Array.isArray(v.rawToArcsec) || v.rawToArcsec.length !== 12 || !v.rawToArcsec.every(finite) ||
      !Array.isArray(v.centerIcrsDegrees) || v.centerIcrsDegrees.length !== 2 || !Array.isArray(v.terms) || v.terms.length > 32 ||
      !jointRecord(v.lensComponents)) throw new TypeError('Invalid sampled nebula recipe.');
  const m = v.rawToArcsec;
  const determinant = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8]) + m[2] * (m[4] * m[9] - m[5] * m[8]);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new TypeError('Sampled coordinate mapping is degenerate.');
  const s = v.source;
  if (typeof s.url !== 'string' || !s.url.startsWith('https://') || !Array.isArray(s.columns) || s.columns.length !== 4 ||
      !s.columns.every(n => Number.isInteger(n) && n >= 0 && n < Number(s.width)) || new Set(s.columns).size !== 4)
    throw new TypeError('Qualified FITS columns and HTTPS source required.');
  const width = number(s.width, 4, 32), height = number(s.height, 1, 5e6), longestAxis = number(v.grid.longestAxis, 32, 256);
  if (![width, height, longestAxis].every(Number.isInteger)) throw new TypeError('Sampled grid dimensions must be integers.');
  const terms = v.terms.map((t: unknown): SampleTerm => {
    if (!jointRecord(t)) throw new TypeError('Invalid sampled analytic term.');
    const base = { id: id(t.id), weight: number(t.weight, 0, 20), evidenceIds: evidenceIds(t.evidenceIds) };
    if (t.kind === 'torus') {
      const axis = vector(t.axis); if (Math.abs(Math.hypot(...axis) - 1) > 1e-6) throw new TypeError('Torus axis must be a unit vector.');
      return { ...base, kind: t.kind, centerArcsec: vector(t.centerArcsec), axis, radiusArcsec: number(t.radiusArcsec, .01, 1e5), sigmaArcsec: number(t.sigmaArcsec, .01, 1e4) };
    }
    if (t.kind === 'jet') {
      const startArcsec = vector(t.startArcsec), endArcsec = vector(t.endArcsec);
      if (Math.hypot(...endArcsec.map((n, i) => n - startArcsec[i]!)) < .01) throw new TypeError('Jet endpoints coincide.');
      return { ...base, kind: t.kind, startArcsec, endArcsec, sigmaArcsec: number(t.sigmaArcsec, .01, 1e4) };
    }
    if (t.kind === 'ellipsoid') {
      const sigmaArcsec = vector(t.sigmaArcsec); sigmaArcsec.forEach(n => number(n, .01, 1e4));
      return { ...base, kind: t.kind, centerArcsec: vector(t.centerArcsec), sigmaArcsec };
    }
    throw new TypeError('Unsupported sampled analytic term.');
  });
  if (new Set(terms.map(t => t.id)).size !== terms.length) throw new TypeError('Duplicate sampled terms.');
  const lensComponents: Record<string, ComponentWeights> = {};
  for (const [key, weights] of Object.entries(v.lensComponents)) {
    id(key); if (!jointRecord(weights)) throw new TypeError('Invalid component mixture.');
    const value = { ejecta: number(weights.ejecta, 0, 1), pwn: number(weights.pwn, 0, 1) };
    if (value.ejecta + value.pwn <= 0) throw new TypeError('An empty spectral component mixture cannot render.'); lensComponents[key] = value;
  }
  if (!Object.keys(lensComponents).length || Object.keys(lensComponents).length > 8) throw new TypeError('Invalid sampled lens count.');
  let pulsar: SampledRecipe['pulsar'];
  if (v.pulsar !== undefined) {
    if (!jointRecord(v.pulsar)) throw new TypeError('Invalid compact central source.');
    const p = v.pulsar, rgb = vector(p.rgb);
    if (!rgb.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) throw new TypeError('Invalid central-source color.');
    pulsar = { id: id(p.id), positionArcsec: vector(p.positionArcsec), rgb, diameterArcsec: number(p.diameterArcsec, .001, 1e3), alpha: number(p.alpha, 0, 1), evidenceIds: evidenceIds(p.evidenceIds) };
  }
  const emissionFit = v.emissionFit === undefined ? undefined : readSampledEmissionFit(v.emissionFit);
  if (emissionFit?.sourceIds.some(id => !lensComponents[id])) throw new TypeError('Emission fit references an unknown spectral lens.');
  return { schema: v.schema, id: id(v.id), centerIcrsDegrees: [number(v.centerIcrsDegrees[0], 0, 359.999999), number(v.centerIcrsDegrees[1], -90, 90)],
    evidence: pin(v.evidence, allowedSourcePath), source: { ...pin(s, allowedSourcePath), url: s.url, width, height, columns: [s.columns[0], s.columns[1], s.columns[2], s.columns[3]] },
    rawToArcsec: [...m], grid: { longestAxis, blurSigmaCells: number(v.grid.blurSigmaCells, .35, 4), weightExponent: number(v.grid.weightExponent, .1, 1),
      peakOpticalDepth: v.grid.peakOpticalDepth === undefined ? 1.5 : number(v.grid.peakOpticalDepth, .01, 10) }, terms, lensComponents,
    ...(emissionFit ? { emissionFit } : {}), ...(pulsar ? { pulsar } : {}) };
}
export function verifySampledEvidence(recipe: SampledRecipe, value: unknown) {
  if (!jointRecord(value) || value.schema !== 'cssearth-nebula-physical-evidence@1' || value.subjectId !== recipe.id || !Array.isArray(value.evidence) || !Array.isArray(value.sources))
    throw new TypeError('Sampled prior evidence belongs to another object or schema.');
  const sources = new Set<string>(), ids = new Set<string>();
  for (const row of value.sources) {
    if (!jointRecord(row) || typeof row.id !== 'string' || sources.has(row.id) || typeof row.url !== 'string' || !row.url.startsWith('https://'))
      throw new TypeError('Invalid sampled evidence source attribution.');
    sources.add(id(row.id));
  }
  for (const row of value.evidence) {
    if (!jointRecord(row) || typeof row.id !== 'string' || ids.has(row.id) || !['observed', 'published-model', 'authored'].includes(String(row.classification)) ||
        !Array.isArray(row.sourceIds) || row.sourceIds.some(source => typeof source !== 'string' || !sources.has(source)) ||
        row.classification !== 'authored' && !row.sourceIds.length) throw new TypeError('Invalid sampled physical evidence attribution or classification.');
    ids.add(id(row.id));
  }
  for (const term of [...recipe.terms, ...(recipe.pulsar ? [recipe.pulsar] : []), ...(recipe.emissionFit ? [recipe.emissionFit] : [])])
    if (term.evidenceIds.some(id => !ids.has(id))) throw new TypeError('Sampled component references missing physical evidence.');
}
