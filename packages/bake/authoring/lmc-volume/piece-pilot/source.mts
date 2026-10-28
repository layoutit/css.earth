/** Region bounds change only bake allocation, never the approved physical objects. */
import { pathToFileURL } from 'node:url';
import { approvedScene, APPROVED_COMMIT } from '../delivery/reference.mts';
import { refineFields } from '../delivery/refined-fields.mts';
import { need, json, rec, array, numbers, num } from '../inputs.mts';
import type { CatalogueScene, Owner } from '../catalogue-scene.mts';
import type { RegionBox } from './regions.mts';
import type { V3 } from '../geometry.mts';
export const PILOT_DIR = 'src/objects/lmc-volume/.local/versions/l36/piece-pilot/';
export function ownerBox(scene: CatalogueScene, owner: string): RegionBox {
  const objects = scene.objects.filter(o => o.owner === owner); need(objects.length > 0, 'A pilot owner needs real 3D primitives');
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const object of objects) for (let a = 0; a < 3; a++) {
    const radius = Math.sqrt(object.axes.reduce((s, r, k) => s + (r * object.basis[k]![a]!) ** 2, 0));
    min[a] = Math.min(min[a]!, object.center[a]! - radius); max[a] = Math.max(max[a]!, object.center[a]! + radius);
  }
  for (let a = 0; a < 3; a++) { min[a] = Math.floor((min[a]! - .015) / .015) * .015; max[a] = Math.ceil((max[a]! + .015) / .015) * .015; }
  return { min, max };
}
export function overlap(a: RegionBox, b: RegionBox) { return a.min.every((v, k) => v < b.max[k]! && a.max[k]! > b.min[k]!); }
export function selectRegions(scene: CatalogueScene) {
  const tara = scene.owners.find(o => o.aliases.some(a => a === '30 Doradus' || a === 'NGC2070'));
  need(tara, 'The approved model must contain 30 Dor');
  const taraBox = ownerBox(scene, tara.id);
  const candidates = scene.owners.filter(o => o.component === 4 && o.id !== tara.id && scene.objects.some(v => v.owner === o.id))
    .map(owner => ({ owner, box: ownerBox(scene, owner.id) })).filter(v => !overlap(taraBox, v.box));
  const preferred = candidates.filter(v => v.owner.aliases.some(a => /^N(?:11|44)(?:[A-Z])?$/u.test(a)))
    .sort((a, b) => Math.max(...a.box.max.map((v, k) => v - a.box.min[k]!)) - Math.max(...b.box.max.map((v, k) => v - b.box.min[k]!)));
  const compact = preferred[0] ?? candidates.filter(v => Math.max(...v.box.max.map((n, k) => n - v.box.min[k]!)) < .3).sort((a, b) => b.owner.prior - a.owner.prior)[0];
  need(compact, 'No separate compact catalogue region is available');
  const record = (id: string, owner: Owner, box: RegionBox) => ({ id, ownerId: owner.id, aliases: owner.aliases, box,
    primitiveCount: scene.objects.filter(v => v.owner === owner.id).length });
  return [record('tarantula', tara, taraBox), record('compact', compact.owner, compact.box)];
}
export async function pilotSource() { const source = await approvedScene(); await refineFields(source.scene); return { ...source, regions: selectRegions(source.scene) }; }
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const source = await pilotSource(); console.log(JSON.stringify({ regions: source.regions, owners: source.scene.owners.length, objects: source.scene.objects.length }, null, 2));
}

/** Capture and encoding read the measured plan; they do not need to reconstruct the physical scene. */
export async function readPilotRegions(){
 const c=rec(await json(PILOT_DIR+'configuration.json'));need(c.approvedCommit===APPROVED_COMMIT&&c.size===128,'The saved plan must belong to the approved tiny source');
 const regions=array(c.regions).map(v=>{const r=rec(v),b=rec(r.box),lo=numbers(b.min,3),hi=numbers(b.max,3);need(typeof r.id==='string'&&typeof r.ownerId==='string'&&array(r.aliases).every(v=>typeof v==='string'),'Invalid saved region identity');const box:RegionBox={min:[lo[0]!,lo[1]!,lo[2]!],max:[hi[0]!,hi[1]!,hi[2]!]};need(box.min.every((v,a)=>v<box.max[a]!)&&Number.isSafeInteger(r.primitiveCount)&&num(r.primitiveCount)>0,'Invalid saved region bounds');return{id:r.id,ownerId:r.ownerId,aliases:array(r.aliases).map(v=>{need(typeof v==='string','Invalid alias');return v;}),box,primitiveCount:num(r.primitiveCount)};});
 need(regions.length===2&&regions[0]!.id==='tarantula'&&regions[1]!.id==='compact'&&!overlap(regions[0]!.box,regions[1]!.box),'The saved pilot needs two disjoint regions');return regions;
}
