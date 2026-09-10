// Adapted from the established asteroids-survey surface-fit helper.
// Original exact closest-triangle and AABB algorithms are retained unchanged.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {loadPdsPlateShape} from '../../tools/objects/terrestrial-layers/obj-shape.mjs';

const root = resolve(import.meta.dirname, '../..');
const allBodies = JSON.parse(await readFile(resolve(root, 'docs/mars-crossing-population/inputs.json'), 'utf8'));
const requested = process.argv.slice(2);
if (requested.includes('--list')) {
  console.log(JSON.stringify({objects: allBodies.map(body => body.id), samplesPerDirection:8192, radialDirections:8192, concurrency:1, usesPreparedTerrain:true}));
  process.exit(0);
}
const ids = requested.length ? requested : allBodies.map(body => body.id);
for (const id of ids) {
  if (!allBodies.some(body => body.id === id)) throw Error(`Unknown selected asteroid ${id}`);
  const started = performance.now(), out = resolve(root, 'output/mars-crossing-population', id);
  const configBytes = await readFile(resolve(root, 'src/planets', id, 'source/preparation/terrestrial.json'));
  const config = JSON.parse(configBytes), p = config.geometry.radialTerrain;
  const sourceDirectory = resolve(root, 'src/planets', id, 'source');
  const [sourceBytes, terrainBytes, manifestBytes] = await Promise.all([
    readFile(resolve(sourceDirectory, p.path)),
    readFile(resolve(root, 'src/planets', id, 'prepared/terrain.json')),
    readFile(resolve(sourceDirectory, 'manifest.json')),
  ]);
  const terrain = JSON.parse(terrainBytes), manifest = JSON.parse(manifestBytes);
  const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256(sourceBytes), manifest.inputs.find(input => input.path === p.path)?.expectedSha256, 'Original source pin');
  assert.deepEqual(terrain.source.grid, p.grid, 'Prepared terrain and source use the same physical units');
  assert.equal(terrain.source.path, p.path);
  assert.ok(terrain.faces.length > 0 && terrain.faces.length <= 800);
  const mesh = await loadPdsPlateShape(resolve(sourceDirectory, p.path), p.grid);
  const scale = config.geometry.radiusKm * 1000 / config.geometry.radius;
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),add=(a,b,t)=>a.map((v,i)=>v+b[i]*t),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sourceFaces=mesh.indices.map(f=>{const vertices=f.map(i=>mesh.positions[i]),normal=cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0]));return{vertices,normal:normal.map(v=>v/Math.hypot(...normal))}});
const outputFaces=terrain.faces.map(f=>({vertices:f.vertices.map(v=>v.map(n=>n*scale))}));
function closest(p,[a,b,c]){const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return a;const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b;const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return add(a,ab,d1/(d1-d3));const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c;const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return add(a,ac,d2/(d2-d6));const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)return add(b,sub(c,b),(d4-d3)/((d4-d3)+(d5-d6)));const denom=1/(va+vb+vc);return add(add(a,ab,vb*denom),ac,vc*denom)}
function tree(faces){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const f of faces)for(const v of f.vertices)for(let i=0;i<3;i++){min[i]=Math.min(min[i],v[i]);max[i]=Math.max(max[i],v[i]);}if(faces.length<=12)return{min,max,faces};const extent=max.map((v,i)=>v-min[i]),axis=extent.indexOf(Math.max(...extent));faces.sort((a,b)=>a.vertices.reduce((s,v)=>s+v[axis],0)-b.vertices.reduce((s,v)=>s+v[axis],0));const h=Math.floor(faces.length/2);return{min,max,left:tree(faces.slice(0,h)),right:tree(faces.slice(h))}}
function nearest(p,t){let best=Infinity;const dist=n=>n.min.reduce((s,v,i)=>s+Math.max(v-p[i],0,p[i]-n.max[i])**2,0);function visit(n){if(dist(n)>=best)return;if(n.faces){for(const f of n.faces){const q=closest(p,f.vertices);best=Math.min(best,sub(p,q).reduce((s,v)=>s+v*v,0));}}else{const order=dist(n.left)<dist(n.right)?[n.left,n.right]:[n.right,n.left];order.forEach(visit)}}visit(t);return Math.sqrt(best)}
const sourceTree=tree([...sourceFaces]),outputTree=tree([...outputFaces]),sourceToOutput=[],outputToSource=[];
// Deterministic area-stratified triangle centroid samples across each surface.
function sample(faces,count){const weights=faces.map(f=>Math.hypot(...cross(sub(f.vertices[1],f.vertices[0]),sub(f.vertices[2],f.vertices[0])))/2),area=weights.reduce((s,v)=>s+v,0);let face=0,cumulative=weights[0];return Array.from({length:count},(_,i)=>{const target=area*(i+.5)/count;while(cumulative<target)cumulative+=weights[++face];const f=faces[face],u=Math.sqrt((i*.7548776662466927)%1),v=(i*.5698402909980532)%1;return f.vertices[0].map((a,j)=>a*(1-u)+f.vertices[1][j]*u*(1-v)+f.vertices[2][j]*u*v)})}
for(const p of sample(sourceFaces,8192))sourceToOutput.push(nearest(p,outputTree));for(const p of sample(outputFaces,8192))outputToSource.push(nearest(p,sourceTree));
const summary=values=>{values.sort((a,b)=>a-b);return{count:values.length,mean:values.reduce((s,v)=>s+v,0)/values.length,p95:values[Math.floor(values.length*.95)],p99:values[Math.floor(values.length*.99)],maximum:values.at(-1)}};
let multihit=0;for(let i=0;i<8192;i++){const z=1-2*(i+.5)/8192,phi=i*137.50776405003785*Math.PI/180,d=[Math.sqrt(1-z*z)*Math.cos(phi),Math.sqrt(1-z*z)*Math.sin(phi),z],h=mesh.intersect([0,0,0],d);if(h&&mesh.intersect(d.map(v=>v*(h.radius+.001)),d))multihit++}
const report={schema:'cssearth-asteroid-source-fit@1',id,method:'8192 deterministic area-stratified surface samples in each direction, exact nearest point over target triangles with AABB pruning; sampled distances, not exhaustive Hausdorff bound',units:'meters',geometrySource:'Original pinned counted triangle mesh versus prepared/terrain.json; no simplification or geometry preparation is run by this helper',sourceIdentity:{path:p.path,sha256:sha256(sourceBytes),bytes:sourceBytes.length,vertices:mesh.positions.length,faces:mesh.indices.length,metersPerUnit:p.grid.metersPerUnit},preparedIdentity:{path:`src/planets/${id}/prepared/terrain.json`,sha256:sha256(terrainBytes),bytes:terrainBytes.length,faces:terrain.faces.length,logicalUnitsToMeters:scale},configurationSha256:sha256(configBytes),sourceToOutput:summary(sourceToOutput),outputToSource:summary(outputToSource),radialDiscontinuity:{multipleIntersectionDirections:multihit,sampledDirections:8192},elapsedSeconds:(performance.now()-started)/1000};
await mkdir(out,{recursive:true});
await writeFile(resolve(out,'surface-fit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
}
