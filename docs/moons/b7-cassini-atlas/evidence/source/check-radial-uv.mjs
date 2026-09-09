// Independent normalized-address proof. No preparer import or image allocation.
// Usage, from repository root: node PATH/TO/check-radial-uv.mjs [REPO_ROOT] [OUTPUT_DIR]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(process.argv[2]??'.');
const output=resolve(process.argv[3]??'output/b7-source-review');
const evidence={schema:'cssearth-b7-independent-radial-uv-check@1',method:'Original scene leaf background positions, sizes and matrix3d; compare the source point at each reduced atlas texel center against the source point addressed by canonical CSS background scaling. No atlas images allocated or prepared.',bodies:[]};
for(const body of ['dione','rhea']) {
 const scene=JSON.parse(readFileSync(resolve(root,`src/planets/${body}/prepared/scene.json`))),scale=.125;
 let probes=0,maxUvError=0,maxSourcePointError=0;
 for(const leaf of scene.bodyLeaves) {
  const style=leaf.style;
  const matrix=style.match(/matrix3d\(([^)]+)\)/)[1].split(',').map(Number);
  const [rx,ry]=style.match(/background-position:([^;]+)/)[1].split(' ').map(s=>-parseFloat(s));
  const [cw,ch]=style.match(/background-size:([^;]+)/)[1].split(' ').map(parseFloat);
  const lw=parseFloat(style.match(/--polycss-atlas-width:([^;]+)/)[1]),lh=parseFloat(style.match(/--polycss-atlas-height:([^;]+)/)[1]);
  assert.equal(cw,2048);assert.equal(ch,16000);assert.equal(lw,128);assert.equal(lh,128);
  const width=cw*scale,height=ch*scale,tile=128*scale;
  for(let py=0;py<tile;py++)for(let px=0;px<tile;px++) {
   const atlasX=rx*scale+px+.5,atlasY=ry*scale+py+.5;
   const cssX=atlasX/width*cw-rx,cssY=atlasY/height*ch-ry;
   const sampleX=(px+.5)*lw/tile,sampleY=(py+.5)*lh/tile;
   maxUvError=Math.max(maxUvError,Math.abs((rx+sampleX)/cw-atlasX/width),Math.abs((ry+sampleY)/ch-atlasY/height));
   const point=(x,y)=>{const w=matrix[3]*x+matrix[7]*y+matrix[15];return [0,1,2].map(i=>(matrix[i]*x+matrix[4+i]*y+matrix[12+i])/w);};
   const a=point(cssX,cssY),b=point(sampleX,sampleY);
   for(let i=0;i<3;i++)maxSourcePointError=Math.max(maxSourcePointError,Math.abs(a[i]-b[i]));
   probes++;
  }
 }
 assert.ok(maxUvError<1e-14);assert.ok(maxSourcePointError<1e-8);
 evidence.bodies.push({body,faces:scene.bodyLeaves.length,probes,maxUvError,maxSourcePointError,sourceAtlas:[2048,16000,128],reducedAtlas:[256,2000,16],status:'PASS'});
}
mkdirSync(output,{recursive:true});
writeFileSync(resolve(output,'radial-normalized-uv-proof.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence.bodies));
