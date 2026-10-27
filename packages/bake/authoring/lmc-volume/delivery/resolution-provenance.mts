/** Validate each checkpoint, rather than trusting metadata copied from the final tile. */
import {isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {rec,num,json,need} from '../inputs.mts';
import {readGrade} from '../grade.mts';
import {loadObservation} from '../observation.mts';
import {imageBytes} from '../report.mts';
import {normalized} from '../grade-report.mts';
import {APPROVED_COMMIT,approvedTag} from './reference.mts';
import {RESOLUTION_DIR} from './resolution-cameras.mts';
import {VIEW_NAMES} from './resolution-views.mts';
export function requireResolutionTile(value:unknown,expected:{size:number;camera:string;left:number;top:number;configuration:unknown;grade:unknown}){
 const r=rec(value),f=rec(r.fields),tile=rec(r.tile);need(r.complete===true&&r.approvedCommit===APPROVED_COMMIT&&r.size===expected.size&&r.camera===expected.camera&&r.width===128&&r.height===128&&tile.left===expected.left&&tile.top===expected.top&&tile.edge===128&&r.stepPc===15&&r.objectSubpixels===4&&r.parametersFitted===0&&f.n===2048&&f.halfKpc===10&&f.oldSigmaPc===100&&f.youngSigmaPc===45,'A tile does not have the approved numerical provenance');
 need(isDeepStrictEqual(r.configuration,expected.configuration)&&isDeepStrictEqual({...readGrade(r.grade),score:0},{...readGrade(expected.grade),score:0}),'A checkpoint changed the approved physical configuration or grade');
 need(r.gaussianTailSigma===undefined||r.gaussianTailSigma===10,'An unqualified Gaussian approximation appears in the checkpoints');return r.gaussianTailSigma===10?'ten-sigma':'uncut';
}
export function approvedResolutionIdentity(){
 approvedTag();const pinned=(name:string)=>rec(JSON.parse(execFileSync('git',['show',APPROVED_COMMIT+':src/objects/lmc-volume/source/preparation/l36/'+name+'.json'],{encoding:'utf8'})));return{configuration:pinned('recipe').configuration,grade:pinned('fit').grade};
}
export async function verifyResolutionProvenance(){
 const{configuration,grade}=approvedResolutionIdentity(),variants:Record<string,number>={};let tiles=0,maximumAbsoluteDifference=0;
 // The resumed 512 rung includes both numerically equivalent paths. Their equivalence
 // is independently recorded on all four complete 128 px reference frames.
 for(const name of VIEW_NAMES){const replay=rec(await json(RESOLUTION_DIR+'views-128/'+name+'.json'));need(replay.gaussianTailSigma===10&&num(replay.maximumOptimizationDelta)<1e-10,'The optimized/unoptimized equivalence replay is missing');maximumAbsoluteDifference=Math.max(maximumAbsoluteDifference,num(replay.maximumOptimizationDelta));}
 const small=await loadObservation(8),display={sky:small.metadata.sky.rgbLinearDisplay,commonFactor:small.metadata.normalization.commonFactor};
 for(const size of[512,1024] as const)for(const camera of VIEW_NAMES){const directory=RESOLUTION_DIR+`views-${size}/`,height=camera==='earth'?size*3/4:size;
  for(let top=0;top<height;top+=128)for(let left=0;left<size;left+=128){const stem=camera+`-tile-${left}-${top}`,r=await json(directory+stem+'.json'),variant=requireResolutionTile(r,{size,camera,left,top,configuration,grade});variants[variant]=(variants[variant]??0)+1;need((await readFile(directory+stem+'.f64le')).length===128*128*3*8,'A tile has a receipt but lacks complete float pixels');tiles++;}
  const bytes=await readFile(directory+camera+'.f64le');need(bytes.length===size*height*3*8,'The joined float image is incomplete');const rgb=new Float64Array(Uint8Array.from(bytes).buffer),o=size===512?small:await loadObservation(16,undefined,display),expected=imageBytes(normalized(rgb,o),o,camera==='earth'),actual=await sharp(directory+camera+'.png').removeAlpha().raw().toBuffer();need(actual.equals(expected),`Tile-local color/display differs from whole-image encoding: ${size} ${camera}`);
 }
 const result={complete:true,tiles,variants,physicalConfigurationAndGradeMatchApproved:true,joinedPngsMatchWholeFloatEncoding:true,optimizedAndUnoptimizedReplayMaximumAbsoluteDifference:maximumAbsoluteDifference};await writeFile(RESOLUTION_DIR+'provenance-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sentinel:'RESOLUTION_PROVENANCE_PASS',...result}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await verifyResolutionProvenance();
