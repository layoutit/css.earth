/** Fixed-grade ablations; no refitting can conceal the component difference. */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {LOCAL,loadSources,rec,numbers,num,need,json} from './inputs.mts';
import {createModel} from './model.mts';
import {project,outsideCamera,earthCamera} from './render.mts';
import {loadObservation} from './observation.mts';
import {gradedPrediction,validateGrade,type Grade} from './grade.mts';
import {metrics,targetOf,imageBytes} from './report.mts';
import {normalized} from './grade-report.mts';
function readGrade(raw:unknown):Grade {const g=rec(raw),t=numbers(g.dustTint,3),co=Array.isArray(g.coefficients)?g.coefficients:[];const v:Grade={coefficients:co.map(v=>{const a=numbers(v,3);return [a[0],a[1],a[2]];}),dustStrength:num(g.dustStrength),dustTint:[t[0],t[1],t[2]],stretch:num(g.stretch),saturation:num(g.saturation),score:num(g.score)};validateGrade(v);return v;}
const sources=await loadSources(512,20),o=await loadObservation(8),g=readGrade(rec(await json(`${LOCAL}versions/l5/grade.json`)).grade),dir=`${LOCAL}versions/ablations/`;await mkdir(dir,{recursive:true});
// Only components 1–4 are needed to isolate their integrated image contribution.
const model=createModel(4,[1,2,3,4],sources),rows=[];
for(const component of [3,4])for(const name of ['earth','face-wide','edge-wide']){
  const camera=name==='earth'?earthCamera(o.width,o.height,o.rayAt,o.pixelOf):outsideCamera(name==='face-wide'?0:90,256,20),fullBasis=project(model,camera,.12,0),offBasis=project({...model,kept:model.kept.filter(c=>c!==component)},camera,.12,0),full=gradedPrediction(fullBasis,g),off=gradedPrediction(offBasis,g);
  const raw=(basis:typeof fullBasis)=>Float64Array.from(basis.planes[0],(v,i)=>v+basis.planes[1][i]+basis.planes[2][i]);
  const rawFull=raw(fullBasis),rawOff=raw(offBasis),delta=(a:Float64Array,b:Float64Array)=>{let l1=0,sum=0,max=0,changed=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);l1+=d;sum+=a[i];max=Math.max(max,d);changed+=Number(d>1e-14);}return {relativeL1:l1/Math.max(1e-30,sum),maximumAbsoluteDelta:max,changedValues:changed};};
  const sizes={width:camera.width,height:camera.height,channels:3 as const},exposure=name==='earth'?1:100,rawPng=imageBytes(normalized(full,o),o,name==='earth',exposure),offPng=imageBytes(normalized(off,o),o,name==='earth',exposure),diff=Float64Array.from(full,(v,i)=>Math.abs(v-off[i])*exposure*10),diffPng=imageBytes(normalized(diff,o),o,false);
  let encodedChanges=0;for(let i=0;i<rawPng.length;i++)encodedChanges+=Number(rawPng[i]!==offPng[i]);
  const panels=await Promise.all([rawPng,offPng,diffPng].map(b=>sharp(b,{raw:sizes}).png().toBuffer()));
  const labels=Buffer.from(`<svg width="${camera.width*3}" height="${camera.height+60}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101216"/><g fill="white" font-size="14" font-family="Arial"><text x="10" y="20">${component===3?'Warp':'Outskirts'}: ${name}. Display ${exposure}×; difference additional 10×.</text><text x="10" y="44">Both components</text><text x="${camera.width+10}" y="44">Without ${component===3?'warp':'outskirts'}</text><text x="${2*camera.width+10}" y="44">Absolute difference</text></g></svg>`);
  await sharp(labels).composite(panels.map((input,i)=>({input,left:i*camera.width,top:60}))).png().toFile(`${dir}/l${component}-${name}.png`);
  const result={component,name,ungraded:delta(rawFull,rawOff),currentGrade:delta(full,off),encodedChangedChannelValues:encodedChanges,earthResiduals:name==='earth'?{full:metrics(normalized(full,o),targetOf(o),o),removed:metrics(normalized(off,o),targetOf(o),o)}:null};rows.push(result);console.log(JSON.stringify({sentinel:'ABLATION_COMPLETE',...result}));
}
await writeFile(`${dir}results.json`,JSON.stringify(rows,null,2)+'\n');
await writeFile(`${dir}notes.md`,`# Warp and outskirts reach the renderer\n\nEach comparison removes one physical addition while holding all remaining model and display settings fixed. No ablation is refitted. These tests isolate the old disc, bar and outskirts, so young stars do not conceal their differences.\n\nThe wide panels cover 40 kpc. Both input panels use the same 100-fold faint-light exposure, and their difference has another factor of ten. The Earth panels use the ordinary exposure.\n\n| Removed | View | Ungraded relative L1 | Graded relative L1 | Changed encoded channel values |\n| --- | --- | --- | --- | --- |\n${rows.map(v=>`| l${v.component} | ${v.name} | ${v.ungraded.relativeL1.toExponential(7)} | ${v.currentGrade.relativeL1.toExponential(7)} | ${v.encodedChangedChannelValues} |`).join('\n')}\n\nThe Oden warp starts beyond 4.5 kpc. The outskirts are count-normalized beyond 11.3 kpc. They have little leverage in the bright central Earth frame, and rounding a single residual to four decimals can conceal them. The current photo grade strongly suppresses the old disc and therefore its tied outskirts. The ungraded differences distinguish that calibration pressure from a disconnected field.\n`);
console.log('LMC_ABLATIONS_COMPLETE');
