import {readFile,mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {parsePdsRadiusTable} from '../terrestrial-layers/obj-shape.mts';
import {matrixCamera} from '../surface-observations/cameras.mts';
import {decodeNearMsi} from '../terrestrial-layers/near-msi.mts';
import {requireRecord,requireArray,requireString,requireFiniteNumber} from '@cssearth/core';
const root='src/objects/mathilde',source=`${root}/source`,out=`${root}/evidence/near-msi`;
const body=requireRecord(JSON.parse(await readFile(`${root}/prepared/surfaces.json`,'utf8')));
const surface=requireArray(body.surfaces).map(v=>requireRecord(v)).find(s=>s.id==='near-msi');if(!surface)throw Error('Missing NEAR preparation');
const observation=requireRecord(surface.observation),frame=requireRecord(requireArray(observation.frames)[0]);
const camera=matrixCamera('archived-closure',frame.camera);
const closure=JSON.parse(await readFile(`${source}/observations/near-msi/42826360-camera.json`,'utf8'));
const image=decodeNearMsi(await readFile(`${source}/observations/near-msi/m0042826360f0_2p_iof.fit`),await readFile(`${source}/observations/near-msi/m0042826360f0_2p.fit`),closure);
const mesh=parsePdsRadiusTable(await readFile(`${source}/shape/stooke-253mathilde.tab`,'utf8'),{stepDegrees:5,longitudeDirection:'east-positive',metersPerUnit:1000,expectedVertices:2522,expectedFaces:5040});
const display=requireRecord(observation.display),low=requireFiniteNumber(display.low),high=requireFiniteNumber(display.high);
const pixels=Buffer.from(Array.from(image.planes.IMAGE,v=>Math.round(255*Math.max(0,Math.min(1,(v-low)/(high-low))))));
const paths:string[]=[];const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,v,i)=>s+v*b[i],0);
for(const face of mesh.indices){
 const [a,b,c]=face.map(i=>mesh.positions[i]),ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
 const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],centre=a.map((v,i)=>(v+b[i]+c[i])/3);
 if(dot(n,camera.positionMeters.map((v,i)=>v-centre[i]))<=0)continue;
 const projected=[a,b,c].map(p=>camera.project(p));if(projected.some(p=>!p||p[2]<=0))continue;
 paths.push(`M${projected.map(p=>p?`${p[0]},${p[1]}`:'').join('L')}Z`);
}
const base=await sharp(pixels,{raw:{width:image.width,height:image.height,channels:1}}).png().toBuffer();
const overlay=Buffer.from(`<svg width="537" height="244"><path d="${paths.join('')}" fill="none" stroke="#00ff88" stroke-opacity=".55" stroke-width=".22"/></svg>`);
// Composite first in native detector coordinates; flip and correct the pixel aspect together.
const mounted=await sharp(base).composite([{input:overlay}]).png().toBuffer();
const left=await sharp(base).flip().resize(537,412,{fit:'fill'}).png().toBuffer(),right=await sharp(mounted).flip().resize(537,412,{fit:'fill'}).png().toBuffer();
const labels=Buffer.from('<svg width="1074" height="42"><rect width="1074" height="42" fill="#111"/><g fill="white" font-size="17" font-family="sans-serif"><text x="12" y="26">Native NEAR I/F • MET 42826360</text><text x="549" y="26">Selected Stooke mesh • refined camera</text></g></svg>');
await mkdir(out,{recursive:true});
await sharp({create:{width:1074,height:454,channels:3,background:'#111'}}).composite([{input:labels,top:0,left:0},{input:left,top:42,left:0},{input:right,top:42,left:537}]).webp({quality:90}).toFile(`${out}/registration.webp`);
await writeFile('output/asteroid-encounter-surfaces/registration-identity.json',JSON.stringify({frame:requireString(frame.id),camera:frame.camera,display,shape:requireRecord(closure).meshSha256,image:requireRecord(closure).imageSha256,view:'Source camera and native grid; complete composition flipped and aspect-corrected only for display'},null,2)+'\n');
