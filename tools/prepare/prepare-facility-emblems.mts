import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from '../sources/source-values.mts';
const root=path.resolve(import.meta.dirname,'../../site/source/facilities/emblems');
const output=path.resolve(import.meta.dirname,'../../public/shell/facility-emblems');

const records=requireArray(JSON.parse(await fs.readFile(path.join(root,'source-records.json'),'utf8'))).map(value=>{const entry=requireRecord(value);return {...entry,id:requireString(entry.id),localSource:requireString(entry.localSource)};});
await fs.mkdir(output,{recursive:true});
const entries=[],layers=[];
for(const e of records){
 const input=await fs.readFile(path.join(root,e.localSource));
 // Juno's vector uses negative space for the white features shown in the raster
 // insignia. Retain that white inside the circular badge, with no outer square.
 const renderInput=e.id==='juno'?Buffer.from(input.toString().replace('<path','<circle cx="513.75" cy="513.75" r="498.5" fill="white"/><path')):input;
 const {data,info}=await sharp(renderInput).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const original=Buffer.from(data),{width,height}=info;
 if(info.channels!==4)throw Error('Expected RGBA: '+e.id);
 const corners=[0,width-1,(height-1)*width,width*height-1];
 const white=(n: number)=>Math.min(data[n*4],data[n*4+1],data[n*4+2])>=225&&Math.max(data[n*4],data[n*4+1],data[n*4+2])-Math.min(data[n*4],data[n*4+1],data[n*4+2])<=30;
 const opaqueWhite=corners.some(n=>data[n*4+3]>240&&white(n));
 let removed=0;
 if(opaqueWhite){
  const seen=new Uint8Array(width*height),queue=new Int32Array(width*height);let head=0,tail=0;
  const push=(n: number)=>{if(!seen[n]&&(data[n*4+3]<=8||white(n))){seen[n]=1;queue[tail++]=n;}};
  for(let x=0;x<width;x++){push(x);push((height-1)*width+x);}
  for(let y=0;y<height;y++){push(y*width);push(y*width+width-1);}
  while(head<tail){const n=queue[head++],x=n%width,y=Math.floor(n/width);if(data[n*4+3])removed++;data[n*4+3]=0;if(x)push(n-1);if(x+1<width)push(n+1);if(y)push(n-width);if(y+1<height)push(n+width);}
 }
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const n=(y*width+x)*4;
  if(data[n]!==original[n]||data[n+1]!==original[n+1]||data[n+2]!==original[n+2])throw Error('Artwork RGB changed: '+e.id);
  if(data[n+3]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 }
 if(right<left)throw Error('Empty emblem: '+e.id);
 const cropped=await sharp(data,{raw:{width,height,channels:4}}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(284,284,{fit:'inside'}).png().toBuffer({resolveWithObject:true});
 const png=await sharp({create:{width:288,height:288,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:cropped.data,left:Math.round((288-cropped.info.width)/2),top:Math.round((288-cropped.info.height)/2)}]).png({compressionLevel:9}).toBuffer();
 const raw=await sharp(png).raw().toBuffer();let transparent=0;for(let n=0;n<288*288;n++)if(!raw[n*4+3])transparent++;
 if(transparent<288*288*.03)throw Error('Missing actual transparency: '+e.id);
 for(let y=0;y<288;y++)for(let x=0;x<288;x++)if(x===0||y===0||x===287||y===287)if(raw[(y*288+x)*4+3]!==0)throw Error('Opaque frame edge: '+e.id);
 await fs.writeFile(path.join(output,e.id+'.png'),png);
 entries.push({id:e.id,src:'/shell/facility-emblems/'+e.id+'.png',width:288,height:288,bytes:png.length,source:{...e,inputBytes:input.length},preparation:{method:e.id==='juno'?'Rasterize source vector over a white circle to retain the original raster badge appearance; exterior remains transparent.':removed?'Remove only edge-connected white background; preserve original artwork RGB.':'Preserve source transparency.',removedBackgroundPixels:removed,crop:{left,top,width:right-left+1,height:bottom-top+1},outputPadding:2,transparentPixels:transparent}});
 const index=entries.length-1,x=index%6*160,y=Math.floor(index/6)*186;
 layers.push({input:await sharp(png).resize(128,128).png().toBuffer(),left:x+16,top:y+8});
 layers.push({input:Buffer.from(`<svg width="160" height="28"><text x="8" y="18" fill="#ccc" font-family="Arial" font-size="12">${e.id}</text></svg>`),left:x,top:y+147});
 console.log(e.id,removed?'removed '+removed+' exterior pixels':'native alpha',png.length);
}
if(entries.length!==24||new Set(entries.map(e=>e.id)).size!==24)throw Error('Expected all 24');
await fs.writeFile(path.join(root,'../emblem-library.json'),JSON.stringify({schema:'cssearth-facility-emblems@1',normalBuildPolicy:'Reuse committed PNGs; preparation and acquisition are explicit maintenance only.',entries},null,2)+'\n');
if(process.argv[2])await sharp({create:{width:960,height:744,channels:3,background:'#0d0d0d'}}).composite(layers).png().toFile(path.resolve(process.argv[2]));
