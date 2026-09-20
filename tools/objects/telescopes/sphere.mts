/** Package a measurement lens on the target's existing css.earth standard sphere. */
import { readFile,writeFile,mkdir,rm,rmdir,rename } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { requireRecord,requireArray,requireFiniteNumber } from '../../source-values.mts';
import { parseBodyMapProduct } from '../body-map-product.mts';
import { assertBodyMapPlanes } from '../body-map-publication.mts';
import { writeProductRecord } from '../product-record.mts';
import { sha256 } from '../../../src/platform/sha256.mts';
import { verifiedProduct,localOutput } from './projection.mts';

const root=resolve(import.meta.dirname,'../../..');
export async function exportSphere(recordPath:string,outputDirectory:string){
  const source=await verifiedProduct(recordPath);
  if(source.record.stage!=='body-map')throw new TypeError('Sphere export requires a registered body-map product; native pixels have no surface coordinates');
  for(const name of ['map.fits','map.fits.body-map.json','texture.png','poles.png','navigation.json'])if(!source.record.outputs.some(o=>o.path===name))throw new Error(`Body map has no prepared ${name}; export the measurement with --output body-map first`);
  const map=parseBodyMapProduct(JSON.parse(await readFile(localOutput(source.root,'map.fits.body-map.json'),'utf8'))),plane=await readFile(localOutput(source.root,map.planes.file));
  if(sha256(plane)!==map.planes.sha256)throw new Error('Map plane digest differs from its metadata');assertBodyMapPlanes(plane,map);
  const nav=requireRecord(JSON.parse(await readFile(localOutput(source.root,'navigation.json'),'utf8'))),radii=requireArray(nav.radiiKm).map(n=>requireFiniteNumber(n));
  if(radii.length!==3||radii.some(n=>n<=0)||radii[0]!==map.frame.radiusKm)throw new Error('Body dimensions disagree with navigation');
  const destination=resolve(outputDirectory),staging=`${destination}.${randomUUID()}.partial`;await mkdir(dirname(destination),{recursive:true});await mkdir(destination);await mkdir(staging);
  try{
  const compiled=await build({entryPoints:[resolve(root,'tools/objects/telescopes/sphere-lane.mts')],bundle:true,write:false,platform:'node',format:'esm',packages:'external',metafile:true});
  const moduleFile=resolve(staging,'lane.mjs');await writeFile(moduleFile,compiled.outputFiles[0].text);
  const owner:typeof import('./sphere-lane.mts')=await import(pathToFileURL(moduleFile).href);
  const longitude=(360-map.observations[0].subObserver.westLongitudeDegrees)%360,latitude=map.observations[0].subObserver.latitudeDegrees;
  const prepared=await owner.measurementSphere(root,map.frame.body,localOutput(source.root,'texture.png'),staging,{longitudeDegrees:longitude,latitudeDegrees:latitude,zoom:1.1});
  const norm=requireRecord(nav.normalization),satisfaction=requireRecord(nav.sourceSatisfaction);
  const request=requireRecord(nav.sourceRequest);
  const metadata={target:map.frame.body,radiiKm:radii,shape:nav.shape,grid:map.grid,units:map.definition.units,normalization:norm,registration:nav.registration,sourceRequest:request,sourceSatisfaction:satisfaction,uncertainty:nav.uncertainty,mapSha256:map.planes.sha256,renderer:prepared.owner};
  const html=owner.sphereHtml(prepared,metadata,`${map.frame.body} · ${map.definition.quantity}`,`${map.definition.units} · ${Number(norm.minimum).toPrecision(4)}–${Number(norm.maximum).toPrecision(4)} · grey: unobserved`);
    await writeFile(resolve(staging,'sphere.html'),html);
    const fresh=await verifiedProduct(source.file);if(fresh.pin.sha256!==source.pin.sha256)throw new Error('Body map changed during sphere preparation');
    const files=[...new Set(Object.keys(compiled.metafile.inputs))].filter(p=>!p.startsWith('<'));
    const implementation=sha256(Buffer.concat([await readFile(new URL('sphere.mts',import.meta.url)),...await Promise.all(files.sort().map(path=>readFile(resolve(root,path))))]));
    await writeProductRecord(resolve(staging,'sphere.product.json'),{telescope:source.record.telescope,stage:'telescope-sphere',inputs:[{role:'body-map record',identity:source.file,...source.pin},...prepared.inputs.filter(input=>!input.identity.startsWith(staging)),...source.record.outputs.map(o=>({role:'body-map output',identity:localOutput(source.root,o.path),sha256:o.sha256,bytes:o.bytes}))],parameters:metadata,software:[{name:'cssEarth / PolyCSS prepared sphere',version:implementation}]},[{path:'sphere.html',file:resolve(staging,'sphere.html')}]);
    await rm(moduleFile);await rm(resolve(staging,'raster'),{recursive:true});
    await rmdir(destination);await rename(staging,destination);
    return {directory:destination,html:resolve(destination,'sphere.html'),receipt:resolve(destination,'sphere.product.json'),sourceRequest:request,sourceSatisfaction:satisfaction};
  }catch(error){await rm(staging,{recursive:true,force:true});await rmdir(destination).catch(()=>{});throw error;}
}
