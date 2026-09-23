import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString } from '../sources/source-values.mts';
// Emblems are decoration: they show at 64 CSS px beside a facility render (128 px at DPR 2), and a card without a
// render scales the same file up. One small palette PNG each, about 3 KB (2.2 MB of 288 px PNGs before).
const SIZE=128;
const root=path.resolve(import.meta.dirname,'../../site/source/facilities/emblems');
const output=path.resolve(import.meta.dirname,'../../public/shell/facility-emblems');
const catalogueRoot=path.resolve(import.meta.dirname,'../../src/sources');
const historicalEvidence='site/source/machines/emblem-library.json@8d2f45b58b5ea9a0b69a81242c51aa6e6d6ebcdf';

const records=requireArray(JSON.parse(await fs.readFile(path.join(root,'source-records.json'),'utf8'))).map(value=>{const entry=requireRecord(value);return {...entry,id:requireString(entry.id),localSource:requireString(entry.localSource)};});
await fs.mkdir(output,{recursive:true});
const entries=[],layers=[];
for(const e of records){
 const index: number=entries.length;
 const catalogueId=`artwork-emblem-${e.id}`;
 const catalogue=requireRecord(JSON.parse(await fs.readFile(path.join(catalogueRoot,`${catalogueId}.json`),'utf8')));
 const sourceEvidence=requireArray(catalogue.evidence);
 if(catalogue.id!==catalogueId||!sourceEvidence.some(value=>requireRecord(value).locator===`/entries/${index}`))
  throw Error(`Emblem order no longer matches the catalogued source: ${e.id}`);
 const sourceBinding={kind:'catalogued',references:[{catalogueId,role:'artwork',evidence:`${historicalEvidence}#/entries/${index}`}]};
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
 const cropped=await sharp(data,{raw:{width,height,channels:4}}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(SIZE-4,SIZE-4,{fit:'inside'}).png().toBuffer({resolveWithObject:true});
 const png=await sharp({create:{width:SIZE,height:SIZE,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:cropped.data,left:Math.round((SIZE-cropped.info.width)/2),top:Math.round((SIZE-cropped.info.height)/2)}]).png({compressionLevel:9}).toBuffer();
 const raw=await sharp(png).raw().toBuffer();let transparent=0;for(let n=0;n<SIZE*SIZE;n++)if(!raw[n*4+3])transparent++;
 if(transparent<SIZE*SIZE*.03)throw Error('Missing actual transparency: '+e.id);
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(x===0||y===0||x===SIZE-1||y===SIZE-1)if(raw[(y*SIZE+x)*4+3]!==0)throw Error('Opaque frame edge: '+e.id);
 // The published file is the composite quantized to 128 colours. The quantizer can merge full transparency with a faint
 // colour, so every pixel transparent in the composite is set back to exact transparency and the result, at most 129
 // colours, is written as a palette PNG that keeps them exactly.
 const palette={palette:true,dither:0,compressionLevel:9,effort:10} as const;
 const quantized=await sharp(await sharp(raw,{raw:{width:SIZE,height:SIZE,channels:4}}).png({...palette,colours:128}).toBuffer()).ensureAlpha().raw().toBuffer();
 for(let n=0;n<SIZE*SIZE;n++)if(raw[n*4+3]===0)quantized.fill(0,n*4,n*4+4);
 const published=await sharp(quantized,{raw:{width:SIZE,height:SIZE,channels:4}}).png({...palette,colours:256}).toBuffer();
 const shown=await sharp(published).ensureAlpha().raw().toBuffer();
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(x===0||y===0||x===SIZE-1||y===SIZE-1)if(shown[(y*SIZE+x)*4+3]!==0)throw Error('Published emblem has an opaque frame edge: '+e.id+' at '+x+','+y);
 await fs.writeFile(path.join(output,e.id+'.png'),published);
 entries.push({id:e.id,src:'/shell/facility-emblems/'+e.id+'.png',width:SIZE,height:SIZE,bytes:published.length,source:{...e,inputBytes:input.length},preparation:{method:e.id==='juno'?'Rasterize source vector over a white circle to retain the original raster badge appearance; exterior remains transparent.':removed?'Remove only edge-connected white background; preserve original artwork RGB.':'Preserve source transparency.',removedBackgroundPixels:removed,crop:{left,top,width:right-left+1,height:bottom-top+1},outputPadding:2,transparentPixels:transparent},sourceBinding});
 const x=index%6*160,y=Math.floor(index/6)*186;
 layers.push({input:await sharp(png).resize(128,128).png().toBuffer(),left:x+16,top:y+8});
 layers.push({input:Buffer.from(`<svg width="160" height="28"><text x="8" y="18" fill="#ccc" font-family="Arial" font-size="12">${e.id}</text></svg>`),left:x,top:y+147});
 console.log(e.id,removed?'removed '+removed+' exterior pixels':'native alpha',png.length);
}
if(entries.length!==24||new Set(entries.map(e=>e.id)).size!==24)throw Error('Expected all 24');
await fs.writeFile(path.join(root,'../emblem-library.json'),JSON.stringify({schema:'cssearth-facility-emblems@3',normalBuildPolicy:'Reuse committed PNGs; preparation and acquisition are explicit maintenance only.',entries},null,2)+'\n');
if(process.argv[2])await sharp({create:{width:960,height:744,channels:3,background:'#0d0d0d'}}).composite(layers).png().toFile(path.resolve(process.argv[2]));
