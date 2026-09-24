/** Package a measurement lens on the target's existing css.earth standard sphere. */
import { readFile, writeFile, mkdir, mkdtemp, rm, rmdir, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import sharp from 'sharp';
import { requireRecord, requireArray, requireFiniteNumber, requireString } from '@cssearth/core';
import { parseBodyMapProduct } from '../../body-map-product.mts';
import { assertBodyMapPlanes } from '../../body-map-publication.mts';
import { writeProductRecord } from '../../product-record.mts';
import { sha256 } from '../../../../src/platform/sha256.mts';
import { verifiedProduct, localOutput } from '../verified-product.mts';
import { contextTarget, sourceContext } from '../delivery-context.mts';

const root=resolve(import.meta.dirname,'../../../..');
type SphereOwner=typeof import('./sphere-lane.mts');
async function loadSphereOwner(){
  await mkdir(resolve(root,'work'),{recursive:true});const directory=await mkdtemp(resolve(root,'work/telescope-sphere-owner-'));
  const compiled=await build({entryPoints:[resolve(root,'tools/objects/telescopes/sphere/sphere-lane.mts')],bundle:true,write:false,platform:'node',format:'esm',packages:'external',metafile:true});
  const moduleFile=resolve(directory,'lane.mjs');await writeFile(moduleFile,compiled.outputFiles[0].text);
  const owner:SphereOwner=await import(`${pathToFileURL(moduleFile).href}?${randomUUID()}`);return {compiled,owner,cleanup:()=>rm(directory,{recursive:true,force:true})};
}
export async function validateSphereBundle(source:Awaited<ReturnType<typeof verifiedProduct>>){
  if(source.record.stage!=='body-map')throw new TypeError('Sphere export requires a registered body-map product; native pixels have no surface coordinates');
  for(const name of ['map.fits','map.fits.body-map.json','texture.png','poles.png','navigation.json'])if(!source.record.outputs.some(o=>o.path===name))throw new Error(`Body map has no prepared ${name}; export the measurement with --output body-map first`);
  const map=parseBodyMapProduct(JSON.parse(await readFile(localOutput(source.root,'map.fits.body-map.json'),'utf8'))),plane=await readFile(localOutput(source.root,map.planes.file));
  if(map.planes.file!=='map.fits'||!source.record.outputs.some(output=>output.path===map.planes.file))throw new Error('Body-map metadata does not bind the projected map.fits output');
  assertBodyMapPlanes(plane,map);
  for(const name of ['texture.png','poles.png']){const image=await sharp(localOutput(source.root,name)).metadata();if(!image.width||!image.height)throw new Error(`Body map has an invalid ${name}`);}
  const nav=requireRecord(JSON.parse(await readFile(localOutput(source.root,'navigation.json'),'utf8'))),radii=requireArray(nav.radiiKm).map(n=>requireFiniteNumber(n));
  if(radii.length!==3||radii.some(n=>n<=0)||radii[0]!==map.frame.radiusKm)throw new Error('Body dimensions disagree with navigation');
  requireString(nav.shape);requireRecord(nav.registration);requireString(nav.uncertainty);
  const norm=requireRecord(nav.normalization);requireFiniteNumber(norm.minimum);requireFiniteNumber(norm.maximum);requireString(norm.colormap);requireString(norm.missing);
  const context=sourceContext(nav);
  if(contextTarget(context)!==map.frame.body)throw new Error('Source context target disagrees with the body map');
  return {source,map,nav,radii,norm,context,plane};
}
export async function validateSphereSource(source:Awaited<ReturnType<typeof verifiedProduct>>,workspaceRoot=root,heldOwner?:SphereOwner){
  const bundle=await validateSphereBundle(source);
  if(heldOwner)await heldOwner.inspectMeasurementSphere(workspaceRoot,bundle.map.frame.body);
  else{const loaded=await loadSphereOwner();try{await loaded.owner.inspectMeasurementSphere(workspaceRoot,bundle.map.frame.body);}finally{await loaded.cleanup();}}
  return bundle;
}
export async function sphereSource(recordPath:string,workspaceRoot=root){return validateSphereSource(await verifiedProduct(recordPath),workspaceRoot);}

export async function exportSphere(recordPath:string,outputDirectory:string){
  const source=await verifiedProduct(recordPath),bundle=await validateSphereBundle(source);
  const destination=resolve(outputDirectory),staging=`${destination}.${randomUUID()}.partial`;await mkdir(dirname(destination),{recursive:true});await mkdir(destination);await mkdir(staging);
  try{
  const loaded=await loadSphereOwner();try{const {compiled,owner}=loaded;await owner.inspectMeasurementSphere(root,bundle.map.frame.body);const {map,nav,radii,norm,context}=bundle;
  const longitude=(360-map.observations[0].subObserver.westLongitudeDegrees)%360,latitude=map.observations[0].subObserver.latitudeDegrees;
  const prepared=await owner.measurementSphere(root,map.frame.body,localOutput(source.root,'texture.png'),staging,{longitudeDegrees:longitude,latitudeDegrees:latitude,zoom:1.1});
  const metadata={target:map.frame.body,radiiKm:radii,shape:nav.shape,grid:map.grid,units:map.definition.units,normalization:norm,registration:nav.registration,sourceContext:context,uncertainty:nav.uncertainty,mapSha256:sha256(await readFile(localOutput(source.root,map.planes.file))),renderer:prepared.owner};
  const html=owner.sphereHtml(prepared,metadata,`${map.frame.body} · ${map.definition.quantity}`,`${map.definition.units} · ${Number(norm.minimum).toPrecision(4)}–${Number(norm.maximum).toPrecision(4)} · grey: unobserved`);
    await writeFile(resolve(staging,'sphere.html'),html);
    const fresh=await verifiedProduct(source.file);if(fresh.pin.sha256!==source.pin.sha256)throw new Error('Body map changed during sphere preparation');
    const files=[...new Set(Object.keys(compiled.metafile.inputs))].filter(p=>!p.startsWith('<'));
    const implementation=sha256(Buffer.concat([await readFile(new URL('sphere.mts',import.meta.url)),...await Promise.all(files.sort().map(path=>readFile(resolve(root,path))))]));
    await writeProductRecord(resolve(staging,'sphere.product.json'),{telescope:source.record.telescope,stage:'telescope-sphere',inputs:[{role:'body-map record',identity:source.file,...source.pin},...prepared.inputs.filter(input=>!input.identity.startsWith(staging)),...source.record.outputs.map(o=>({role:'body-map output',identity:localOutput(source.root,o.path),bytes:o.bytes}))],parameters:metadata,software:[{name:'cssEarth / PolyCSS prepared sphere',version:implementation}]},[{path:'sphere.html',file:resolve(staging,'sphere.html')}]);
    await rm(resolve(staging,'raster'),{recursive:true});
    await rmdir(destination);await rename(staging,destination);
    return {directory:destination,html:resolve(destination,'sphere.html'),receipt:resolve(destination,'sphere.product.json'),sourceContext:context};
  }finally{await loaded.cleanup();}
  }catch(error){await rm(staging,{recursive:true,force:true});await rmdir(destination).catch(()=>{});throw error;}
}
