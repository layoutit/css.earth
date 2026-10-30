/** The pilot's gas regions: whole catalogue owners from the approved l36 scene, their geometry and luminosity unchanged. */
import { approvedScene } from '../delivery/reference.mts';
import { effectiveEmitters, partitionEmitters, shapeBounds, type Emitter } from '../shape-pilot/source.mts';
import { need } from '../inputs.mts';
import type { RegionBox } from '../piece-pilot/regions.mts';

export const L37_DIR = 'src/objects/lmc-volume/.local/versions/l37/';
export const PILOT_REGIONS = [
  { id: 'dor30', label: '30 Doradus', owners: ['BicaNeb-1252', 'DEM263'] },
  { id: 'n44', label: 'N44', owners: ['BicaNeb-780', 'DEM158'] },
  { id: 'n11', label: 'N11', owners: ['DEM34'] },
  { id: 'n206', label: 'N206', owners: ['DEM221'] },
  { id: 'n119', label: 'N119', owners: ['BicaNeb-697'] },
  { id: 'n160', label: 'N160', owners: ['DEM284'] },
  { id: 'n61', label: 'N61', owners: ['DEM239'] },
  { id: 'n79', label: 'N79', owners: ['DEM6'] },
  { id: 'n154', label: 'N154', owners: ['DEM246'] },
  { id: 'n200', label: 'N200', owners: ['DEM164'] },
  { id: 'n9', label: 'N9', owners: ['DEM31'] },
  { id: 'dem195', label: 'DEM L195', owners: ['DEM195'] },
] as const;
export interface GasRegion { id: string; label: string; box: RegionBox; emitters: Emitter[]; }

export async function pilotSource() {
  const source = await approvedScene(), { scene } = source;
  const regions: GasRegion[] = PILOT_REGIONS.map(r => {
    const owners = new Set<string>(r.owners), objects = scene.objects.filter(o => owners.has(o.owner));
    need(objects.length > 0 && objects.every(o => o.component === 4), 'A pilot region holds only finite gas: ' + r.id);
    return { id: r.id, label: r.label, box: shapeBounds(objects), emitters: effectiveEmitters(scene, source.amplitudes, objects) };
  });
  return { source, regions, background: partitionEmitters(scene, regions) };
}
