import { cross3 as cross } from '../../../platform/vector3.mts';
import type { PreparedVolumeImpostors, VolumeVector } from './types.js';
import { dot3 as dot } from '../../../platform/vector3.mts';

export function validateVolumeImpostors(input: unknown, resources: ReadonlySet<string>): PreparedVolumeImpostors {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid prepared volume impostors.');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(',') !== 'fullBelowDiameterPixels,radiusUnits,schema,views,volumeAboveDiameterPixels' ||
      value.schema !== 'cssearth-volume-impostors@1' || !positive(value.radiusUnits) || !positive(value.fullBelowDiameterPixels) ||
      !positive(value.volumeAboveDiameterPixels) || value.volumeAboveDiameterPixels <= value.fullBelowDiameterPixels ||
      !Array.isArray(value.views) || value.views.length < 4) throw new TypeError('Invalid prepared volume impostor bank or screen thresholds.');
  const ids = new Set<string>();
  const views = value.views.map((input: unknown) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid volume impostor view.');
    const view = input as Record<string, unknown>;
    if (Object.keys(view).sort().join(',') !== 'back,down,id,right,texturePath' ||
        typeof view.id !== 'string' || !/^[a-z0-9-]+$/u.test(view.id) || ids.has(view.id) ||
        typeof view.texturePath !== 'string' || !resources.has(view.texturePath) ||
        !unit(view.back) || !unit(view.right) || !unit(view.down) ||
        Math.abs(dot(view.back, view.right)) > 1e-6 || Math.abs(dot(view.back, view.down)) > 1e-6 ||
        Math.abs(dot(view.right, view.down)) > 1e-6 || dot(cross(view.right, view.back), view.down) < 1 - 1e-6) {
      throw new TypeError('Volume impostors need unique identities, declared textures and an orthonormal camera basis.');
    }
    ids.add(view.id);
    return { id: view.id, texturePath: view.texturePath, back: view.back, right: view.right, down: view.down };
  });
  return { schema: value.schema, radiusUnits: value.radiusUnits, fullBelowDiameterPixels: value.fullBelowDiameterPixels,
    volumeAboveDiameterPixels: value.volumeAboveDiameterPixels, views };
}
function positive(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function unit(value: unknown): value is VolumeVector {
  return Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n)) && Math.abs(Math.hypot(...value) - 1) < 1e-6;
}
