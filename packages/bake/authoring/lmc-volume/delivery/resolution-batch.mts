/** Bounded worker queue. Tiles keep the full camera so object normalization and pixel phase never change. */
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {resolutionSheet,VIEW_NAMES} from './resolution-views.mts';
import {RESOLUTION_DIR} from './resolution-cameras.mts';
import {json,rec,num,need} from '../inputs.mts';
import {approvedResolutionIdentity,requireResolutionTile} from './resolution-provenance.mts';
export async function resolutionBatch(size:512|1024){
 const identity=approvedResolutionIdentity(),validate=(value:unknown,job:{name:string;left:number;top:number})=>requireResolutionTile(value,{size,camera:job.name,left:job.left,top:job.top,...identity});
 const directory=RESOLUTION_DIR+`views-${size}/`,edge=128,jobs=VIEW_NAMES.flatMap(name=>Array.from({length:Math.ceil((name==='earth'?size*3/4:size)/edge)},(_,y)=>Array.from({length:size/edge},(_,x)=>({name,left:x*edge,top:y*edge}))).flat()),started=performance.now(),active=new Set<ReturnType<typeof spawn>>();let next=0,failed=false;
 const worker=async()=>{while(next<jobs.length&&!failed){const job=jobs[next++]!,stem=job.name+`-tile-${job.left}-${job.top}`,previous=await json(directory+stem+'.json').then(rec).catch(error=>{if(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT')return null;throw error;});if(previous?.complete===true){validate(previous,job);need((await readFile(directory+stem+'.f64le')).length===128*128*3*8,'Incomplete cached tile pixels');continue;}
  try{await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['--max-old-space-size=8192',fileURLToPath(new URL('./resolution-views.mts',import.meta.url)),String(size),job.name,`--tile=${job.left},${job.top},${edge}`],{stdio:['ignore','pipe','pipe']});active.add(child);let out='',err='';child.stdout?.on('data',b=>out+=String(b));child.stderr?.on('data',b=>err+=String(b));const timer=setTimeout(()=>child.kill('SIGTERM'),600_000);child.once('error',error=>{active.delete(child);clearTimeout(timer);reject(error);});child.once('close',code=>{active.delete(child);clearTimeout(timer);if(code!==0||!out.includes('RESOLUTION_VIEW_COMPLETE'))reject(new Error('Resolution tile failed: '+stem+' '+err+' '+out));else resolve();});});}catch(error){failed=true;for(const child of active)child.kill('SIGTERM');throw error;}
  const checked=rec(await json(directory+stem+'.json'));validate(checked,job);console.log(JSON.stringify({sentinel:'RESOLUTION_TILE_COMPLETE',size,...job,seconds:checked.seconds,rss:checked.maxRssBytes}));
 }};
 const settled=await Promise.allSettled(Array.from({length:6},worker));for(const result of settled)if(result.status==='rejected')throw result.reason;
 for(const name of VIEW_NAMES){const width=size,height=name==='earth'?size*3/4:size,rgb=new Float64Array(width*height*3),parts=jobs.filter(j=>j.name===name),pngs=[];let seconds=0,template:Record<string,unknown>|undefined;
  for(const tile of parts){const stem=name+`-tile-${tile.left}-${tile.top}`,metadata=rec(await json(directory+stem+'.json')),bytes=await readFile(directory+stem+'.f64le');validate(metadata,tile);need(bytes.length===num(metadata.width)*num(metadata.height)*3*8,'Incomplete resolution tile bytes');const values=new Float64Array(Uint8Array.from(bytes).buffer),w=num(metadata.width),h=num(metadata.height);for(let y=0;y<h;y++)rgb.set(values.subarray(y*w*3,(y+1)*w*3),((tile.top+y)*width+tile.left)*3);pngs.push({input:await readFile(directory+stem+'.png'),left:tile.left,top:tile.top});seconds+=num(metadata.renderSeconds);template=metadata;}
  await writeFile(directory+name+'.f64le',Buffer.from(rgb.buffer));await sharp({create:{width,height,channels:3,background:'#000'}}).composite(pngs).png().toFile(directory+name+'.png');await writeFile(directory+name+'.json',JSON.stringify({...template,complete:true,width,height,tile:null,tiles:parts.length,renderSeconds:seconds,batchWallSeconds:(performance.now()-started)/1000},null,2)+'\n');
 }
 await resolutionSheet(size);console.log(JSON.stringify({sentinel:'RESOLUTION_BATCH_COMPLETE',size,tiles:jobs.length,seconds:(performance.now()-started)/1000}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const size=Number(process.argv[2]);need(size===512||size===1024,'Choose small or native resolution');await resolutionBatch(size);}
