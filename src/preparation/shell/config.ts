/** Data-only deformation and material recipe for a prepared transparent surface. */
import { parseDensityVolumeFrame, type DensityVolumeFrame } from '@cssearth/objects';
import { finite, record, text, triple, type Vector3 } from '../volume/config.js';

export interface AnalyticShellShape {
  kind: 'asymmetric-radial-shell'; radiusUnits: number; latitudeSegments: number; longitudeSegments: number;
  tailExponent: number; tailExtension: number; transverseScale: number; transverseContraction: number;
  lobeAmplitude: number; lobeSharpness: number;
}
export interface IndexedShellShape { kind: 'indexed-mesh'; path: string; sha256: string; }
export interface ShellRecipe {
  schema: 'cssearth-surface-shell-recipe@1';
  frame: DensityVolumeFrame;
  shape: AnalyticShellShape | IndexedShellShape;
  material: { colorLinear: Vector3; opacity: number; rimFadeFacing: number };
  atlas: { tileSize: number; columns: number; frames: number };
  visibility: { hiddenInsideUnits: number; fullUntilUnits: number; hiddenBeyondUnits: number };
  unitScale: number;
  provenance: { path: string; sha256: string };
}
function positive(value: unknown, at: string, integer = false): number {
  const n = finite(value, at);
  if (n <= 0 || (integer && !Number.isInteger(n))) throw new TypeError(`${at} must be positive${integer ? ' integer' : ''}.`);
  return n;
}
export function parseShellRecipe(value: unknown): ShellRecipe {
  const r = record(value, 'shell recipe');
  if (r.schema !== 'cssearth-surface-shell-recipe@1') throw new TypeError('Unsupported shell recipe schema.');
  const s = record(r.shape, 'shape'), m = record(r.material, 'material'), a = record(r.atlas, 'atlas');
  const v = record(r.visibility, 'visibility'), p = record(r.provenance, 'provenance');
  let shape: ShellRecipe['shape'];
  if (s.kind === 'indexed-mesh') shape = { kind: s.kind, ...pinnedSource(s) };
  else if (s.kind === 'asymmetric-radial-shell') {
    const latitudeSegments = positive(s.latitudeSegments, 'latitudeSegments', true);
    const longitudeSegments = positive(s.longitudeSegments, 'longitudeSegments', true);
    if (latitudeSegments < 4 || longitudeSegments < 4 || (latitudeSegments + 1) * (longitudeSegments + 1) > 65536) {
      throw new TypeError('Shell segment counts exceed supported indexed geometry.');
    }
    shape = { kind: s.kind, radiusUnits: positive(s.radiusUnits, 'radiusUnits'), latitudeSegments, longitudeSegments,
      tailExponent: positive(s.tailExponent, 'tailExponent'), tailExtension: finite(s.tailExtension, 'tailExtension'),
      transverseScale: positive(s.transverseScale, 'transverseScale'), transverseContraction: finite(s.transverseContraction, 'transverseContraction'),
      lobeAmplitude: finite(s.lobeAmplitude, 'lobeAmplitude'), lobeSharpness: positive(s.lobeSharpness, 'lobeSharpness') };
  } else throw new TypeError('Unsupported surface source.');
  const frames = positive(a.frames, 'frames', true), columns = positive(a.columns, 'columns', true);
  if (frames < 2 || columns > frames) throw new TypeError('Atlas needs at least two ordered facing samples.');
  const colorLinear = triple(m.colorLinear, 'colorLinear'), opacity = positive(m.opacity, 'opacity');
  const rimFadeFacing = positive(m.rimFadeFacing, 'rimFadeFacing');
  if (colorLinear.some(c => c < 0 || c > 1) || opacity > 1 || rimFadeFacing > 1) throw new TypeError('Material values must be normalized.');
  const hiddenInsideUnits = finite(v.hiddenInsideUnits, 'hiddenInsideUnits');
  const fullUntilUnits = positive(v.fullUntilUnits, 'fullUntilUnits');
  const hiddenBeyondUnits = positive(v.hiddenBeyondUnits, 'hiddenBeyondUnits');
  if (hiddenInsideUnits < 0 || fullUntilUnits <= hiddenInsideUnits || hiddenBeyondUnits <= fullUntilUnits) throw new TypeError('Visibility bounds must increase.');
  return { schema: r.schema, frame: parseDensityVolumeFrame(r.frame), shape,
    material: { colorLinear, opacity, rimFadeFacing }, atlas: { tileSize: positive(a.tileSize, 'tileSize', true), columns, frames },
    visibility: { hiddenInsideUnits, fullUntilUnits, hiddenBeyondUnits }, unitScale: positive(r.unitScale, 'unitScale'), provenance: pinnedSource(p) };
}
function pinnedSource(p: Record<string, unknown>): { path: string; sha256: string } {
  const path = text(p.path, 'source path'), sha256 = text(p.sha256, 'source hash');
  if (path.startsWith('/') || path.split('/').includes('..') || /[\\\u0000]/.test(path) || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new TypeError('Source must be relative and pinned.');
  }
  return { path, sha256 };
}
