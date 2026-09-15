/** Deterministic offline extraction of extended astronomical emission from a photographed star field. */
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';

export interface ExtractionOptions {
  inputPath: string;
  outputDirectory: string;
  id?: string;
  maxPixels?: number | null;
  /** Opt-in native extraction can omit the two large compact-source output banks. */
  outputMode?: 'all' | 'diffuse-only';
  medianSize?: number;
  supportPixels?: number;
  thresholdSigma?: number;
  bridgeFraction?: number;
  softEdgeFraction?: number;
}

export interface ExtractionReceipt {
  schema: 'cssearth-nebula-extraction-lab@1'; id: string; width: number; height: number;
  skyRgb: [number,number,number]; threshold: number; supportFraction: number;
  outputs: { cutout: string; diffuse: string; residual: string; mask: string; comparison: string };
  method: string; limitations: string[];
}
export interface NativeExtractionReceipt extends Omit<ExtractionReceipt, 'outputs'> {
  outputs: { diffuse: string; mask: string; comparison: string; cutout?: string; residual?: string };
  outputHashes: Record<string,string>;
  options: { maxPixels: null; medianSize: number; outputMode: 'all' | 'diffuse-only'; supportPixels: number;
    thresholdSigma: number; bridgeFraction: number; softEdgeFraction: number };
  source: { path: string; sha256: string; bytes: number; depth: string; width: number; height: number };
  processing: { nativeResolution: true; medianSize: number; outputMode: 'all' | 'diffuse-only';
    borderStatistic: string; elapsedSeconds: number; maximumResidentBytes: number };
}

const clamp=(v:number,lo=0,hi=255)=>Math.max(lo,Math.min(hi,v));
const quantile=(values:number[],q:number)=>{values.sort((a,b)=>a-b);return values[Math.min(values.length-1,Math.max(0,Math.floor(q*(values.length-1))))]??0;};
const luminance=(r:number,g:number,b:number)=>.2126*r+.7152*g+.0722*b;

function connectedFromSeed(mask:Uint8Array,seed:Uint8Array,width:number,height:number):Uint8Array {
  const out=new Uint8Array(mask.length),queue:number[]=[];for(let p=0;p<mask.length;p++)if(seed[p]&&mask[p]){out[p]=255;queue.push(p);}
  for(let head=0;head<queue.length;head++){const p=queue[head],x=p%width,y=Math.floor(p/width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const n=ny*width+nx;if(mask[n]&&!out[n]){out[n]=255;queue.push(n);}}}
  return out;
}
function strongestInteriorComponent(mask:Uint8Array,signal:Uint8Array,width:number,height:number):Uint8Array {
  const seen=new Uint8Array(mask.length);let best:number[]=[],bestScore=-1;
  for(let start=0;start<mask.length;start++){if(!mask[start]||seen[start])continue;const queue=[start];seen[start]=1;let score=0,touchesBorder=false;for(let head=0;head<queue.length;head++){const p=queue[head],x=p%width,y=Math.floor(p/width);score+=signal[p];touchesBorder||=x===0||y===0||x===width-1||y===height-1;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const n=ny*width+nx;if(mask[n]&&!seen[n]){seen[n]=1;queue.push(n);}}}score*=touchesBorder?.05:1;if(score>bestScore){bestScore=score;best=queue;}}
  const out=new Uint8Array(mask.length);for(const p of best)out[p]=255;return out;
}

export function extractExtendedSource(options:ExtractionOptions & {maxPixels:null}):Promise<NativeExtractionReceipt>;
export function extractExtendedSource(options:ExtractionOptions & {maxPixels?:number}):Promise<ExtractionReceipt>;
export function extractExtendedSource(options:ExtractionOptions):Promise<ExtractionReceipt|NativeExtractionReceipt>;
export async function extractExtendedSource(options:ExtractionOptions):Promise<ExtractionReceipt|NativeExtractionReceipt>{
  if(options.maxPixels===null){const {extractNativeSource}=await import('./native-extraction.ts');return extractNativeSource(options,createSupportMask);}
  if(options.outputMode==='diffuse-only')throw new TypeError('diffuse-only output requires maxPixels:null.');
  const id=options.id??basename(options.inputPath).replace(/\.[^.]+$/,''),maxPixels=options.maxPixels??1800,medianSize=options.medianSize??9;
  if(!Number.isInteger(medianSize)||medianSize<3||medianSize%2!==1)throw new TypeError('medianSize must be an odd integer of at least three.');
  const decoded=await sharp(options.inputPath).rotate().resize({width:maxPixels,height:maxPixels,fit:'inside',withoutEnlargement:true}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true}),{width,height}=decoded.info,rgb=decoded.data;
  const border:[number[],number[],number[]]=[[],[],[]],band=Math.max(2,Math.round(Math.min(width,height)*.08));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(x<band||y<band||x>=width-band||y>=height-band){const i=3*(y*width+x);for(let c=0;c<3;c++)border[c].push(rgb[i+c]);}
  const sky=border.map(v=>quantile(v,.35)) as [number,number,number];
  const median=(await sharp(rgb,{raw:{width,height,channels:3}}).median(medianSize).raw().toBuffer()),extendedLuma=Buffer.alloc(width*height),borderSignal:number[]=[];
  for(let p=0;p<width*height;p++){const i=3*p,v=clamp(luminance(median[i]-sky[0],median[i+1]-sky[1],median[i+2]-sky[2]));extendedLuma[p]=Math.round(v);const x=p%width,y=Math.floor(p/width);if(x<band||y<band||x>=width-band||y>=height-band)borderSignal.push(v);}
  const baseline=quantile([...borderSignal],.5),mad=quantile(borderSignal.map(v=>Math.abs(v-baseline)),.5),threshold=baseline+(options.thresholdSigma??6)*Math.max(1,1.4826*mad);
  const mask=await createSupportMask(extendedLuma,width,height,threshold,options);
  const cutout=Buffer.alloc(width*height*4),diffuse=Buffer.alloc(width*height*4),residual=Buffer.alloc(width*height*4);let supportSum=0;
  for(let p=0;p<width*height;p++){const si=3*p,di=4*p,support=mask[p]/255;supportSum+=support;let maxSignal=0,maxDiffuse=0;
    let maxResidual=0;for(let c=0;c<3;c++){const source=Math.max(0,rgb[si+c]-sky[c]),smooth=Math.max(0,median[si+c]-sky[c]),compact=Math.max(0,source-smooth);cutout[di+c]=source;diffuse[di+c]=smooth;residual[di+c]=compact;maxSignal=Math.max(maxSignal,source);maxDiffuse=Math.max(maxDiffuse,smooth);maxResidual=Math.max(maxResidual,compact);}
    for(let c=0;c<3;c++){cutout[di+c]=maxSignal?Math.round(255*cutout[di+c]/maxSignal):0;diffuse[di+c]=maxDiffuse?Math.round(255*diffuse[di+c]/maxDiffuse):0;residual[di+c]=maxResidual?Math.round(255*residual[di+c]/maxResidual):0;}
    cutout[di+3]=Math.round(support*maxSignal);diffuse[di+3]=Math.round(support*maxDiffuse);residual[di+3]=Math.round(support*maxResidual);
  }
  await mkdir(options.outputDirectory,{recursive:true});const name=(suffix:string)=>`${id}-${suffix}.png`,write=async(data:Buffer,file:string)=>sharp(data,{raw:{width,height,channels:4}}).png().toFile(resolve(options.outputDirectory,file));
  const files={cutout:name('cutout'),diffuse:name('diffuse'),residual:name('residual'),mask:name('mask'),comparison:name('comparison')};await Promise.all([write(cutout,files.cutout),write(diffuse,files.diffuse),write(residual,files.residual),sharp(mask,{raw:{width,height,channels:1}}).png().toFile(resolve(options.outputDirectory,files.mask))]);
  const panelWidth=480,panelHeight=Math.round(height*panelWidth/width),panel=async(input:string)=>sharp(input).resize(panelWidth,panelHeight).flatten({background:'#05070b'}).png().toBuffer(),maskPanel=await sharp(mask,{raw:{width,height,channels:1}}).resize(panelWidth,panelHeight).toColourspace('b-w').png().toBuffer();
  await sharp({create:{width:panelWidth*5,height:panelHeight,channels:3,background:'#05070b'}}).composite([{input:await sharp(rgb,{raw:{width,height,channels:3}}).resize(panelWidth,panelHeight).png().toBuffer(),left:0,top:0},{input:await panel(resolve(options.outputDirectory,files.diffuse)),left:panelWidth,top:0},{input:await panel(resolve(options.outputDirectory,files.residual)),left:2*panelWidth,top:0},{input:maskPanel,left:3*panelWidth,top:0},{input:await panel(resolve(options.outputDirectory,files.cutout)),left:4*panelWidth,top:0}]).png().toFile(resolve(options.outputDirectory,files.comparison));
  const receipt:ExtractionReceipt={schema:'cssearth-nebula-extraction-lab@1',id,width,height,skyRgb:sky,threshold,supportFraction:supportSum/(width*height),outputs:files,method:'Border-robust sky subtraction; median-filtered extended-emission seed; morphology-connected, softly feathered support; compact residual retained only inside that support.',limitations:['The compact residual is a frequency separation, not a star catalogue.','Foreground stars projected inside the galaxy support cannot be distinguished reliably from intrinsic compact sources in broadband JPEG imagery.','Disconnected emission outside the morphology-connected support may be omitted.']};
  await writeFile(resolve(options.outputDirectory,`${id}-receipt.json`),JSON.stringify(receipt,null,2)+'\n');return receipt;
}

async function createSupportMask(extendedLuma:Buffer,width:number,height:number,threshold:number,options:ExtractionOptions):Promise<Buffer>{
  const supportPixels=Math.min(options.supportPixels??420,width,height),small=await sharp(extendedLuma,{raw:{width,height,channels:1}}).resize({width:supportPixels,height:supportPixels,fit:'inside'}).blur(1.2).greyscale().raw().toBuffer({resolveWithObject:true}),sw=small.info.width,sh=small.info.height,seed=new Uint8Array(sw*sh);
  if(small.info.channels!==1||small.data.length!==sw*sh)throw new TypeError('Support signal must remain single-channel.');
  const high=new Uint8Array(seed.length),highThreshold=Math.max(threshold*1.8,quantile([...small.data],.9));for(let p=0;p<seed.length;p++){if(small.data[p]>=threshold)seed[p]=255;if(small.data[p]>=highThreshold)high[p]=255;}
  const radius=Math.max(1,Math.round(Math.min(sw,sh)*(options.bridgeFraction??.006))),highMain=strongestInteriorComponent(high,small.data,sw,sh),bridged=new Uint8Array(seed.length);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){let on=false;for(let dy=-radius;dy<=radius&&!on;dy++)for(let dx=-radius;dx<=radius;dx++){if(dx*dx+dy*dy>radius*radius)continue;const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<sw&&ny<sh&&seed[ny*sw+nx]){on=true;break;}}if(on)bridged[y*sw+x]=255;}
  const connected=connectedFromSeed(bridged,highMain,sw,sh),softSigma=Math.max(.3,Math.min(sw,sh)*(options.softEdgeFraction??.018)),maskResult=await sharp(connected,{raw:{width:sw,height:sh,channels:1}}).blur(softSigma).resize(width,height).greyscale().raw().toBuffer({resolveWithObject:true});
  if(maskResult.info.channels!==1||maskResult.data.length!==width*height)throw new TypeError('Support mask must remain single-channel.');
  return maskResult.data;
}
