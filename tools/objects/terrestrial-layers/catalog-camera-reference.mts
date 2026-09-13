import {requireRecord,requireArray} from '../../source-values.mts';
import {parseRadialLoaderConfig} from './radial-source.mts';
/** Registration evidence only: reproject the existing published mosaic into
 * its archived observation camera on the complete source mesh. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import {loadCameraShape,resolveCatalogCamera,controlledShapeCamera} from './shape-camera-mosaic.mts';
import {readFitsPrimary} from '../observation/fits.mts';

const [sourceArg,outputArg,frameId]=process.argv.slice(2);
if (!sourceArg || !outputArg || (process.argv.length < 4 || process.argv.length > 5)) throw new TypeError('Usage: catalog-camera-reference.mts <source-directory> <output> [frame-id]');
const source=resolve(sourceArg);
const input=requireRecord(JSON.parse(await readFile(resolve(source,'preparation/terrestrial.json'),'utf8')));
const config=parseRadialLoaderConfig(input),raster=requireRecord(input.raster);
const lenses=requireArray(raster.surfaceObservations).map(value=>requireRecord(value)),observations=requireArray(raster.observations).map(value=>requireRecord(value));
const sourceManifest=await createSourceManifest({planetId:config.namespace,planetName:config.displayName ?? config.namespace,sourceRoot:source});
await sourceManifest.verify();
const frames=requireArray(requireRecord(lenses.find(lens=>lens.id==='calibrated')).frames).map(value=>requireRecord(value));
const selected=frameId===undefined?frames[0]:frames.find(frame=>frame.id===frameId);
if(!selected)throw new Error('Unknown registered observation frame.');
const frame=await resolveCatalogCamera(source,selected);
const camera=controlledShapeCamera(frame),mesh=await loadCameraShape(source,config.geometry.radialTerrain);
const entry=sourceManifest.manifest.inputs.find(entry=>requireRecord(entry).lensId==='normal');
if(!entry)throw new Error('Reference mosaic lacks its pinned source.');
const fits=readFitsPrimary(await readFile(resolve(source,entry.path)));
const validity=requireRecord(requireRecord(observations.find(lens=>lens.id==='normal')).validity);
if(validity.kind!=='fits-byte-monochrome'||validity.rowOrder!=='north-to-south'||validity.longitudeDirection!=='east'||validity.centerLongitude!==0||validity.noData!==0)throw new Error('Unsupported reference-mosaic coordinates.');
const mod=(a:number,b:number)=>(a%b+b)%b,buffer=Buffer.alloc(800*800*4);
for(let y=0;y<800;y++)for(let x=0;x<800;x++){
 const ray=camera.ray(x,y),hit=mesh.intersect(camera.position,[ray[0],ray[1],ray[2]]);if(!hit)continue;
 const p=camera.position.map((v,k)=>v+ray[k]*hit.radius);
 const lon=Math.atan2(p[1],p[0])*180/Math.PI,lat=Math.atan2(p[2],Math.hypot(p[0],p[1]))*180/Math.PI;
 const sx=mod(lon+180,360)/360*fits.width-.5,sy=Math.max(0,Math.min(fits.height-1,(.5-lat/180)*fits.height-.5));
 const ix=Math.floor(sx),iy=Math.floor(sy),u=sx-ix,v=sy-iy;
 const at=(dx:number,dy:number)=>fits.values[Math.min(iy+dy,fits.height-1)*fits.width+mod(ix+dx,fits.width)];
 const values=[at(0,0),at(1,0),at(0,1),at(1,1)];if(values.some(n=>n===0))continue;
 const value=(values[0]*(1-u)+values[1]*u)*(1-v)+(values[2]*(1-u)+values[3]*u)*v;
 buffer.writeFloatLE(value,(y*800+x)*4);
}
await writeFile(resolve(outputArg),buffer);
