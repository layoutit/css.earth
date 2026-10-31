import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {imageBytes,metrics,targetOf,type Observation} from './report.mts';
import {appearanceLoss,componentSettings,type Grade} from './grade.mts';
export const normalized=(v:Float64Array,o:Observation)=>Float64Array.from(v,x=>x*o.metadata.normalization.commonFactor);
const svg=(w:number,h:number,text:string)=>Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101216"/><g fill="#e7e9ed" font-family="Arial,sans-serif">${text}</g></svg>`);
const text=(x:number,y:number,s:string,size=18)=>`<text x="${x}" y="${y}" font-size="${size}">${s.replaceAll('&','&amp;').replaceAll('<','&lt;')}</text>`;
export async function saveGradedSheet(dir:string,stage:number,o:Observation,earth:Float64Array,views:Float64Array[],grade:Grade,calibrationCaption='No local iterative appearance fitting.',stageTitle='component color grading',outsideReference?:string){
  const w=o.width,h=o.height,size=Math.round(Math.sqrt(views[0].length/3)),labels=['Face-on','45°','Edge-on'];
  const target=Buffer.alloc(w*h*3);for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<3;c++)target[(y*w+x)*3+c]=Math.round(255*o.rawRgb[c][y][x]);
  const e=imageBytes(normalized(earth,o),o,true),targetLinear=targetOf(o),diff=Float64Array.from(normalized(earth,o),(v,i)=>o.mask[Math.floor(i/3/o.width)][Math.floor(i/3)%o.width]?Math.abs(v-targetLinear.data[i])*4:0);
  const buffers=[e,target,imageBytes(diff,o,false),...views.map(v=>imageBytes(normalized(v,o),o,false))];
  const pngs=await Promise.all(buffers.map((v,i)=>sharp(v,{raw:{width:i<3?w:size,height:i<3?h:size,channels:3}}).png().toBuffer()));
  const f=w/512,top=Math.round(82*f),bottom=top+h+Math.round(38*f),height=bottom+size+Math.round(48*f);
  const heading=svg(w*3,height,`<g transform="scale(${f})">`+text(14,27,`l${stage} · ${stageTitle}`,22)+text(14,51,'Same model, exposure and display curve in every view. Research pilot; no slabs.',15)+text(10,75,`Earth · ${w} px`)+text(522,75,'Horálek · registered diffuse image')+text(1034,75,'Absolute difference · 4×')+labels.map((s,i)=>text(i*512+10,bottom/f-10,`${s} · 16 kpc across`)).join('')+text(12,height/f-17,`Dust strength ${grade.dustStrength.toFixed(2)}. ${calibrationCaption}`,15)+'</g>');
  await sharp(heading).composite(pngs.map((input,i)=>({input,left:(i%3)*w,top:i<3?top:bottom}))).png().toFile(`${dir}/sheet.png`);
  for(let i=0;i<pngs.length;i++)await writeFile(`${dir}/${['earth','horalek','difference-4x','face','tilt45','edge'][i]}.png`,pngs[i]);
  if(w===512){const ref=await sharp(outsideReference??`${dir}/../inputs/ngc4027-eso.jpg`).resize(512,512,{fit:'contain',background:'#050609'}).png().toBuffer();
    const bg=svg(1024,604,text(12,27,'l'+stage+' · LMC face-on',22)+text(524,27,'NGC 4027 · ESO / NTT',22)+text(12,563,'Qualitative comparison only: different scales, filters and image processing.',16)+text(12,588,'NGC 4027 is another Magellanic-type galaxy, not an outside view of the LMC.',16));
    await sharp(bg).composite([{input:pngs[3],left:0,top:40},{input:ref,left:512,top:40}]).png().toFile(`${dir}/outside-comparison.png`);
  }
}
export async function notes(dir:string,stage:number,o:Observation,earth:Float64Array,grade:Grade,rungs:unknown[],sourceNotes:string[]){
  const m=metrics(normalized(earth,o),targetOf(o),o);
  await writeFile(`${dir}/notes.md`,`# l${stage}: component grading round\n\n${['The young population now uses individual SMASH positions and measured gri photometry.','Bell internal dust columns are retained, with a positive global attenuation strength.','Qualified DeMCELS continuum-subtracted Hα is added as a measured emission template.'][stage-5]}\n\nOne RGB tint and gain is fitted for each active emission component. The old disc and outskirts share a grade. Dust has a global attenuation tint and strength, followed by one shared stretch and saturation curve. No local brightness or color parameters are fitted.\n\n| Residual at 512 pixels | Value |\n| --- | --- |\n| Linear RGB training relative RMS | ${m.trainRelativeRms.toFixed(6)} |\n| Linear RGB held-out relative RMS | ${m.heldoutRelativeRms.toFixed(6)} |\n| Total diffuse light difference | ${m.totalLightDifferencePercent.toFixed(2)}% |\n${m.annularDifferencePercent.map((v,i)=>`| Annulus ${['0–1','1–2','2–4','4+'][i]} kpc | ${v?.toFixed(2)}% |`).join('\n')}\n\nChannel-share errors, in red, green and blue percentage points:\n\n${m.channelShareDifferencePercentagePoints.map((a,i)=>`- ${['Inner 1.5 kpc','1.5–4 kpc','Outer region'][i]}: ${a.map(v=>v?.toFixed(2)).join(', ')}.`).join('\n')}\n\n${sourceNotes.map(s=>`- ${s}`).join('\n')}\n\nThe photo is processed RGB. These are appearance residuals, not calibrated luminosities or the later slab acceptance test. Individual stellar depths and gas depth remain conditional. All outside views use the same fitted display settings. No full-resolution fitting or slab baking has run.\n`);
  await writeFile(`${dir}/grade.json`,JSON.stringify({grade,components:componentSettings(grade),display:{stretch:grade.stretch,saturation:grade.saturation},residuals:m,rungs},null,2)+'\n');return m;
}
