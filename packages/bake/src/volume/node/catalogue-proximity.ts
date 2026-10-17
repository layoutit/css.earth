import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { inventoryPreparedSubset } from '@cssearth/objects/node';
import { CATALOGUE_POINTS_SCHEMA, PREPARED_CATALOGUE_PROXIMITY_SCHEMA, parseObjectDescriptor, parseCatalogueProximity, parseDensityVolumeFrame, readCataloguePointBank, type PreparedCatalogueProximity } from '@cssearth/objects';
import { readCatalogueBank, writeCatalogueBank } from './catalogue-banks.ts';

/** Split a restored stack without reselecting, moving or recoloring any catalogue row. */
export async function prepareCatalogueProximity(objectDirectory: string, id: string, recipe: Record<string, unknown>, localOnly: boolean) {
  const bank = readCataloguePointBank(await readCatalogueBank(objectDirectory,id));
  const volume: unknown = JSON.parse(await readFile(resolve(objectDirectory,'prepared/volume.json'),'utf8'));
  if (!volume || typeof volume !== 'object' || !('data' in volume) || !volume.data || typeof volume.data !== 'object' || !('frame' in volume.data)) throw new TypeError('Proximity requires the prepared disc frame.');
  const frame = parseDensityVolumeFrame(volume.data.frame), levels = bank.appearance.levels;
  if (!levels?.length || !recipe.proximity || typeof recipe.proximity !== 'object') throw new TypeError('Stack requires proximity metadata and prepared levels.');
  const entries: PreparedCatalogueProximity['levels'][number][] = [];
  let start = 0;
  for (const [index,level] of levels.entries()) {
    const name = `${id}-level-${index}`, points = bank.points.slice(start,start+level.points);start += level.points;
    // Preserve the encoded color and radius, including the palette's magnitude tiers.
    const palette: string[] = [], radii: number[] = [], keys = new Map<string,number>();
    const rows = points.map(p => { const key = `${p.colorCss}|${p.radiusPx}`;let at=keys.get(key);if(at===undefined){at=palette.length;keys.set(key,at);palette.push(p.colorCss);radii.push(p.radiusPx);}return [...p.positionUnits,at]; });
    const output={schema:CATALOGUE_POINTS_SCHEMA,id:name,frame:bank.frame,appearance:{colorCss:'#ffffff',radiusPx:.75,opacity:bank.appearance.opacity,palette,paletteRadiusPx:radii},points:rows};
    await writeCatalogueBank({objectDirectory,id:name,published:true,inventory:async()=>{},bank:output});
    entries.push({file:`${name}.bin`,nearOpacity:level.nearOpacity??1,...('appearUnits' in level?{appearUnits:level.appearUnits.map(v=>v*bank.frame.metersPerUnit/frame.metersPerUnit) as [number,number]}:{})});
  }
  const proximity=recipe.proximity as Record<string,unknown>;
  const index=parseCatalogueProximity({schema:PREPARED_CATALOGUE_PROXIMITY_SCHEMA,frame,disc:proximity.disc,levels:entries});
  const directory=resolve(objectDirectory,'prepared');await mkdir(directory,{recursive:true});
  await writeFile(resolve(directory,'catalogue-proximity.json'),JSON.stringify(index)+'\n');
  const descriptorPath=resolve(objectDirectory,'object.json'), descriptor=parseObjectDescriptor(JSON.parse(await readFile(descriptorPath,'utf8')));
  await writeFile(descriptorPath,JSON.stringify({...descriptor,properties:{...descriptor.properties,catalogueProximity:'catalogue-proximity.json'}},null,2)+'\n');
  if (!localOnly) await inventoryPreparedSubset({objectId:basename(objectDirectory),objectDirectory,owns:file=>file==='catalogue-proximity.json'||entries.some(e=>e.file===file)});
  console.log(`Prepared ${entries.length} independently loadable catalogue levels (${bank.points.length} unchanged points).`);
}
