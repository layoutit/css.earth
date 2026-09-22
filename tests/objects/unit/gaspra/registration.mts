import {required} from '../../../../tools/contract/test-values.mts';
import {readFile} from 'node:fs/promises';
import {loadPdsRadialTable} from '../../../../tools/objects/terrestrial-layers/pds-radial-table.mts';
export async function evaluateRegistration() {
const grid=await loadPdsRadialTable('src/objects/gaspra/source/shape/951gaspra.tab',{latitudeStepDegrees:2,longitudeStepDegrees:2,longitudeDirection:'west',metersPerUnit:1000,expectedRecords:16471});
const bytes=(await readFile('src/objects/gaspra/source/maps/951gaspram.fit')).subarray(2880,262080);
const rad=Math.PI/180,unit=(v: number[])=>v.map((x: number)=>x/Math.hypot(...v)),sub=(a: number[],b: number[])=>a.map((v: number,i: number)=>v-b[i]),dot=(a: number[],b: number[])=>a.reduce((s: number,v: number,i: number)=>s+v*b[i],0),cross=(a: number[],b: number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const direction=(lon: number,lat: number)=>[Math.cos(lat*rad)*Math.cos(lon*rad),Math.cos(lat*rad)*Math.sin(lon*rad),Math.sin(lat*rad)];
const point=(lon: number,lat: number)=>direction(lon,lat).map(x=>x*required(grid.sample(lon,lat)));
const observations=(await readFile('src/objects/gaspra/source/reference/951gaspimg.tab','utf8')).trim().split(/\r?\n/).map(line=>line.trim().split(/\s+/)).filter(fields=>['107318313','107318326'].includes(fields[0])).map(([id,...fields])=>{const n=fields.map(Number);return{id,scLat:n[0],scWest:n[1],sunLat:n[2],sunWest:n[3],rangeM:n[4]*1000}});
if(observations.length!==2)throw new Error('Gaspra mosaic source-image geometry is incomplete.');
const output=[];
for(const rows of ['north-to-south','south-to-north'])for(const samplesIncrease of ['east','west']){
let valid=0,visible=0,lit=0,both=0,latitudeSum=0;
for(let y=4;y<356;y+=2)for(let x=0;x<720;x+=2){if(!bytes[y*720+x])continue;
const lat=(rows==='north-to-south'?1:-1)*(90-(y+.5)/2),lon=(samplesIncrease==='east'?1:-1)*((x+.5)/2-180),p=point(lon,lat),n=unit(cross(sub(point(lon+.1,lat),point(lon-.1,lat)),sub(point(lon,lat+.1),point(lon,lat-.1))));
const conditions=observations.map(o=>({v:dot(n,sub(direction(-o.scWest,o.scLat).map(v=>v*o.rangeM),p))>0,l:dot(n,direction(-o.sunWest,o.sunLat))>0}));valid++;latitudeSum+=lat;if(conditions.some(o=>o.v))visible++;if(conditions.some(o=>o.l))lit++;if(conditions.some(o=>o.v&&o.l))both++;
}output.push({rows,samplesIncrease,valid,visibleFraction:visible/valid,illuminatedFraction:lit/valid,bothFraction:both/valid,meanValidLatitude:latitudeSum/valid});}
return {observations,candidates:output};
}
