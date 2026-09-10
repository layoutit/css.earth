import {readFile,writeFile} from 'node:fs/promises';
import {asteroidPositionKm} from '../../packages/astronomy/dist/index.js';
const bodies=JSON.parse(await readFile('docs/centaur-population/inputs.json','utf8')).bodies;
const fixtures={};
for(const part of [1,2,3,4]){
 const source=await readFile(`packages/astronomy/src/__fixtures__/horizons.asteroids-${part}.ts`,'utf8');
 Object.assign(fixtures,JSON.parse(source.split(`export const ASTEROID_FIXTURES_${part} = `)[1].split(' as const')[0]));
}
const records=bodies.map(({id})=>{
 const fixture=fixtures[id],errors=fixture.rows.map(row=>Math.hypot(...asteroidPositionKm(id,row.jd).map((v,i)=>v-row.position[i])));
 return {id,query:fixture.query,epochsJdTdb:fixture.rows.map(r=>r.jd),errorsKm:errors,regressionGuardKm:Math.ceil(Math.max(errors[0],errors[2])*1.15)};
});
await writeFile('docs/centaur-population/orbit-errors.json',JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify({count:records.length,maxEpochKm:Math.max(...records.map(r=>r.errorsKm[1])),maxEndpointKm:Math.max(...records.flatMap(r=>[r.errorsKm[0],r.errorsKm[2]])),maxGuardKm:Math.max(...records.map(r=>r.regressionGuardKm))}));
