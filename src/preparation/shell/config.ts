/** Data-only deformation and material recipe for a prepared transparent surface. */
import { parseDensityVolumeFrame, type DensityVolumeFrame } from '@cssearth/objects';
import { finite, record, text, triple, type Vector3 } from '@cssearth/volume-core/contracts/volume-recipe';

export interface ShellDisplaySubdivision { method: 'radial-linear'; segmentsPerEdge: number; }
interface ShellShapeSource { path: string; displaySubdivision?: ShellDisplaySubdivision; }
export interface IndexedShellShape extends ShellShapeSource { kind: 'indexed-mesh'; }
export interface GriddedShellShape extends ShellShapeSource { kind: 'gridded-surface'; }
export interface ShellRecipe {
  schema: 'cssearth-surface-shell-recipe@1';
  frame: DensityVolumeFrame;
  shape: IndexedShellShape | GriddedShellShape;
  material: { colorLinear: Vector3; opacity: number; rimFadeFacing: number };
  atlas: { tileSize: number; columns: number; frames: number; facingLevels?: number[]; triangleInsetPixels?: number };
  visibility: { hiddenInsideUnits: number; fullUntilUnits: number; hiddenBeyondUnits: number };
  unitScale: number;
  provenance: { path: string };
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
  if (s.kind === 'indexed-mesh' || s.kind === 'gridded-surface') shape = { kind: s.kind, ...pinnedSource(s),
    ...(s.displaySubdivision === undefined ? {} : { displaySubdivision: parseDisplaySubdivision(s.displaySubdivision) }) };
  else throw new TypeError('Unsupported surface source.');
  const frames = positive(a.frames, 'frames', true), columns = positive(a.columns, 'columns', true);
  if (frames < 2 || columns > frames) throw new TypeError('Atlas needs at least two ordered facing samples.');
  let facingLevels: number[] | undefined;
  if (a.facingLevels !== undefined) {
    if (!Array.isArray(a.facingLevels) || a.facingLevels.length < 2 || a.facingLevels.length > 64) throw new TypeError('Invalid facing levels.');
    facingLevels = a.facingLevels.map(value => finite(value, 'facing level'));
    const count = facingLevels.length;
    if (facingLevels[0] !== -1 || facingLevels[count - 1] !== 1 ||
      facingLevels.some((value, i) => i > 0 && value <= facingLevels![i - 1]!) || frames !== count * (count + 1) * (count + 2) / 6) {
      throw new TypeError('Sorted triple atlas requires increasing [-1,1] levels and every corner combination.');
    }
  }
  const tileSize = positive(a.tileSize, 'tileSize', true);
  const triangleInsetPixels = a.triangleInsetPixels === undefined ? undefined : positive(a.triangleInsetPixels, 'triangleInsetPixels');
  if (triangleInsetPixels !== undefined && (!facingLevels || triangleInsetPixels < 1 || triangleInsetPixels * 2 >= tileSize)) {
    throw new TypeError('A vertex-facing triangle needs a transparent pixel guard inside its tile.');
  }
  const colorLinear = triple(m.colorLinear, 'colorLinear'), opacity = positive(m.opacity, 'opacity');
  const rimFadeFacing = positive(m.rimFadeFacing, 'rimFadeFacing');
  if (colorLinear.some(c => c < 0 || c > 1) || opacity > 1 || rimFadeFacing > 1) throw new TypeError('Material values must be normalized.');
  const hiddenInsideUnits = finite(v.hiddenInsideUnits, 'hiddenInsideUnits');
  const fullUntilUnits = positive(v.fullUntilUnits, 'fullUntilUnits');
  const hiddenBeyondUnits = positive(v.hiddenBeyondUnits, 'hiddenBeyondUnits');
  if (hiddenInsideUnits < 0 || fullUntilUnits <= hiddenInsideUnits || hiddenBeyondUnits <= fullUntilUnits) throw new TypeError('Visibility bounds must increase.');
  return { schema: r.schema, frame: parseDensityVolumeFrame(r.frame), shape,
    material: { colorLinear, opacity, rimFadeFacing }, atlas: { tileSize, columns, frames,
      ...(facingLevels ? { facingLevels } : {}), ...(triangleInsetPixels === undefined ? {} : { triangleInsetPixels }) },
    visibility: { hiddenInsideUnits, fullUntilUnits, hiddenBeyondUnits }, unitScale: positive(r.unitScale, 'unitScale'), provenance: pinnedSource(p) };
}
function parseDisplaySubdivision(value: unknown): ShellDisplaySubdivision {
  const subdivision = record(value, 'display subdivision');
  if (subdivision.method !== 'radial-linear') throw new TypeError('Unsupported shell display subdivision.');
  const segmentsPerEdge = positive(subdivision.segmentsPerEdge, 'segmentsPerEdge', true);
  if (segmentsPerEdge > 8) throw new TypeError('Shell display subdivision exceeds the prepared face bound.');
  return { method: subdivision.method, segmentsPerEdge };
}
function pinnedSource(p: Record<string, unknown>): { path: string } {
  const path = text(p.path, 'source path');
  if (path.startsWith('/') || path.split('/').includes('..') || /[\\\u0000]/.test(path)) {
    throw new TypeError('Source must be relative.');
  }
  return { path };
}
