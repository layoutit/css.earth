import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { loss,type Fit,type Target } from './render.mts';
import { rayPlane } from './geometry.mts';
import { loadObservation } from './observation.mts';
import {num} from './inputs.mts';
export type Observation=Awaited<ReturnType<typeof loadObservation>>;
export function targetOf(o:Observation):Target {
  const data=new Float64Array(o.width*o.height*3),train=new Uint8Array(o.width*o.height),holdout=new Uint8Array(train.length);
  for(let y=0;y<o.height;y++)for(let x=0;x<o.width;x++){const i=y*o.width+x;for(let c=0;c<3;c++)data[i*3+c]=o.target[c][y][x];train[i]=Number(o.mask[y][x]&&!o.heldout[y][x]);holdout[i]=Number(o.heldout[y][x]);}
  return {data,train,holdout};
}
const srgb=(v:number)=>{const x=Math.min(1,Math.max(0,v));return x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055;};
export function imageBytes(values:Float64Array,o:Observation,earth:boolean,gain=1):Buffer {
  const factor=o.metadata.normalization.commonFactor,sky=o.metadata.sky.rgbLinearDisplay,out=Buffer.alloc(values.length);
  for(let i=0;i<values.length;i++)out[i]=Math.round(255*srgb(values[i]/factor*gain+(earth?sky[i%3]:0)));return out;
}
export function metrics(values:Float64Array,target:Target,o:Observation) {
  const sums=[0,0],annuli=Array.from({length:4},()=>({model:0,target:0,n:0})),colors=Array.from({length:3},()=>({model:[0,0,0],target:[0,0,0]}));
  for(let y=0;y<o.height;y++)for(let x=0;x<o.width;x++){
    const p=y*o.width+x;if(!o.mask[y][x])continue;const point=rayPlane(o.rayAt(x+.5,y+.5)),r=Math.hypot(point[0],point[1]),a=r<1?0:r<2?1:r<4?2:3,g=r<1.5?0:r<4?1:2;
    for(let c=0;c<3;c++){const v=values[p*3+c],t=target.data[p*3+c];sums[0]+=v;sums[1]+=t;annuli[a].model+=v;annuli[a].target+=t;colors[g].model[c]+=v;colors[g].target[c]+=t;}annuli[a].n++;
  }
  return {trainRelativeRms:loss(values,target),heldoutRelativeRms:loss(values,target,true),totalLightDifferencePercent:100*(sums[0]/sums[1]-1),
    annularDifferencePercent:annuli.map(a=>a.target>0?100*(a.model/a.target-1):null),
    channelShareDifferencePercentagePoints:colors.map(g=>{const a=g.model.reduce((x,y)=>x+y,0),b=g.target.reduce((x,y)=>x+y,0);return g.model.map((v,c)=>a>0&&b>0?100*(v/a-g.target[c]/b):null);})};
}
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const svg=(width:number,height:number,text:string)=>Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101216"/><g fill="#e7e9ed" font-family="Arial,sans-serif">${text}</g></svg>`);
export async function saveSheet(directory:string,label:string,o:Observation,earth:Float64Array,views:Float64Array[],stats:ReturnType<typeof metrics>,status:string):Promise<void> {
  const width=768,height=670,top=74,earthHeight=286;
  const targetRaw=Buffer.alloc(o.width*o.height*3);for(let y=0;y<o.height;y++)for(let x=0;x<o.width;x++)for(let c=0;c<3;c++)targetRaw[(y*o.width+x)*3+c]=Math.round(255*o.rawRgb[c][y][x]);
  const frame=async(bytes:Buffer,w:number,h:number,outw:number,outh:number)=>sharp(bytes,{raw:{width:w,height:h,channels:3}}).resize(outw,outh,{fit:'fill'}).png().toBuffer();
  const size=Math.round(Math.sqrt(views[0].length/3));
  const panels=await Promise.all([frame(imageBytes(earth,o,true),o.width,o.height,384,earthHeight),frame(targetRaw,o.width,o.height,384,earthHeight),...views.map(v=>frame(imageBytes(v,o,false),size,size,256,256))]);
  const labels=svg(width,height,`<text x="16" y="27" font-size="22">${escape(label)}</text><text x="16" y="50" font-size="13">${escape(status)} · ${o.width} px · shared brightness across views</text><text x="12" y="69" font-size="13">Earth: physical model</text><text x="396" y="69" font-size="13">Horálek: registered diffuse image</text><text x="12" y="385" font-size="14">Face-on · 16 kpc across</text><text x="268" y="385" font-size="14">45° · 16 kpc across</text><text x="524" y="385" font-size="14">Edge-on · 16 kpc across</text><text x="12" y="660" font-size="13">Held-out relative RMS: ${stats.heldoutRelativeRms.toFixed(3)} · total light: ${stats.totalLightDifferencePercent.toFixed(1)}% · reference renders, no slabs</text>`);
  await sharp(labels).composite(panels.map((input,i)=>({input,left:i<2?i*384:(i-2)*256,top:i<2?top:394}))).png().toFile(`${directory}/sheet.png`);
  await sharp(imageBytes(earth,o,true),{raw:{width:o.width,height:o.height,channels:3}}).png().toFile(`${directory}/earth.png`);
  for(let i=0;i<views.length;i++)await sharp(imageBytes(views[i],o,false),{raw:{width:size,height:size,channels:3}}).png().toFile(`${directory}/${['face','tilt45','edge'][i]}.png`);
}
export async function writeNotes(directory:string,version:number,label:string,status:string,tiny:Record<string,unknown>,small:Record<string,unknown>,m:ReturnType<typeof metrics>,fit:Fit,limitations:string[]):Promise<void> {
  const annuli=['0–1','1–2','2–4','4+'];
  const calibration=['Disc','Bar','Outskirts, tied to disc','Young population','Line emission'].map((name,i)=>`| ${name} gain | ${fit.gains[i].toFixed(4)} |`).join('\n');
  await writeFile(`${directory}/notes.md`,`# l${version}: ${label}\n\n${status}\n\n${limitations.map(s=>`- ${s}`).join('\n')}\n\n| Residual | Value |\n| --- | --- |\n| Training relative RMS | ${m.trainRelativeRms.toFixed(4)} |\n| Held-out relative RMS | ${m.heldoutRelativeRms.toFixed(4)} |\n| Total light difference | ${m.totalLightDifferencePercent.toFixed(2)}% |\n${annuli.map((a,i)=>`| Annulus ${a} kpc light difference | ${m.annularDifferencePercent[i]?.toFixed(2)??'Unavailable'}% |`).join('\n')}\n\nChannel-share errors in percentage points, in red, green, blue order:\n\n${m.channelShareDifferencePercentagePoints.map((a,i)=>`- ${['Inner 1.5 kpc','1.5–4 kpc','Outer region'][i]}: ${a.map(v=>v?.toFixed(2)??'Unavailable').join(', ')}.`).join('\n')}\n\n| Rung | Image width | Ray step | Time |\n| --- | --- | --- | --- |\n| Tiny | ${num(tiny.size)} pixels | ${num(tiny.rayStepKpc)} kpc | ${num(tiny.seconds).toFixed(2)} seconds |\n| Small | ${num(small.size)} pixels | ${num(small.rayStepKpc)} kpc | ${num(small.seconds).toFixed(2)} seconds |\n\n| Calibration | Value |\n| --- | --- |\n${calibration}\n| Internal dust scale | ${fit.dust.toFixed(4)} |\n| Red / green calibration | ${fit.red.toFixed(4)} |\n| Blue / green calibration | ${fit.blue.toFixed(4)} |\n\nInactive-component gains have no effect. The photograph is a processed RGB appearance target; these residuals are not calibrated luminosity errors or the later bake tolerances. All off-axis panels use the same model and display scale. Full-resolution fitting has not run.\n`);
}
