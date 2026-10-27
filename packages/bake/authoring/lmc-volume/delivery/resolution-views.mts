/** Complete reference views. Same physical model and numerical settings at each image rung. */
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {approvedScene,APPROVED_COMMIT} from './reference.mts';
import {equalScale,equalOutside,RESOLUTION_DIR} from './resolution-cameras.mts';
import {refineFields} from './refined-fields.mts';
import {earthCamera} from '../render.mts';
import {loadObservation} from '../observation.mts';
import {catalogueBasis,projectCatalogue} from '../catalogue-render.mts';
import {gradedPrediction} from '../grade.mts';
import {imageBytes} from '../report.mts';
import {normalized} from '../grade-report.mts';
import {json,rec,need} from '../inputs.mts';

export const VIEW_NAMES=['earth','face','tilt45','edge'] as const;
export interface ResolutionTile {left:number;top:number;edge:number;}
export async function resolutionView(size:128|512|1024,name:string,tile?:ResolutionTile){
 need(VIEW_NAMES.some(v=>v===name),'Unknown reference camera');const directory=RESOLUTION_DIR+`views-${size}/`;await mkdir(directory,{recursive:true});
 const stem=name+(tile?`-tile-${tile.left}-${tile.top}`:'');
 if(size>128)for(const view of VIEW_NAMES){const previous=rec(await json(RESOLUTION_DIR+`views-${size===512?128:512}/${view}.json`));need(previous.complete===true,'The smaller complete view rung must precede scale');}
 const receipt=await json(directory+stem+'.json').then(rec).catch(()=>null);let prior:Float64Array|undefined;if(receipt?.complete===true){need(receipt.size===size&&receipt.stepPc===15&&receipt.objectSubpixels===4,'Cached numerical settings differ');if(size===128&&receipt.gaussianTailSigma!==10){const bytes=await readFile(directory+stem+'.f64le');prior=new Float64Array(Uint8Array.from(bytes).buffer);}else{console.log('RESOLUTION_VIEW_REUSED '+stem);return;}}
 const started=performance.now(),{scene,cfg,amplitudes,grade}=await approvedScene(),fields=await refineFields(scene),scale=await equalScale(),small=await loadObservation(8),display={sky:small.metadata.sky.rgbLinearDisplay,commonFactor:small.metadata.normalization.commonFactor},o=await loadObservation(size===128?2:size===512?8:16,undefined,display);
 const index=VIEW_NAMES.findIndex(v=>v===name),camera=index===0?earthCamera(o.width,o.height,o.rayAt,o.pixelOf):equalOutside([0,45,90][index-1]!,size,scale.widthKpc);let mask:Uint8Array|undefined;
 const width=tile?Math.min(tile.edge,camera.width-tile.left):camera.width,height=tile?Math.min(tile.edge,camera.height-tile.top):camera.height;
 if(tile){need([tile.left,tile.top,tile.edge].every(Number.isSafeInteger)&&tile.left>=0&&tile.top>=0&&tile.edge>0&&width>0&&height>0,'Invalid resolution tile');mask=new Uint8Array(camera.width*camera.height);for(let y=tile.top;y<tile.top+height;y++)mask.fill(1,y*camera.width+tile.left,y*camera.width+tile.left+width);}
 const t=performance.now(),basis=catalogueBasis(projectCatalogue(scene,camera,.015,mask,undefined,{objectSubpixels:4,cacheFinishedDust:true,gaussianTailSigma:10}),scene,amplitudes),full=gradedPrediction(basis,grade,mask),rgb=tile?new Float64Array(width*height*3):full,renderSeconds=(performance.now()-t)/1000;
 if(tile)for(let y=0;y<height;y++)rgb.set(full.subarray(((y+tile.top)*camera.width+tile.left)*3,((y+tile.top)*camera.width+tile.left+width)*3),y*width*3);
 let maximumOptimizationDelta=0;if(prior){need(prior.length===rgb.length,'Optimization reference grid differs');for(let i=0;i<rgb.length;i++)maximumOptimizationDelta=Math.max(maximumOptimizationDelta,Math.abs(rgb[i]-prior[i]));need(maximumOptimizationDelta<1e-10,'The numerical acceleration changed reference pixels');}
 await writeFile(directory+stem+'.f64le.tmp',Buffer.from(rgb.buffer));await rename(directory+stem+'.f64le.tmp',directory+stem+'.f64le');
 await sharp(imageBytes(normalized(rgb,o),o,index===0),{raw:{width,height,channels:3}}).png().toFile(directory+stem+'.png');
 const record={complete:true,size,camera:name,width,height,tile:tile??null,widthKpc:scale.widthKpc,pcPerPixel:scale.widthKpc*1000/size,stepPc:15,objectSubpixels:4,gaussianTailSigma:10,maximumOptimizationDelta,configuration:cfg,approvedCommit:APPROVED_COMMIT,fields,grade,parametersFitted:0,renderSeconds,seconds:(performance.now()-started)/1000,maxRssBytes:process.resourceUsage().maxRSS*1024};await writeFile(directory+stem+'.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({sentinel:'RESOLUTION_VIEW_COMPLETE',camera:name,size,tile,renderSeconds,seconds:record.seconds,maxRssBytes:record.maxRssBytes,maximumOptimizationDelta}));
}
export async function resolutionSheet(size:128|512|1024){const directory=RESOLUTION_DIR+`views-${size}/`,panel=Math.max(512,size),factor=panel/512,panels=[];for(const name of VIEW_NAMES){need(rec(await json(directory+name+'.json')).complete===true,'Cannot show an incomplete view rung');panels.push(await sharp(directory+name+'.png').resize(panel,panel,{fit:'contain',background:'#000'}).png().toBuffer());}
 const labels=['Earth','Face-on','45 degrees','Edge-on'],svg=Buffer.from(`<svg width="${panel*4}" height="${panel+68*factor}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101216"/><g fill="white" font-family="Arial" font-size="${23*factor}">${labels.map((label,i)=>`<text x="${i*panel+10*factor}" y="${29*factor}">${label}</text>`).join('')}<text x="${10*factor}" y="${panel+58*factor}">Same physical image width in every panel. ${size} px reference, 15 pc ray step, 9.77 pc population cells.</text></g></svg>`);await sharp(svg).composite(panels.map((input,i)=>({input,left:i*panel,top:40*factor}))).png().toFile(directory+'sheet.png');
 if(size===1024){const photo=await readFile(RESOLUTION_DIR+'../1024/horalek.png'),header=Buffer.from('<svg width="2048" height="820" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101216"/><g fill="white" font-family="Arial" font-size="24"><text x="10" y="31">Model from Earth</text><text x="1034" y="31">Horálek · registered photograph</text></g></svg>');await sharp(header).composite([{input:await readFile(directory+'earth.png'),left:0,top:44},{input:photo,left:1024,top:44}]).png().toFile(directory+'earth-vs-horalek.png');}
 console.log('RESOLUTION_SHEET_COMPLETE '+size);}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const size=Number(process.argv[2]);need(size===128||size===512||size===1024,'Invalid model resolution rung');if(process.argv[3]==='sheet')await resolutionSheet(size);else{need(typeof process.argv[3]==='string','Choose a camera');const values=process.argv.find(v=>v.startsWith('--tile='))?.slice(7).split(',').map(Number);if(values)need(values.length===3,'Invalid tile arguments');await resolutionView(size,process.argv[3],values?{left:values[0]!,top:values[1]!,edge:values[2]!}:undefined);}}
