/** The catalogue's gas owners from the approved scene, their geometry and luminosity unchanged. */
import { approvedScene } from '../delivery/reference.mts';
import type { VolumeObject } from '../catalogue-volume.mts';
import type { V3 } from '../geometry.mts';
import { need } from '../inputs.mts';
import type { RegionBox } from '../spatial-selection.mts';

export const L37_DIR = 'src/objects/lmc-volume/.local/versions/l37/';
export interface Emitter { object: VolumeObject; amplitude: number; }
function shapeBounds(objects: readonly VolumeObject[]): RegionBox {
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const o of objects) for (let a = 0; a < 3; a++) { const radius = Math.sqrt(o.axes.reduce((n, r, k) => n + (r * o.basis[k]![a]!) ** 2, 0)); min[a] = Math.min(min[a]!, o.center[a]! - radius); max[a] = Math.max(max[a]!, o.center[a]! + radius); }
  for (let a = 0; a < 3; a++) { const guard = Math.max(.00025, (max[a]! - min[a]!) * .03); min[a]! -= guard; max[a]! += guard; }
  return { min, max };
}
export interface GasRegion { id: string; label: string; box: RegionBox; emitters: Emitter[]; }

/** Every catalogue gas owner, and the scene without any of them: slabs then hold only smooth light, stars and dust. */
export async function allGasSource() {
  const source = await approvedScene(), { scene } = source, byOwner = new Map<string, Emitter[]>(), index = new Map(scene.owners.map((o, i) => [o.id, i] as const));
  for (const object of scene.objects) { if (object.component !== 4) continue; const i = index.get(object.owner); need(i !== undefined && scene.owners[i]!.component === 4, 'A gas object without a gas owner: ' + object.id); const list = byOwner.get(object.owner) ?? []; list.push({ object, amplitude: source.amplitudes[i!]! * (scene.ionizedGain ?? 1) }); byOwner.set(object.owner, list); }
  const regions: GasRegion[] = [...byOwner].map(([id, emitters]) => ({ id: id.toLowerCase().replace(/[^a-z0-9]+/gu, '-'), label: id, box: shapeBounds(emitters.map(e => e.object)), emitters }));
  return { source, regions, background: { ...scene, objects: scene.objects.filter(o => o.component !== 4) } };
}
