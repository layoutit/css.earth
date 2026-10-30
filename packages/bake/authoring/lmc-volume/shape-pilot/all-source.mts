/** Every catalogue HII region, shell and filament keeps the approved finite 3D geometry. */
import type { CatalogueScene } from '../catalogue-scene.mts';
import type { VolumeObject } from '../catalogue-volume.mts';
import { effectiveEmitters, shapeBounds, type Emitter } from './source.mts';
import type { RegionBox } from '../piece-pilot/regions.mts';
import { need } from '../inputs.mts';

export interface FiniteRegion { id: string; label: string; box: RegionBox; emitters: Emitter[]; }
export function allFiniteRegions(scene: CatalogueScene, amplitudes: Float64Array): FiniteRegion[] {
  const groups = new Map<string, VolumeObject[]>();
  for (const object of scene.objects) if (object.component === 4) { const group = groups.get(object.owner) ?? []; group.push(object); groups.set(object.owner, group); }
  const ids = new Set<string>();
  return [...groups].map(([owner, objects]) => {
    const id = 'region-' + owner.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/-$/u, '');
    need(!ids.has(id), 'Finite catalogue region identities collide'); ids.add(id);
    return { id, label: owner, box: shapeBounds(objects), emitters: effectiveEmitters(scene, amplitudes, objects) };
  });
}
export function continuousWithoutFiniteGas(scene: CatalogueScene): CatalogueScene {
  return { ...scene, objects: scene.objects.filter(o => o.component !== 4) };
}
