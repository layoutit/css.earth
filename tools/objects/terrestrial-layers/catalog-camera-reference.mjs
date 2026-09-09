/** Registration evidence only: reproject the existing published mosaic into
 * its archived observation camera on the complete source mesh. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSourceManifest} from '../../../src/platform/source-manifest.mjs';
import {loadCameraShape,resolveCatalogCamera,controlledShapeCamera} from './shape-camera-mosaic.mjs';
import {readFitsPrimary} from '../static-surface/fits-map.mjs';

const [sourceArg,outputArg]=process.argv.slice(2),source=resolve(sourceArg);
const config=JSON.parse(await readFile(resolve(source,'preparation/terrestrial.json')));
await (await createSourceManifest({planetId:config.namespace,planetName:config.displayName,sourceRoot:source})).verify();
const frame=await resolveCatalogCamera(source,config.raster.mosaics.find(lens=>lens.id==='calibrated').frames[0]);
const camera=controlledShapeCamera(frame),mesh=await loadCameraShape(source,config.geometry.radialTerrain);
const manifest=JSON.parse(await readFile(resolve(source,'manifest.json'))),entry=manifest.inputs.find(entry=>entry.lensId==='normal');
const fits=readFitsPrimary(await readFile(resolve(source,entry.path)));
const validity=config.raster.observations.find(lens=>lens.id==='normal').validity;
if(validity.kind!=='fits-byte-monochrome'||validity.rowOrder!=='north-to-south'||validity.longitudeDirection!=='east'||validity.centerLongitude!==0||validity.noData!==0)throw new Error('Unsupported reference-mosaic coordinates.');
const mod=(a,b)=>(a%b+b)%b,buffer=Buffer.alloc(800*800*4);
for(let y=0;y<800;y++)for(let x=0;x<800;x++){
 const ray=camera.ray(x,y),hit=mesh.intersect(camera.position,ray);if(!hit)continue;
 const p=camera.position.map((v,k)=>v+ray[k]*hit.radius);
 const lon=Math.atan2(p[1],p[0])*180/Math.PI,lat=Math.atan2(p[2],Math.hypot(p[0],p[1]))*180/Math.PI;
 const sx=mod(lon+180,360)/360*fits.width-.5,sy=Math.max(0,Math.min(fits.height-1,(.5-lat/180)*fits.height-.5));
 const ix=Math.floor(sx),iy=Math.floor(sy),u=sx-ix,v=sy-iy;
 const at=(dx,dy)=>fits.values[Math.min(iy+dy,fits.height-1)*fits.width+mod(ix+dx,fits.width)];
 const values=[at(0,0),at(1,0),at(0,1),at(1,1)];if(values.some(n=>n===0))continue;
 const value=(values[0]*(1-u)+values[1]*u)*(1-v)+(values[2]*(1-u)+values[3]*u)*v;
 buffer.writeFloatLE(value,(y*800+x)*4);
}
await writeFile(resolve(outputArg),buffer);
