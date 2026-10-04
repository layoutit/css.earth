/** Pure projections for catalogue preparation. Transport and imagery classification stay with site. */
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { OBJECT_RUNTIME_SCHEMA } from '../runtime/object-controls.js';
import { requireCamera } from '../runtime-validation/camera.js';
export const SHAPE_MODEL_SCHEMA = 'cssearth-shape-model@2';

export function readShapeModelDiscovery(value: unknown) {
  const recipe = requireRecord(value, 'shape model discovery');
  if (recipe.schema !== SHAPE_MODEL_SCHEMA) throw new TypeError('Discovery shape-model recipe has an unexpected schema.');
  if (recipe.surfaces === undefined) return { surfaces: [] };
  return { surfaces: requireArray(recipe.surfaces).map(value => {
    const surface = requireRecord(value), id = requireString(surface.dataset);
    const science = surface.science === undefined ? undefined : requireRecord(surface.science);
    if (science !== undefined) requireString(science.kind);
    return { id, ...(science === undefined ? {} : { science }) };
  }) };
}

/** Admit only the camera of a runtime envelope, including the fast prefix reader. */
export function readRuntimeCamera(value: unknown) {
  const runtime = requireRecord(value, 'prepared runtime camera');
  if (runtime.schema !== OBJECT_RUNTIME_SCHEMA) throw new TypeError('Prepared runtime camera schema is incompatible.');
  requireCamera(runtime.camera);
  return runtime.camera;
}

/** Prefix transport may stop after the camera; validation remains identical to the whole-file projection. */
export function readRuntimeCameraPrefix(head: string): { camera: ReturnType<typeof readRuntimeCamera> } | null {
  const prefix = /^\{"schema":"([^"\\]*)","camera":/u.exec(head), start = prefix?.[0].length;
  if (start === undefined || head[start] !== '{') return null;
  let depth = 0, inString = false;
  for (let index = start; index < head.length; index++) {
    const char = head[index];
    if (inString) { if (char === '\\') index++; else if (char === '"') inString = false; continue; }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') depth++;
    else if ((char === '}' || char === ']') && --depth === 0)
      return { camera: readRuntimeCamera({ schema: prefix?.[1], camera: JSON.parse(head.slice(start, index + 1)) }) };
  }
  return null;
}
