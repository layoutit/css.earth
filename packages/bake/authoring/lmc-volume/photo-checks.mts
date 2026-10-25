/** Surveys check the converted photo fields; they never modify those fields. */
import {readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {LOCAL,ROOT,ARCHIVE,json,rec,array,numbers,num,need,loadSources,at,makeRaster,type Raster} from './inputs.mts';
import {addGas} from './gas.mts';
import {loadObservation} from './observation.mts';
import {bodyToIcrs,normalize,rayInBody,unit,add,mul,type V3} from './geometry.mts';
import {photoFootpoint} from './photo-model.mts';
import {readGrade} from './grade.mts';
const out=`${LOCAL}versions/l8/`,meta=rec(await json(out+'field.json')),n=num(array(meta.bodyGrid)[0]),half=num(meta.halfKpc),maps:Raster[]=[];
for(let k=0;k<5;k++){const bytes=await readFile(out+`field-${k}.f32le`);need(bytes.length===n*n*4,'Wrong working photo field size');const map=makeRaster(n,half);for(let i=0;i<n*n;i++)map.values[i]=bytes.readFloatLE(i*4);map.mask.fill(1);maps.push(map);}
const grade=readGrade(rec(await json(out+'result.json')).grade),sources=await loadSources(512,20),observation=await loadObservation(8),rows:{name:string;samples:number;statistic:string;value:number|null;interpretation:string}[]=[];
function correlation(a:number[],b:number[]):number|null {
  if(a.length<10)return null;let sa=0,sb=0,saa=0,sbb=0,sab=0;for(let i=0;i<a.length;i++){sa+=a[i];sb+=b[i];saa+=a[i]*a[i];sbb+=b[i]*b[i];sab+=a[i]*b[i];}const d=Math.sqrt((saa-sa*sa/a.length)*(sbb-sb*sb/a.length));return d>0?(sab-sa*sb/a.length)/d:null;
}
const atSky=(ra:number,de:number)=>{const r=rayInBody(unit(ra,de)),p=add(r.origin,mul(r.direction,-r.origin[2]/r.direction[2]));return photoFootpoint(sources.warp,...p);};
const inPhoto=(p:V3)=>{const q=observation.pixelOf(bodyToIcrs(p));if(!q)return false;const x=Math.floor(q[0]),y=Math.floor(q[1]);return x>=20&&y>=20&&x<492&&y<364&&observation.mask[y][x];};
const youngFraction=(p:V3)=>{const old=at(maps[0],p[0],p[1])*grade.coefficients[0][1]+at(maps[1],p[0],p[1])*grade.coefficients[1][1],young=at(maps[2],p[0],p[1])*grade.coefficients[2][1];return young/Math.max(1e-12,old+young);};
// SMASH: the original strict blue-count grid, with unsupported cells excluded.
const smash=(await readFile(`${ARCHIVE}dataset-model/detail-stars/source/full-grid.csv`,'utf8')).trim().split(/\r?\n/u),header=smash.shift()!.split(','),ci=(s:string)=>{const i=header.indexOf(s);need(i>=0,'Missing SMASH column');return i;},cols=['ix','iy','n0','n_strict','n'].map(ci),sx:number[]=[],sy:number[]=[];
for(const line of smash){const r=line.split(',').map(Number);if(r[cols[3]]/r[cols[4]]<.8)continue;const p=atSky(61.5+(r[cols[0]]+.5)*.125,-73.5+(r[cols[1]]+.5)*.05),pixel=observation.pixelOf(bodyToIcrs(p));if(!pixel||Math.hypot(p[0],p[1])>5)continue;const x=Math.floor(pixel[0]),y=Math.floor(pixel[1]);if(x<0||y<0||x>=observation.width||y>=observation.height||!observation.mask[y][x])continue;sx.push(Math.log1p(r[cols[2]]));sy.push(Math.log1p(at(maps[2],p[0],p[1])*1e4));}
rows.push({name:'SMASH',samples:sx.length,statistic:'Pearson correlation of log blue counts and log young-field intensity',value:correlation(sx,sy),interpretation:'Positive association supports the blue-light classification. Counts and diffuse luminosity have different completeness and mass weighting.'});
// VMC: independently located regional age budgets; the same stellar library is shared.
const ssp=rec(await json(`${ARCHIVE}dataset-model/detail-stars/ssp-intake/bc03-Z008-optical-age-table.json`)),bins=array(rec(array(ssp.solutions)[0]).bins).map(v=>numbers(rec(v).meanLnuWPerHzPerInitialMsun,3)),vx:number[]=[],vy:number[]=[],recent:number[]=[];
for(const v of array(rec(await json(`${ARCHIVE}dataset-model/stars/regions.json`)).regions)){
  const row=rec(v),center=numbers(row.centerIcrsDeg,2),mass=numbers(row.formedMassPerEffectiveDeg2ByAgeBin,16),p=atSky(center[0],center[1]);if(!inPhoto(p))continue;
  let old=0,young=0,hot=0;for(let age=0;age<16;age++)if(age<2)hot+=mass[age]*bins[age][1];else if(age<=5)young+=mass[age]*bins[age][1];else old+=mass[age]*bins[age][1];
  if(old+young>0){vx.push(young/(old+young));recent.push(hot/(hot+old+young));vy.push(youngFraction(p));}
}
rows.push({name:'VMC',samples:vx.length,statistic:'Pearson correlation of regional young-light fractions',value:correlation(vx,vy),interpretation:'Regional age check. BC03 is shared, and the photo blue endmember traces hot stars rather than all 15–251 Myr luminosity.'});
rows.push({name:'VMC recent ages',samples:recent.length,statistic:'Pearson correlation with 4–16 Myr regional light fractions',value:correlation(recent,vy),interpretation:'Age-matched alternative for the hot blue endmember. The youngest resolved-population histories are less secure; both VMC comparisons are retained.'});
// Bell: one calibrated mean plus a separate spatial test. No spatial column is copied.
const bx:number[]=[],by:number[]=[];let measured=0,inferred=0;
for(let y=0;y<sources.dust.n;y++)for(let x=0;x<sources.dust.n;x++){
  const i=y*sources.dust.n+x;if(!sources.dust.mask[i])continue;const px=((x+.5)/sources.dust.n*2-1)*20,py=((y+.5)/sources.dust.n*2-1)*20,p:V3=[px,py,at(sources.warp,px,py)],pixel=observation.pixelOf(bodyToIcrs(p));if(!pixel||pixel[0]<20||pixel[1]<20||pixel[0]>=492||pixel[1]>=364)continue;
  const col=sources.dust.values[i]/Math.abs(rayInBody(normalize(bodyToIcrs(p))).direction[2]),photo=at(maps[4],px,py);if(photo>0){bx.push(col);by.push(photo);measured+=col;inferred+=photo;}
}
rows.push({name:'Bell mean',samples:bx.length,statistic:'Mean inferred / measured full-column ratio',value:inferred/measured,interpretation:'Calibration of the global dust amount, not an independent validation.'});
rows.push({name:'Bell structure',samples:bx.length,statistic:'Pearson correlation of photo dust and background-galaxy full columns',value:correlation(bx,by),interpretation:'Spatial check only. The photo proxy can confuse low emission with attenuation; a weak correlation is a limitation.'});
// DeMCELS: measured H-alpha footprint only, never zeros in unobserved space.
await addGas(sources);const hx:number[]=[],hy:number[]=[];
for(let y=0;y<sources.gas.n;y++)for(let x=0;x<sources.gas.n;x++){const i=y*sources.gas.n+x;if(!sources.gas.mask[i])continue;const px=((x+.5)/sources.gas.n*2-1)*8,py=((y+.5)/sources.gas.n*2-1)*8,h=sources.gas.values[i],p=at(maps[3],px,py);if(h>0&&inPhoto([px,py,at(sources.warp,px,py)])){hx.push(Math.log1p(h*1e3));hy.push(Math.log1p(p*1e4));}}
rows.push({name:'DeMCELS Hα',samples:hx.length,statistic:'Pearson correlation of log H-alpha and log pink-gas intensity',value:correlation(hx,hy),interpretation:'Ten small qualified cutouts only. This does not establish complete gas coverage or absolute line luminosity.'});
// WISE: registered allWISE color image, at its own physical tangent bounds.
const input=rec(await json(`${ROOT}src/objects/lmc-volume/source/compact/inputs.json`)),wise=rec(array(input.datasets).find(v=>rec(v).imageId==='wise-wide-infrared')),bounds=rec(wise.tangentBoundsKpc),lo=numbers(bounds.min),hi=numbers(bounds.max),registered=rec(wise.registered),coverage=rec(wise.coverage),im=await sharp(`${ROOT}${registered.path}`).raw().toBuffer({resolveWithObject:true}),mask=await sharp(`${ROOT}${coverage.path}`).resize(im.info.width,im.info.height,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
// The common registered frame matches the optical one. Use measured optical rays
// to transfer its tangent coordinate to the wider WISE extent without a new fit.
const opticalBounds=observation.metadata.registration.tangentBoundsKpc,wx:number[]=[],wy:number[]=[];
for(let y=0;y<observation.height;y+=2)for(let x=0;x<observation.width;x+=2){if(!observation.mask[y][x])continue;const tx=opticalBounds.min[0]+(x+.5)/observation.width*(opticalBounds.max[0]-opticalBounds.min[0]),ty=opticalBounds.max[1]-(y+.5)/observation.height*(opticalBounds.max[1]-opticalBounds.min[1]),ix=Math.floor((tx-lo[0])/(hi[0]-lo[0])*im.info.width),iy=Math.floor((hi[1]-ty)/(hi[1]-lo[1])*im.info.height);if(ix<0||iy<0||ix>=im.info.width||iy>=im.info.height||mask.data[(iy*im.info.width+ix)*4+3]<250)continue;
  const r=rayInBody(observation.rayAt(x+.5,y+.5)),p=photoFootpoint(sources.warp,...add(r.origin,mul(r.direction,-r.origin[2]/r.direction[2])));wx.push(im.data[(iy*im.info.width+ix)*im.info.channels]/255);wy.push(at(maps[4],p[0],p[1]));
}
rows.push({name:'WISE',samples:wx.length,statistic:'Pearson correlation of WISE display-red morphology and photo dust',value:correlation(wx,wy),interpretation:'Processed infrared morphology only. Temperature and illumination affect IR brightness; extinction is not thermal emission.'});
await writeFile(out+'checks.json',JSON.stringify({rows,surveyDataChangedModel:false},null,2)+'\n');
await writeFile(out+'checks.md',`# Dataset checks of the l8 split\n\nNone of these checks changes a component map or its grade. Bell supplies the one dust normalization. The remaining comparisons are descriptive checks, not a unique physical decomposition.\n\n| Dataset | Samples | Statistic | Result |\n| --- | --- | --- | --- |\n${rows.map(r=>`| ${r.name} | ${r.samples} | ${r.statistic} | ${r.value===null?'Unavailable':r.value.toFixed(4)} |`).join('\n')}\n\n${rows.map(r=>`- ${r.name}: ${r.interpretation}`).join('\n')}\n`);
console.log(JSON.stringify({sentinel:'L8_DATASET_CHECKS_COMPLETE',rows}));
