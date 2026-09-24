import { cssMatrix as matrix, CSS_NUMBER as NUMBER } from '../validation/css-matrix.js';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import type { PreparedCssSurfaceShell } from './types.js';


/** Accepts prepared geometry and material addresses, never authored runtime CSS. */
export function validatePreparedCssSurfaceShell(input: unknown): PreparedCssSurfaceShell {
  const value = record(input, 'prepared CSS surface shell');
  exactKeys(value, ['schema', 'id', 'frame', 'unitScale', 'atlas', 'visibility', 'faces', 'resources', 'provenance',
    ...(value.vertices === undefined ? [] : ['vertices'])], 'prepared CSS surface shell');
  if (value.schema !== 'cssearth-css-surface-shell@1' || typeof value.id !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(value.id) || !positive(value.unitScale)) {
    throw new TypeError('Prepared CSS surface shell identity or unit scale is invalid.');
  }
  const frame = parseDensityVolumeFrame(value.frame);
  const atlas = record(value.atlas, 'surface shell atlas');
  exactKeys(atlas, ['path', 'tileSize', 'columns', 'frames', ...(atlas.facingLevels === undefined ? [] : ['facingLevels']),
    ...(atlas.triangleInsetPixels === undefined ? [] : ['triangleInsetPixels'])], 'surface shell atlas');
  if (!pngPath(atlas.path) || !positiveInteger(atlas.tileSize) || !positiveInteger(atlas.columns) || !positiveInteger(atlas.frames) || atlas.columns > atlas.frames) {
    throw new TypeError('Prepared CSS surface shell atlas is invalid.');
  }
  if (atlas.facingLevels !== undefined) {
    const levels = atlas.facingLevels;
    if (!Array.isArray(levels) || levels.length < 2 || levels.length > 64 || levels[0] !== -1 || levels[levels.length - 1] !== 1 ||
      levels.some((n, i) => !finite(n) || (i > 0 && n <= levels[i - 1])) ||
      atlas.frames !== levels.length * (levels.length + 1) * (levels.length + 2) / 6 ||
      !Array.isArray(value.vertices) || value.vertices.length < 3 || value.vertices.length > 65536) {
      throw new TypeError('Prepared vertex-facing material needs its complete sorted triple bank and vertices.');
    }
    for (const inputVertex of value.vertices) {
      const vertex = record(inputVertex, 'surface shell vertex');
      exactKeys(vertex, ['positionUnits', 'radialNormal'], 'surface shell vertex');
      if (!vector(vertex.positionUnits, 3) || !unitVector(vertex.radialNormal)) throw new TypeError('Invalid prepared shell vertex.');
    }
  } else if (value.vertices !== undefined) throw new TypeError('Prepared vertices require a vertex-facing bank.');
  if (atlas.triangleInsetPixels !== undefined && (!positive(atlas.triangleInsetPixels) || atlas.triangleInsetPixels < 1 ||
    atlas.triangleInsetPixels * 2 >= atlas.tileSize || atlas.facingLevels === undefined)) throw new TypeError('Invalid prepared triangle pixel guard.');
  if (!Array.isArray(value.resources) || value.resources.length !== 1) throw new TypeError('Prepared CSS surface shell needs its single shared atlas resource.');
  const resource = record(value.resources[0], 'surface shell resource');
  exactKeys(resource, ['path', 'sha256', 'bytes', 'width', 'height'], 'surface shell resource');
  if (!pngPath(resource.path) || resource.path !== atlas.path || typeof resource.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(resource.sha256) ||
      !positiveInteger(resource.bytes) || !positiveInteger(resource.width) || !positiveInteger(resource.height) ||
      resource.width !== atlas.columns * atlas.tileSize || resource.height !== Math.ceil(atlas.frames / atlas.columns) * atlas.tileSize) {
    throw new TypeError('Prepared CSS surface shell resource metadata is invalid.');
  }
  const visibility = record(value.visibility, 'surface shell visibility');
  exactKeys(visibility, ['hiddenInsideM', 'fullUntilM', 'hiddenBeyondM'], 'surface shell visibility');
  if (!finite(visibility.hiddenInsideM) || visibility.hiddenInsideM < 0 || !positive(visibility.fullUntilM) || !positive(visibility.hiddenBeyondM) ||
      visibility.hiddenInsideM >= visibility.fullUntilM || visibility.fullUntilM >= visibility.hiddenBeyondM) {
    throw new TypeError('Prepared CSS surface shell visibility distances are invalid.');
  }
  if (!Array.isArray(value.faces) || value.faces.length === 0 || value.faces.length > 20_000) throw new TypeError('Prepared CSS surface shell face count is invalid.');
  const ids = new Set<string>();
  for (const inputFace of value.faces) {
    const face = record(inputFace, 'surface shell face');
    exactKeys(face, ['id', 'centerUnits', 'radialNormal', 'faceNormal', 'style', 'atlasStepPixels', 'atlasOriginPixels',
      ...(atlas.facingLevels === undefined ? [] : ['vertexIndices', 'materialTransforms'])], 'surface shell face');
    if (typeof face.id !== 'string' || !face.id || ids.has(face.id) || !vector(face.centerUnits, 3) || !unitVector(face.radialNormal) || !unitVector(face.faceNormal) ||
        !vector(face.atlasStepPixels, 2) || !face.atlasStepPixels.every(positive) || !vector(face.atlasOriginPixels, 2)) {
      throw new TypeError('Prepared CSS surface shell face metadata is invalid.');
    }
    ids.add(face.id);
    const style = record(face.style, 'surface shell face style');
    exactKeys(style, ['width', 'height', 'transform', 'backgroundSize'], 'surface shell face style');
    if (!dimensions(style.width, 1) || !dimensions(style.height, 1) || !matrix(style.transform) || !dimensions(style.backgroundSize, 2)) {
      throw new TypeError('Prepared CSS surface shell face style must contain positive dimensions and a numeric matrix3d only.');
    }
    if (atlas.facingLevels !== undefined && (!Array.isArray(face.vertexIndices) || face.vertexIndices.length !== 3 ||
      new Set(face.vertexIndices).size !== 3 || face.vertexIndices.some(i => !Number.isSafeInteger(i) || i < 0 || i >= (value.vertices as unknown[]).length) ||
      !Array.isArray(face.materialTransforms) || face.materialTransforms.length !== 6 || !face.materialTransforms.every(matrix) ||
      face.materialTransforms[0] !== style.transform)) throw new TypeError('Invalid prepared triangle material permutations.');
  }
  const provenance = record(value.provenance, 'surface shell provenance');
  return { schema: value.schema, id: value.id, frame, unitScale: value.unitScale,
    atlas: atlas as unknown as PreparedCssSurfaceShell['atlas'], visibility: visibility as unknown as PreparedCssSurfaceShell['visibility'],
    faces: value.faces as PreparedCssSurfaceShell['faces'], resources: value.resources as PreparedCssSurfaceShell['resources'], provenance,
    ...(value.vertices === undefined ? {} : { vertices: value.vertices as PreparedCssSurfaceShell['vertices'] }) };
}

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function positive(value: unknown): value is number { return finite(value) && value > 0; }
function positiveInteger(value: unknown): value is number { return positive(value) && Number.isSafeInteger(value); }
function vector(value: unknown, length: number): value is number[] { return Array.isArray(value) && value.length === length && value.every(finite); }
function unitVector(value: unknown): boolean { return vector(value, 3) && Math.abs(Math.hypot(...value) - 1) <= 1e-6; }
function pngPath(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[a-z0-9_][a-z0-9_.-]*\/)*[a-z0-9_][a-z0-9_.-]*\.png$/iu.test(value);
}
function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object.`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, expected: readonly string[], name: string): void {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some(key => !expected.includes(key))) throw new TypeError(`${name} has unsupported or missing fields.`);
}
function dimensions(value: unknown, count: number): value is string {
  if (typeof value !== 'string') return false;
  const parts = value.trim().split(/\s+/u);
  return parts.length === count && parts.every(part => part.endsWith('px') && NUMBER.test(part.slice(0, -2)) && positive(Number(part.slice(0, -2))));
}
