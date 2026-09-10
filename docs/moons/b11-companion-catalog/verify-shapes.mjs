// Sampled geometry evidence, separate from the simplifier's error estimate.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseObjShape,createIndexedShape} from '../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import {simplifyRadialShape} from '../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
const report={schema:'cssearth-sn263-source-fit@1',qualification:'Sampled source-to-prepared radial deviation, not an exhaustive bound or observational uncertainty.',sampling:'5 degree longitude/latitude grid, latitudes -87.5 through 87.5 degrees, plus each native vertex direction.',cases:[]};
for(const id of ['asteroid-2001-sn263','sn263-beta','sn263-gamma']){
 const root=new URL(`../../../src/planets/${id}/source/`,import.meta.url);
 const config=JSON.parse(await readFile(new URL('preparation/terrestrial.json',root))),p=config.geometry.radialTerrain;
 const bytes=await readFile(new URL(p.path,root)),mesh=parseObjShape(bytes.toString(),p.grid),faces=await simplifyRadialShape(mesh,p,1);
 const vertices=faces.flatMap(f=>f.vertices),indices=faces.map((_,i)=>[i*3,i*3+1,i*3+2]);
 const reduced=createIndexedShape(vertices,indices,{metersPerUnit:1,expectedVertices:vertices.length,expectedFaces:faces.length});
 const sample=[];for(let lat=-87.5;lat<90;lat+=5)for(let lon=0;lon<360;lon+=5)sample.push([lon,lat]);
 for(const [x,y,z]of mesh.positions)sample.push([Math.atan2(y,x)*180/Math.PI,Math.atan2(z,Math.hypot(x,y))*180/Math.PI]);
 const errors=sample.map(([lon,lat])=>{const a=mesh.sample(lon,lat),b=reduced.sample(lon,lat);if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('A surface ray missed');return Math.abs(a-b)}).sort((a,b)=>a-b);
 const measured={sampleCount:errors.length,meanMeters:errors.reduce((a,b)=>a+b,0)/errors.length,p95Meters:errors[Math.floor(errors.length*.95)],maximumMeters:errors.at(-1)};
 measured.simplifierErrorIsNotRadialBound=true;
 report.cases.push({id,sourceSha256:createHash('sha256').update(bytes).digest('hex'),sourceVertices:mesh.vertices,sourceFaces:mesh.faces,preparedFaces:faces.length,simplification:faces.simplification,measured});
}
await writeFile(new URL('./shape-fit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report.cases.map(x=>({id:x.id,...x.measured})));
