import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {loadPdsPlateShape} from '../../tools/objects/terrestrial-layers/obj-shape.mjs';
import {BODY_FIXED_SUN_DIRECTIONS} from '../../src/platform/solar-geometry.mjs';
const base='output/near-earth-population';
const ids=process.argv.slice(2).length?process.argv.slice(2):JSON.parse(await readFile('docs/near-earth-population/inputs.json')).map(x=>x.id);
for(const id of ids){
 const root=`src/planets/${id}/source`, config=JSON.parse(await readFile(`${root}/preparation/terrestrial.json`));
 const spec=config.geometry.radialTerrain, mesh=await loadPdsPlateShape(`${root}/${spec.path}`,spec.grid);
 const terrain=JSON.parse(await readFile(`src/planets/${id}/prepared/terrain.json`)),scale=config.geometry.radiusKm*1000/config.geometry.radius;
 const queries=terrain.faces.map((face,faceId)=>({kind:'retained-face-centroid',faceId,point:[0,1,2].map(a=>face.vertices.reduce((sum,v)=>sum+v[a],0)*scale/3)}));
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const point=mesh.positions.reduce((best,v)=>v[axis]*sign>best[axis]*sign?v:best);
  queries.push({kind:`source-extreme-${axis}-${sign}`,point});
 }
 await mkdir(`${base}/${id}`,{recursive:true});
 await writeFile(`${base}/${id}/scalar-queries.json`,JSON.stringify(queries,null,2)+'\n');
 const sun=BODY_FIXED_SUN_DIRECTIONS[id]; if(!sun)throw Error(`Missing body-fixed Sun for ${id}`);
 await writeFile(`${base}/${id}/body-fixed-sun.json`,JSON.stringify(sun)+'\n');
 console.log(id,queries.length,'source-scalar queries from prepared terrain and raw mesh');
}
