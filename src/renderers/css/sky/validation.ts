import { cssMatrix as matrix, CSS_NUMBER as NUMBER } from '../validation/css-matrix.js';
import { validatePreparedLeafBounds } from '../rendering/prepared-leaf-frustum.js';
import type { PreparedCssVolume } from '../volume/types.js';
import type { PreparedCssSky } from './types.js';
import { dot3 as dot } from '@cssearth/core';

const FACE_IDS = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

export function validatePreparedCssSky(input: unknown, resources: PreparedCssVolume['resources']): PreparedCssSky {
  const sky = record(input, ['schema', 'referenceFrame', 'epochJdTt', 'radiusUnits', 'faces', 'provenance', 'approximation'], 'sky', ['parallax', 'nearFaces', 'stars']);
  if (sky.schema !== 'cssearth-css-sky@1' || typeof sky.referenceFrame !== 'string' || !sky.referenceFrame || !finite(sky.epochJdTt) || !positive(sky.radiusUnits)) {
    throw new TypeError('Prepared sky identity or frame is invalid.');
  }
  if ('parallax' in sky) validatePreparedSkyParallax(sky.parallax);
  // Baked stars come as a second complete cube beside the plain one, never instead of it.
  if (('nearFaces' in sky) !== ('stars' in sky)) throw new TypeError('Prepared sky stars and their near faces come together.');
  if ('stars' in sky) {
    const stars = record(sky.stars, ['objectId', 'cssPixelsPerDegree'], 'sky stars');
    if (typeof stars.objectId !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(stars.objectId) || !positive(stars.cssPixelsPerDegree)) throw new TypeError('Prepared sky stars metadata is invalid.');
  }
  validateSkyFaces(sky.faces, resources);
  if ('nearFaces' in sky) validateSkyFaces(sky.nearFaces, resources);
  return sky as unknown as PreparedCssSky;
}

function validateSkyFaces(faces: unknown, resources: PreparedCssVolume['resources']) {
  if (!Array.isArray(faces) || faces.length !== 6) throw new TypeError('Prepared sky needs six cube faces.');
  const ids = new Set<string>();
  for (const inputFace of faces) {
    const face = record(inputFace, ['id', 'texturePath', 'widthPx', 'heightPx', 'forwardIcrf', 'rightIcrf', 'upIcrf', 'style'], 'sky face', ['boundsCssPixels']);
    if (face.boundsCssPixels !== undefined) validatePreparedLeafBounds(face.boundsCssPixels);
    if (typeof face.id !== 'string' || !FACE_IDS.includes(face.id) || ids.has(face.id) || !imagePath(face.texturePath) ||
        !integer(face.widthPx) || !integer(face.heightPx) || !unit(face.forwardIcrf) || !unit(face.rightIcrf) || !unit(face.upIcrf)) {
      throw new TypeError('Prepared sky face metadata is invalid.');
    }
    ids.add(face.id);
    const [f, r, u] = [face.forwardIcrf, face.rightIcrf, face.upIcrf];
    const cross = [r[1] * u[2] - r[2] * u[1], r[2] * u[0] - r[0] * u[2], r[0] * u[1] - r[1] * u[0]];
    if (Math.abs(dot(f, r)) > 1e-6 || Math.abs(dot(f, u)) > 1e-6 || Math.abs(dot(r, u)) > 1e-6 || Math.abs(dot(cross, f) + 1) > 1e-6) {
      throw new TypeError('Prepared sky face basis must be orthonormal and inward-facing.');
    }
    const resource = resources.find(candidate => candidate.path === face.texturePath);
    if (!resource || resource.width !== face.widthPx || resource.height !== face.heightPx || !integer(resource.bytes) || !/^[a-f0-9]{64}$/u.test(resource.sha256)) {
      throw new TypeError('Prepared sky face must reference its exact resource metadata.');
    }
    const style = record(face.style, ['width', 'height', 'transform', 'backgroundSize', 'backgroundPosition'], 'sky face style');
    if (!dimensions(style.width, 1, true) || !dimensions(style.height, 1, true) || !dimensions(style.backgroundSize, 2, true) ||
        !dimensions(style.backgroundPosition, 2, false) || !matrix(style.transform)) throw new TypeError('Prepared sky styles must be numeric compiled CSS.');
  }
}

export function validatePreparedSkyParallax(input: unknown): NonNullable<PreparedCssSky['parallax']> {
  const value = record(input, ['originM', 'metersPerCssPixel'], 'sky parallax');
  if (!Array.isArray(value.originM) || value.originM.length !== 3 || !value.originM.every(finite) || !positive(value.metersPerCssPixel)) {
    throw new TypeError('Prepared sky parallax origin or scale is invalid.');
  }
  return value as unknown as NonNullable<PreparedCssSky['parallax']>;
}

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function positive(value: unknown): value is number { return finite(value) && value > 0; }
function integer(value: unknown): value is number { return positive(value) && Number.isSafeInteger(value); }
function unit(value: unknown): value is number[] { return Array.isArray(value) && value.length === 3 && value.every(finite) && Math.abs(Math.hypot(...value) - 1) < 1e-6; }
function imagePath(value: unknown): value is string { return typeof value === 'string' && /^(?:[a-z0-9_][a-z0-9_.-]*\/)*[a-z0-9_][a-z0-9_.-]*\.(?:png|webp)$/iu.test(value); }
function record(value: unknown, keys: readonly string[], name: string, optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key)) ||
    Object.keys(value).some(key => !keys.includes(key) && !optional.includes(key))) {
    throw new TypeError(`Prepared ${name} has unsupported or missing fields.`);
  }
  return value as Record<string, unknown>;
}
function dimensions(value: unknown, count: number, nonzero: boolean): value is string {
  if (typeof value !== 'string') return false;
  const parts = value.trim().split(/\s+/u);
  return parts.length === count && parts.every(part => part.endsWith('px') && NUMBER.test(part.slice(0, -2)) && (nonzero ? positive : finite)(Number(part.slice(0, -2))));
}
