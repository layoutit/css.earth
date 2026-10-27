/** Prepare camera publications, then score screenshots from the renderer-owned browser test. No new model run or fit. */
import {mkdir,writeFile,symlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {worldRotationFromQuaternion,rotateWorldPosition,worldQuaternionFromRotation} from '@cssearth/engine';
import {compileGalaxySliceVolume} from '../../milky-way-dust/galaxy-slice-compile.mts';
import {galaxyResiduals} from '../../milky-way-dust/galaxy-bank-fit.mts';
import {slabReferences} from './slab-pilot.mts';
import {qualifySlabViews} from './slab-qualification.mts';
import {versionDir} from '../sequence-state.mts';
import {loadObservation} from '../observation.mts';
import {json,rec,array,need} from '../inputs.mts';
import {dot,mul,add,rayInBody,icrsToSky,skyToBody,type V3} from '../geometry.mts';

const directory=versionDir(36)+'delivery/hybrid-64/',browser=directory+'browser/';
function pose(name:string,right:V3,up:V3,back:V3,eye:V3,width:number,height:number,focal:number,offset:[number,number]=[0,0],rawHeight=height,reflect=false){
 const orientation=worldQuaternionFromRotation([right[0],up[0],back[0],right[1],up[1],back[1],right[2],up[2],back[2]]);
 return{name,width,height,layout:{width,height:rawHeight,transform:`matrix(${reflect?-1:1},0,0,${height/rawHeight},${reflect?width:0},0)`},camera:{world:{referenceFrame:'galaxy-pilot',epochJdTt:123,pose:{positionM:eye,orientationXyzw:orientation}},viewport:{widthPixels:width,heightPixels:rawHeight,focalPixels:focal,principalOffsetPixels:offset}}};
}
export async function prepareHybridBrowser(){
 await mkdir(browser,{recursive:true});
 const prototype=await json(directory+'bank/prototype.json'),volume=compileGalaxySliceVolume(prototype,{referenceFrame:'galaxy-pilot',epochJdTt:123,originM:[0,0,0],localToReferenceXyzw:[0,0,0,1],metersPerUnit:.001},directory+'bank/','hybrid-pilot',{record:'source/preparation/l36/fit.json',texturePrefix:'l36-hybrid'});
 await writeFile(browser+'volume.json',JSON.stringify(volume));
 try{await symlink(resolve(directory+'bank'),browser+'l36-hybrid','dir');}catch(error){if(!(error instanceof Error&&'code'in error&&error.code==='EEXIST'))throw error;}
 const o=await loadObservation(1),registration=o.metadata.registration,q=registration.localToReferenceXyzw,rotation=worldRotationFromQuaternion(q),toBody=(v:V3):V3=>{const p=rotateWorldPosition(rotation,v);return rayInBody([p[0],p[1],p[2]]).direction;};
 const sourceRight=toBody([1,0,0]),up=toBody([0,1,0]),sourceBack=toBody([0,0,1]),right=mul(sourceRight,-1),back=mul(sourceBack,-1),eye=rayInBody(o.rayAt(32,24)).origin;
 const origin=skyToBody(icrsToSky([registration.originM[0]/registration.metersPerUnit,registration.originM[1]/registration.metersPerUnit,registration.originM[2]/registration.metersPerUnit])),delta=add(origin,mul(eye,-1)),bounds=registration.tangentBoundsKpc;
 const span=bounds.max[0]-bounds.min[0],spanY=bounds.max[1]-bounds.min[1],cx=(bounds.max[0]+bounds.min[0])/2,cy=(bounds.max[1]+bounds.min[1])/2,scale=64/span,distance=-dot(delta,back);
 need(distance>0,'Earth observer must face the registered plane');
 // The preserved tangent raster increases x with the normal pointing away from the observer.
 // A declared 2D registration reflection and pixel-aspect transport preserve its exact pixel grid;
 // the camera itself remains right-handed. This is a test surface, never a site screenshot.
 const poses=[pose('earth',right,up,back,eye,64,48,distance*scale,[(cx-dot(delta,right))*scale,(dot(delta,up)+cy)*scale],spanY*scale,true)];
 for(const tilt of[0,22.5,45,67.5,90])for(const az of[0,90,180,270]){
  const t=tilt*Math.PI/180,a=az*Math.PI/180,rotate=([x,y,z]:V3):V3=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),z],b=rotate([0,Math.sin(t),Math.cos(t)]);
  poses.push(pose(`tilt-${tilt}-azimuth-${az}`,rotate([1,0,0]),rotate([0,Math.cos(t),-Math.sin(t)]),b,mul(b,10000),64,64,10000*64/16));
 }
 await writeFile(browser+'poses.json',JSON.stringify(poses,null,2)+'\n');
 console.log('HYBRID_BROWSER_INPUT_COMPLETE '+poses.length);
}
export async function scoreHybridBrowser(){
 const completion=rec(await json(browser+'browser-complete.json'));need(completion.complete===true&&completion.retained===true&&completion.opticalLayers===33,'Incomplete real-renderer capture');
 const targets=await slabReferences(directory,64,true),captured=array(completion.cameras);need(captured.length===21&&targets.every(t=>captured.includes(t.name)),'Browser capture omitted a camera');
 const rows=[];let sum=0;for(const target of targets){const{data,info}=await sharp(browser+'captures/'+target.name+'.png').removeAlpha().raw().toBuffer({resolveWithObject:true});need(info.width===target.camera.width&&info.height===target.camera.height&&info.channels===3,'Browser grid differs from reference');const rgb=Float64Array.from(data,v=>v/255);sum+=data.reduce((s,v)=>s+v,0);rows.push(galaxyResiduals(rgb,target));}
 need(sum>0,'Browser launched but drew no light');const qualified=qualifySlabViews(rows),result={complete:true,...qualified,physicalSlabs:26,opticalLayers:33,retained:true,rows,registration:'Earth uses the preserved tangent raster reflection and pixel aspect; outside views use perspective at 10000 body units to approximate the orthographic reference. These are renderer conformance captures, not real-site screenshots.'};
 await writeFile(browser+'result.json',JSON.stringify(result,null,2)+'\n');
 const panels=[];for(const name of['earth','tilt-0-azimuth-0','tilt-45-azimuth-0','tilt-90-azimuth-0'])for(const path of[directory+name+'-reference.png',browser+'captures/'+name+'.png'])panels.push(await sharp(path).resize(512,512,{fit:'contain',background:'#000'}).png().toBuffer());
 await sharp({create:{width:1024,height:2048,channels:3,background:'#000'}}).composite(panels.map((input,i)=>({input,left:i%2*512,top:Math.floor(i/2)*512}))).png().toFile(browser+'sheet.png');
 console.log('HYBRID_BROWSER_SCORE_COMPLETE '+JSON.stringify({passed:result.passed,cameras:result.cameras}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){if(process.argv[2]==='prepare')await prepareHybridBrowser();else{need(process.argv[2]==='score','Choose prepare or score');await scoreHybridBrowser();}}
