/** Prepare the existing PolyCSS surface owner once; the portable page only moves retained DOM. */
import { readFile,writeFile,mkdir,rm,rmdir,rename } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { requireRecord,requireArray,requireFiniteNumber } from '../../source-values.mts';
import { parseBodyMapProduct } from '../body-map-product.mts';
import { assertBodyMapPlanes } from '../body-map-publication.mts';
import { writeProductRecord } from '../product-record.mts';
import { sha256 } from '../../../src/platform/sha256.mts';
import { verifiedProduct,localOutput } from './projection.mts';

const root=resolve(import.meta.dirname,'../../..');
const PREPARE=String.raw`
import {createSurfacePatches} from './packages/objects/src/geometry/surface.ts';
import {computeTextureAtlasPlanPublic,resolvePolyTextureLeafGeometry} from '@layoutit/polycss';
import {rendererPolygon} from './src/renderers/css/preparation/scene/projector.ts';
import {fitProjectiveTextureGeometryToStableLayout,prepareProjectiveTextureLayer} from './src/renderers/css/preparation/scene/projective.ts';
export function prepare(texture,poles,width,height,radii){
 const radius=radii[0],surface={radius,polarRadius:radius,latitudeSegments:36,longitudeSegments:72,surface:{url:texture,width,height},surfaceLatitudeHeight:height,packedBandGutter:0,poles:{url:poles,width:256,height:128},polarTileSize:128,polarRadiusScale:1,polarOffset:0,uv:'cell',color:'#333941'};
 return createSurfacePatches(surface).map((patch,index)=>{
  // Body-map texture latitude is planetocentric. Preserve that ray on the actual
  // triaxial reference ellipsoid rather than interpreting it as parametric latitude.
  patch.vertices=patch.vertices.map(v=>{const length=Math.hypot(...v),n=v.map(x=>x/length),r=1/Math.sqrt(n.reduce((s,x,i)=>s+(x/radii[i])**2,0));return n.map(x=>x*r);});
  // A cropped image is addressed by vertex order in PolyCSS. UV changes alone
  // do not reorder its source rectangle: PNG top-left must be north-west.
  if(!patch.pole){patch.vertices=[patch.vertices[3],patch.vertices[2],patch.vertices[1],patch.vertices[0]];patch.uvs=[[0,0],[1,0],[1,1],[0,1]];}
  const plan=computeTextureAtlasPlanPublic(rendererPolygon(patch),index,{tileSize:240/radius,layerElevation:240/radius,seamBleed:0,textureLighting:'baked'});
  const raw=plan&&resolvePolyTextureLeafGeometry(plan,{backend:'image',lighting:'source',projection:'projective'});
  if(!raw)throw Error('Surface patch cannot be projected');const g=fitProjectiveTextureGeometryToStableLayout(raw);
  return {tag:'s',style:'transform:matrix3d('+g.matrix+');--polycss-atlas-width:'+g.leafWidth+'px;--polycss-atlas-height:'+g.leafHeight+'px;background-image:url('+g.url+');background-position:'+g.backgroundPosition.map(n=>n+'px').join(' ')+';background-size:'+g.backgroundSize.map(n=>n+'px').join(' ')+(patch.pole?';backface-visibility:visible':''),projectiveTextureLayer:prepareProjectiveTextureLayer(g.matrix,1)};
 });
}
`;
export function sphereViewTransform(longitude:number,latitude:number):string {return `rotateX(${90-latitude}deg) rotateZ(${longitude}deg)`;}
const RUNTIME=String.raw`
import {createPreparedProjectiveTextureLeaf} from './src/renderers/css/rendering/prepared-projective-texture-leaf.ts';
const data=JSON.parse(document.getElementById('prepared').textContent),body=document.getElementById('body'),view=document.getElementById('view');
for(const leaf of data.leaves)body.append(createPreparedProjectiveTextureLeaf(leaf));
let longitude=data.longitude,latitude=data.latitude,zoom=1,held=null;
function draw(){body.style.transform=sphereViewTransform(longitude,latitude);view.style.transform='scale('+zoom+')';document.getElementById('position').textContent=latitude.toFixed(1)+'° latitude · '+((longitude%360+360)%360).toFixed(1)+'° E';}
document.getElementById('stage').addEventListener('pointerdown',e=>{held=[e.clientX,e.clientY];e.currentTarget.setPointerCapture(e.pointerId);});
document.getElementById('stage').addEventListener('pointermove',e=>{if(!held)return;longitude+=(e.clientX-held[0])*.3;latitude=Math.max(-90,Math.min(90,latitude+(e.clientY-held[1])*.3));held=[e.clientX,e.clientY];draw();});
document.getElementById('stage').addEventListener('pointerup',()=>held=null);
document.getElementById('stage').addEventListener('pointercancel',()=>held=null);
document.getElementById('stage').addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.3,Math.min(2.5,zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
document.getElementById('reset').onclick=()=>{longitude=data.longitude;latitude=data.latitude;zoom=1;draw();};
document.getElementById('stage').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();longitude+=e.key==='ArrowLeft'?-5:e.key==='ArrowRight'?5:0;latitude=Math.max(-90,Math.min(90,latitude+(e.key==='ArrowUp'?5:e.key==='ArrowDown'?-5:0)));draw();});draw();
`;
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export async function exportSphere(recordPath:string,outputDirectory:string){
  const source=await verifiedProduct(recordPath);
  if(source.record.stage!=='body-map')throw new TypeError('Sphere export requires a registered body-map product; native pixels have no surface coordinates');
  for(const name of ['map.fits','map.fits.body-map.json','texture.png','poles.png','navigation.json'])if(!source.record.outputs.some(o=>o.path===name))throw new Error(`Body map has no prepared ${name}; run telescope project first`);
  const map=parseBodyMapProduct(JSON.parse(await readFile(localOutput(source.root,'map.fits.body-map.json'),'utf8'))),plane=await readFile(localOutput(source.root,map.planes.file));
  if(sha256(plane)!==map.planes.sha256)throw new Error('Map plane digest differs from its metadata');assertBodyMapPlanes(plane,map);
  const nav=requireRecord(JSON.parse(await readFile(localOutput(source.root,'navigation.json'),'utf8'))),radii=requireArray(nav.radiiKm).map(n=>requireFiniteNumber(n));
  if(radii.length!==3||radii.some(n=>n<=0)||radii[0]!==map.frame.radiusKm)throw new Error('Body dimensions disagree with navigation');
  const png=async(name:string)=>'data:image/png;base64,'+(await readFile(localOutput(source.root,name))).toString('base64');
  const compiled=await build({stdin:{contents:PREPARE,resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',metafile:true});
  const owner=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
  // Keep one embedded copy of each texture. Prepared leaves refer to CSS variables.
  const leaves=owner.prepare('SURFACE_TEXTURE','POLE_TEXTURE',map.grid.width,map.grid.height,radii).map((leaf:{style:string})=>({...leaf,style:leaf.style.replaceAll('url(SURFACE_TEXTURE)','var(--surface)').replaceAll('url(POLE_TEXTURE)','var(--poles)')}));
  const runtime=await build({stdin:{contents:'const sphereViewTransform='+sphereViewTransform.toString()+';\n'+RUNTIME,resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'browser',format:'iife',metafile:true,minify:true});
  const norm=requireRecord(nav.normalization),satisfaction=requireRecord(nav.sourceSatisfaction);
  const metadata={target:map.frame.body,radiiKm:radii,shape:nav.shape,grid:map.grid,units:map.definition.units,normalization:norm,registration:nav.registration,sourceSatisfaction:satisfaction,uncertainty:nav.uncertainty,mapSha256:map.planes.sha256};
  const data=JSON.stringify({leaves,longitude:(360-map.observations[0].subObserver.westLongitudeDegrees)%360,latitude:map.observations[0].subObserver.latitudeDegrees,metadata}).replaceAll('<','\\u003c');
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(map.frame.body)} — telescope map</title><style>
  :root{color-scheme:dark;font:14px system-ui;background:#181b1f;color:#d5d7dc}body{margin:0}main{max-width:960px;margin:auto;padding:24px}h1{font-size:20px;font-weight:500}p{line-height:1.5;color:#b8bbc4}button{font:inherit;color:inherit;background:#252a31;border:1px solid #626770;border-radius:4px;padding:6px 12px}#stage{height:min(65vh,600px);position:relative;touch-action:none;overflow:hidden;cursor:grab}#view{position:absolute;left:50%;top:50%;transform-style:preserve-3d}#body{position:absolute;transform-style:preserve-3d;--surface:url(${await png('texture.png')});--poles:url(${await png('poles.png')})}s{display:block;position:absolute;left:0;top:0;width:var(--polycss-atlas-width);height:var(--polycss-atlas-height);transform-origin:0 0;backface-visibility:hidden;text-decoration:none}details{margin-top:20px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}#position{margin-left:12px;font-variant-numeric:tabular-nums}</style>
  <main><h1>${escape(map.frame.body)} · surface measurement</h1><p>${escape(map.definition.quantity)} (${escape(map.definition.units)})<br>Reference radii: ${radii.map(n=>n.toLocaleString('en-US')).join(' × ')} km. View fitted to window; drag or use arrow keys to rotate, scroll to zoom.</p>
  <div id="stage" tabindex="0" role="img" aria-label="Interactive mapped reference ellipsoid"><div id="view"><div id="body"></div></div></div><button id="reset">Reset view</button><span id="position"></span>
  <p>Viridis scale: ${Number(norm.minimum).toPrecision(4)}–${Number(norm.maximum).toPrecision(4)} ${escape(map.definition.units)}. Grey: unobserved. No synthetic fill or relighting.<br>Source request: ${escape(String(satisfaction.status))}. Surface publication has not been evaluated. Registration: ${escape(JSON.stringify(nav.registration))}. Achieved beam resolution remains unqualified by this projection.</p>
  <details><summary>Measurement and geometry</summary><pre>${escape(JSON.stringify(metadata,null,2))}</pre></details></main><script id="prepared" type="application/json">${data}</script><script>${runtime.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></html>`;
  const destination=resolve(outputDirectory),staging=`${destination}.${randomUUID()}.partial`;await mkdir(dirname(destination),{recursive:true});await mkdir(destination);await mkdir(staging);
  try{
    await writeFile(resolve(staging,'sphere.html'),html);
    const fresh=await verifiedProduct(source.file);if(fresh.pin.sha256!==source.pin.sha256)throw new Error('Body map changed during sphere preparation');
    const files=[...new Set([...Object.keys(compiled.metafile.inputs),...Object.keys(runtime.metafile.inputs)])].filter(p=>p!=='<stdin>');
    const implementation=sha256(Buffer.concat([await readFile(new URL('sphere.mts',import.meta.url)),...await Promise.all(files.sort().map(path=>readFile(resolve(root,path))))]));
    await writeProductRecord(resolve(staging,'sphere.product.json'),{telescope:source.record.telescope,stage:'telescope-sphere',inputs:[{role:'body-map record',identity:source.file,...source.pin},...source.record.outputs.map(o=>({role:'body-map output',identity:localOutput(source.root,o.path),sha256:o.sha256,bytes:o.bytes}))],parameters:metadata,software:[{name:'cssEarth / PolyCSS prepared sphere',version:implementation}]},[{path:'sphere.html',file:resolve(staging,'sphere.html')}]);
    await rmdir(destination);await rename(staging,destination);
    return {directory:destination,html:resolve(destination,'sphere.html'),receipt:resolve(destination,'sphere.product.json')};
  }catch(error){await rm(staging,{recursive:true,force:true});await rmdir(destination).catch(()=>{});throw error;}
}
