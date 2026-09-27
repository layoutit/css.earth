import { sha256 } from '@cssearth/core/node';
import { readFile } from 'node:fs/promises';
import { requireRecord, requireString } from '@cssearth/core';
export interface Point { x:number; y:number; z:number; absoluteMagnitude:number|null; morphology:string }
export type CataloguePoint = Point & { pgc: number; distance: {
  valueMpc: number; method: 'cosmicflows-4-distance-modulus' | 'hyperleda-hi-hubble-law';
  modulus: number | null; modulusUncertainty: number | null; intervalMpc: readonly [number, number] | null;
} };
export function distanceModulusIntervalMpc(dm: number, sigma: number): readonly [number, number] {
  if (!Number.isFinite(sigma) || sigma < 0) throw new TypeError('Invalid distance modulus uncertainty.');
  return [distanceModulusMpc(dm - sigma), distanceModulusMpc(dm + sigma)];
}
const numeric=(value:string|undefined)=>value?.trim() ? Number(value) : NaN;
export function positionMpc(raDeg:number,decDeg:number,distanceMpc:number):[number,number,number] {
  if(![raDeg,decDeg,distanceMpc].every(Number.isFinite)||raDeg<0||raDeg>=360||Math.abs(decDeg)>90||distanceMpc<=0)throw new TypeError('Invalid catalogue position.');
  const ra=raDeg*Math.PI/180,dec=decDeg*Math.PI/180;
  return [distanceMpc*Math.cos(dec)*Math.cos(ra),distanceMpc*Math.cos(dec)*Math.sin(ra),distanceMpc*Math.sin(dec)];
}
export function distanceModulusMpc(dm:number):number {
  if(!Number.isFinite(dm))throw new TypeError('Invalid distance modulus.');
  return 10**((dm-25)/5);
}
/** Independent CDS table join. Local Group detail is supplied by the application's separate catalogue. */
export async function loadScientificCatalogue(radiusMpc:number, minimumDistanceMpc=3, hubbleKmSPerMpc=70) {
  if(!Number.isFinite(radiusMpc)||radiusMpc<=3)throw new TypeError('Invalid field radius.');
  const manifest=requireRecord(JSON.parse(await readFile('src/objects/nearby-universe/source/catalogue.json','utf8')));
  if(manifest.schema!=='cssearth-galaxy-field-sources@1'||!Array.isArray(manifest.sources))throw new TypeError('Invalid source manifest.');
  const tables=new Map<string,Record<string,string>[]>();
  for(const input of manifest.sources){
    const source=requireRecord(input),id=requireString(source.id),path=requireString(source.path);
    if(!path.startsWith('.local/galaxy-field/sources/')||path.includes('..'))throw new TypeError('Invalid source path.');
    const bytes=await readFile(path);
    if(bytes.length!==source.bytes)throw new Error(`Changed input: ${id}. Run acquisition and review its size.`);
    const [header,...lines]=bytes.toString('utf8').trimEnd().split('\n');
    const names=header!.trim().split('\t');
    const rows=lines.map(line=>{const values=line.split('\t').map(value=>value.trim().replace(/^"|"$/g,''));if(values.length!==names.length)throw new TypeError(`Invalid TSV row: ${id}`);return Object.fromEntries(names.map((name,i)=>[name,values[i]!]));});
    if(rows.length!==source.rows)throw new TypeError(`Incomplete source: ${id}`);
    tables.set(id,rows);
  }
  const required=(id:string)=>{const table=tables.get(id);if(!table)throw new TypeError(`Missing source: ${id}`);return table;};
  const velocities=new Map(required('hyperleda-hi').map(row=>[row.PGC,numeric(row.VHI)]));
  const pgc=new Map(required('hyperleda-pgc').map(row=>[row.PGC,row]));
  const cf4=new Map(required('cosmicflows-4').map(row=>[row.PGC,row]));
  if(cf4.size!==required('cosmicflows-4').length)throw new TypeError('Duplicate CF4 identity.');
  const ids=new Set([...pgc.keys(),...cf4.keys()]),points:CataloguePoint[]=[];
  let invalid=0,outside=0,local=0,measured=0,hubble=0;
  for(const id of ids){
    const measuredRow=cf4.get(id),row=measuredRow??pgc.get(id)!;
    const dm=numeric(row.DM),ra=numeric(row.RAdeg),dec=numeric(row.DEdeg);
    const distance=measuredRow ? distanceModulusMpc(dm) : (velocities.get(id)??NaN)/hubbleKmSPerMpc;
    if(![distance,ra,dec].every(Number.isFinite)||distance<=0){invalid++;continue;}
    if(distance<=minimumDistanceMpc){local++;continue;}
    if(distance>radiusMpc){outside++;continue;}
    const [x,y,z]=positionMpc(ra,dec,distance);
    const sigma = measuredRow ? numeric(measuredRow.e_DM) : NaN;
    const modulusUncertainty = Number.isFinite(sigma) && sigma >= 0 ? sigma : null;
    const identity = Number(id);
    if (!Number.isSafeInteger(identity) || identity <= 0) throw new TypeError('Invalid PGC identity.');
    points.push({x,y,z,absoluteMagnitude:null,morphology:pgc.get(id)?.MType??'', pgc: identity,
      distance: { valueMpc: distance, method: measuredRow ? 'cosmicflows-4-distance-modulus' : 'hyperleda-hi-hubble-law',
        modulus: measuredRow ? dm : null, modulusUncertainty,
        intervalMpc: modulusUncertainty === null ? null : distanceModulusIntervalMpc(dm, modulusUncertainty) } });
    if(measuredRow)measured++;else hubble++;
  }
  return {points,count:ids.size,invalid,outside,local,lineage:{sources:manifest.sources,
    frame:'Heliocentric equatorial J2000 coordinates, converted to Cartesian Mpc.',
    distancePolicy:`CF4 individual distance modulus takes precedence. Positive HyperLEDA VHI/${hubbleKmSPerMpc} supplies a Hubble-law estimate otherwise; peculiar velocities are not corrected.`,
    selection:`Union of CF4 and the 50,000 largest angular-diameter PGC rows, exact PGC join. Field is limited to ${minimumDistanceMpc}–${radiusMpc} Mpc; the Local Group is rendered separately.`,
    uncertainty:'CF4 e_DM is retained as the reported distance-modulus uncertainty, transformed to asymmetric distance bounds using DM +/- e_DM. Hubble-law estimates have no imported uncertainty; null does not mean exact.',
    photometry:'No optical luminosity measurements imported. Point brightness and morphology tints are authored display values.',
    measuredDistanceRows:measured,hubbleDistanceRows:hubble}};
}
