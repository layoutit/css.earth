import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {asteroidElements,asteroidPositionKm} from '../../packages/astronomy/dist/index.js';
import {ASTEROID_FIXTURES_4} from '../../packages/astronomy/src/__fixtures__/horizons.asteroids-4.ts';
const rows=[];
for(const id of ['arrokoth','quaoar','gkunhomdima']){
 const epoch=asteroidElements(id).epochJdTt;
 const errors=ASTEROID_FIXTURES_4[id].rows.map(row=>({jd:row.jd,errorKm:Math.hypot(...asteroidPositionKm(id,row.jd).map((v,i)=>v-row.position[i]))}));
 assert.ok(errors.find(row=>row.jd===epoch).errorKm<.001);
 const source=await readFile(`src/planets/${id}/source/reference/horizons-vectors.txt`);
 const endpoints=errors.filter(row=>row.jd!==epoch).map(row=>row.errorKm);
 rows.push({id,epochJdTt:epoch,errors,fixtureSha256:createHash('sha256').update(source).digest('hex'),regressionBoundKm:Math.ceil(Math.max(...endpoints)*1.15),qualification:'Fitted fixed epoch within 1 m; independent endpoints ±30 days measured separately. These samples do not establish intervening-date or long-term accuracy.'});
}
await writeFile('docs/trans-neptunian/orbit-errors.json',JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows));
