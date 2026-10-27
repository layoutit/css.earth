/** Real retained CSS renderer cameras shared by the MW baseline and LMC near pilot. */
import {mkdir,writeFile,symlink,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import sharp from 'sharp';
import {worldQuaternionFromRotation} from '@cssearth/engine';
import {compileGalaxySliceVolume} from '../../milky-way-dust/galaxy-slice-compile.mts';
import {galaxyNearStations} from '../../milky-way-dust/galaxy-near-cameras.mts';
import {json,rec,array,need} from '../inputs.mts';
import {FULL_DIR,NEAR_DIR} from './near-pilot.mts';
import {nearResiduals,nearAnnuli,linear,MW_NEAR_DIRECTORY} from './milky-way-near.mts';
export async function prepareNearBrowser(directory:string,bank:string,kind:'mw'|'lmc'){
 const browser=directory+'browser/',mw=kind==='mw',prefix=mw?'b30-slices':'l36-near';await mkdir(browser,{recursive:true});const prototype=await json(bank+'prototype.json'),initial=compileGalaxySliceVolume(prototype,{referenceFrame:'galaxy-pilot',epochJdTt:123,originM:[0,0,0],localToReferenceXyzw:[0,0,0,1],metersPerUnit:.001},bank,kind+'-near',mw?undefined:{record:'source/preparation/l36/fit.json',texturePrefix:prefix}),volume=mw?{...initial,mergedOpticalCopies:3}:initial;
 await writeFile(browser+'volume.json',JSON.stringify(volume));try{await symlink(resolve(bank),browser+prefix,'dir');}catch(error){if(!(error instanceof Error&&'code'in error&&error.code==='EEXIST'))throw error;}
 const poses=galaxyNearStations(128,mw?16:10,mw?[8.277,0,0]:[0,0,0]).map(({camera:c})=>({name:c.name,width:128,height:128,layout:{width:128,height:128,transform:'matrix(1,0,0,1,0,0)'},camera:{world:{referenceFrame:'galaxy-pilot',epochJdTt:123,pose:{positionM:c.eye,orientationXyzw:worldQuaternionFromRotation([c.right[0],c.up[0],c.back[0],c.right[1],c.up[1],c.back[1],c.right[2],c.up[2],c.back[2]])}},viewport:{widthPixels:128,heightPixels:128,focalPixels:c.focal,principalOffsetPixels:[0,0]}}}));
 await writeFile(browser+'poses.json',JSON.stringify(poses,null,2)+'\n');console.log('NEAR_BROWSER_INPUT_COMPLETE '+kind);
}
export async function scoreNearBrowser(directory:string,kind:'mw'|'lmc',referenceDirectory=directory){
 const completion=rec(await json(directory+'browser/browser-complete.json'));need(completion.complete===true&&completion.retained===true&&array(completion.cameras).length===20,'A started browser is not a completed near capture');const mw=kind==='mw',rows=[];
 for(const{camera,axis}of galaxyNearStations(128,mw?16:10,mw?[8.277,0,0]:[0,0,0])){const bytes=await readFile(referenceDirectory+camera.name+'-reference.f64le');need(bytes.length===128*128*3*8,'Missing physical near reference');const reference=new Float64Array(Uint8Array.from(bytes).buffer),data=await sharp(directory+'browser/captures/'+camera.name+'.png').removeAlpha().raw().toBuffer(),target={name:camera.name,axis,camera,linear:mw?Float64Array.from(reference,linear):reference,annuli:nearAnnuli(camera,mw?[8.277,0,0]:[0,0,0],mw?16:10)};rows.push(nearResiduals(Float64Array.from(data,v=>v/255),target));}
 const result={complete:true,grid:128,actualRetainedCssRenderer:true,rows};await writeFile(directory+'browser/result.json',JSON.stringify(result,null,2)+'\n');console.log('NEAR_BROWSER_SCORE_COMPLETE '+kind);return result;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const mw=process.argv[3]==='mw',directory=mw?MW_NEAR_DIRECTORY:process.argv.includes('--full')?FULL_DIR:NEAR_DIR;if(process.argv[2]==='prepare')await prepareNearBrowser(directory,mw?'src/objects/milky-way-volume/prepared/b30-slices/':directory+'bank/',mw?'mw':'lmc');else await scoreNearBrowser(directory,mw?'mw':'lmc',!mw&&process.argv.includes('--full')?NEAR_DIR:directory);}
