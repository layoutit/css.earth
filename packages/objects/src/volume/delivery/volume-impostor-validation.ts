import { PREPARED_VOLUME_IMPOSTORS_SCHEMA } from './volume-schemas.js';
import { cross3 as cross, dot3 as dot } from '@cssearth/core';
import type { PreparedVolumeImpostors } from './css-volume-types.js';
import type { VolumeVector } from '../../density-volume.js';

export function validateVolumeImpostors(input: unknown, resources: ReadonlySet<string>): PreparedVolumeImpostors {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Invalid prepared volume impostors.');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(',') !== [...['fullBelowDiameterPixels','radiusUnits','schema','views','volumeAboveDiameterPixels'],...(Object.hasOwn(value,'discPlane')?['discPlane']:[]),...(Object.hasOwn(value,'distanceFade')?['distanceFade']:[])].sort().join(',') ||
      value.schema !== PREPARED_VOLUME_IMPOSTORS_SCHEMA || !positive(value.radiusUnits) || !positive(value.fullBelowDiameterPixels) ||
      !positive(value.volumeAboveDiameterPixels) || value.volumeAboveDiameterPixels <= value.fullBelowDiameterPixels ||
      !Array.isArray(value.views) || value.views.length < 4) throw new TypeError('Invalid prepared volume impostor bank or screen thresholds.');
  let distanceFade: PreparedVolumeImpostors['distanceFade'];if(Object.hasOwn(value,'distanceFade')){const f=value.distanceFade;if(!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).sort().join(',')!=='detailBelowUnits,impostorAboveUnits')throw new TypeError('Invalid impostor distance fade');const detail:unknown=Reflect.get(f,'detailBelowUnits'),far:unknown=Reflect.get(f,'impostorAboveUnits');if(!positive(detail)||!positive(far)||far<=detail)throw new TypeError('Impostor distance fade must increase from detail to distant');distanceFade={detailBelowUnits:detail,impostorAboveUnits:far};}
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
    volumeAboveDiameterPixels: value.volumeAboveDiameterPixels, views, ...(Object.hasOwn(value,'discPlane')?(()=>{const d=value.discPlane as {right?:unknown;up?:unknown}|undefined;if(!d||!unit(d.right)||!unit(d.up))throw new TypeError('A disc plane is two unit vectors.');return{discPlane:{right:d.right,up:d.up}};})():{}), ...(distanceFade?{distanceFade}:{}) };
}
function positive(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function unit(value: unknown): value is VolumeVector {
  return Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n)) && Math.abs(Math.hypot(...value) - 1) < 1e-6;
}
