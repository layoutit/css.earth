// Preparation-only illustrative closure of an observed height field. The
// observed plates are immutable. Added plates always carry missing-data grid.
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import { removeOppositeFacePairs } from './mesh-face-pairs.mjs';
const cross2 = (a, b, c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const key = (a, b) => a < b ? `${a},${b}` : `${b},${a}`;

function boundaryLoops(indices) {
  const edges = new Map();
  for (const ids of indices) for (let i=0; i<3; i++) {
    const a=ids[i], b=ids[(i+1)%3], k=key(a,b);
    const hits=edges.get(k) ?? []; hits.push([a,b]); edges.set(k,hits);
  }
  const next=new Map();
  for (const hits of edges.values()) {
    if (hits.length===2 && hits[0][0]===hits[1][1] && hits[0][1]===hits[1][0]) continue;
    if (hits.length!==1 || next.has(hits[0][0])) throw new Error('Completion requires an oriented manifold height field.');
    next.set(...hits[0]);
  }
  const loops=[], seen=new Set();
  for (const seed of next.keys()) if (!seen.has(seed)) {
    const loop=[]; let i=seed;
    while (!seen.has(i)) {
      if (!next.has(i)) throw new Error('Broken completion boundary.');
      seen.add(i); loop.push(i); i=next.get(i);
    }
    if (i!==seed) throw new Error('Completion boundaries intersect.');
    loops.push(loop);
  }
  return loops;
}

// Ear clipping preserves every boundary segment, including collinear posts.
function triangulate(loop, positions) {
  const remaining=[...loop], triangles=[];
  while (remaining.length>3) {
    const i=remaining.findIndex((b,i) => {
      const a=remaining[(i+remaining.length-1)%remaining.length], c=remaining[(i+1)%remaining.length];
      const pa=positions[a], pb=positions[b], pc=positions[c];
      return cross2(pa,pb,pc)>1e-12 && !remaining.some(p => p!==a && p!==b && p!==c &&
        cross2(pa,pb,positions[p])>=-1e-12 && cross2(pb,pc,positions[p])>=-1e-12 && cross2(pc,pa,positions[p])>=-1e-12);
    });
    if (i<0) throw new Error('Cannot triangulate a completion gap without changing its boundary.');
    triangles.push([remaining[(i+remaining.length-1)%remaining.length],remaining[i],remaining[(i+1)%remaining.length]]);
    remaining.splice(i,1);
  }
  if (!(cross2(...remaining.map(i=>positions[i]))>0)) throw new Error('Degenerate completion gap.');
  return [...triangles,remaining];
}

export function completeImageDem(observed, recipe, unitsPerMeter) {
  if (recipe.method!=='outline-depth-envelope' || !(recipe.depthMeters>0) || !Number.isFinite(recipe.depthMeters) ||
      !Number.isInteger(recipe.faceBudget) || recipe.faceBudget<4 || recipe.faceBudget>6000 || !(unitsPerMeter>0)) {
    throw new TypeError('Invalid estimated image DEM completion.');
  }
  const positions=[], lookup=new Map();
  const vertex=p => { const k=p.join(','); if (!lookup.has(k)) {lookup.set(k,positions.length);positions.push(p);} return lookup.get(k); };
  const front=observed.map(f=>f.vertices.map(vertex));
  if (front.some(f=>!(cross2(...f.map(i=>positions[i]))>0))) throw new Error('Completion needs a nonoverlapping positive-Z height field.');
  const loops=boundaryLoops(front), area=loop=>loop.reduce((s,a,i)=>{
    const p=positions[a],q=positions[loop[(i+1)%loop.length]];return s+p[0]*q[1]-p[1]*q[0];
  },0);
  const outer=loops.filter(loop=>area(loop)>0), holes=loops.filter(loop=>area(loop)<0);
  if (outer.length!==1 || outer.length+holes.length!==loops.length) throw new Error('Completion requires one outer outline.');
  const gapFaces=holes.flatMap(loop=>triangulate([...loop].reverse(),positions));
  front.push(...gapFaces);
  const boundary=new Set(outer[0]), boundaryEdges=new Set(outer[0].map((a,i)=>key(a,outer[0][(i+1)%outer[0].length])));
  // Split internal boundary-to-boundary chords on the rear only. Without this,
  // the two sheets would touch along internal diagonals and create zero volume.
  const splits=new Map();
  for (const ids of front) for (let i=0;i<3;i++) {
    const a=ids[i],b=ids[(i+1)%3],k=key(a,b);
    if (boundary.has(a)&&boundary.has(b)&&!boundaryEdges.has(k)&&!splits.has(k)) {
      splits.set(k,positions.length);positions.push(positions[a].map((v,i)=>(v+positions[b][i])/2));
    }
  }
  const rear=[];
  for (const ids of front) {
    const mids=ids.map((a,i)=>splits.get(key(a,ids[(i+1)%3]))), count=mids.filter(n=>n!==undefined).length;
    if (count===3) {
      const [a,b,c]=ids,[ab,bc,ca]=mids;rear.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);
    } else if (count===2) {
      const i=mids.findIndex(n=>n===undefined),a=ids[i],b=ids[(i+1)%3],c=ids[(i+2)%3],bc=mids[(i+1)%3],ca=mids[(i+2)%3];
      rear.push([a,b,bc],[a,bc,ca],[ca,bc,c]);
    } else if (count===1) {
      const i=mids.findIndex(n=>n!==undefined),a=ids[i],b=ids[(i+1)%3],c=ids[(i+2)%3],m=mids[i];rear.push([a,m,c],[m,b,c]);
    } else if (ids.every(i=>boundary.has(i))) {
      const c=positions.length;positions.push([0,1,2].map(axis=>ids.reduce((s,i)=>s+positions[i][axis],0)/3));
      for(let i=0;i<3;i++)rear.push([ids[i],ids[(i+1)%3],c]);
    } else rear.push(ids);
  }
  const segments=outer[0].map((a,i)=>[positions[a],positions[outer[0][(i+1)%outer[0].length]]]);
  const distance=p=>Math.sqrt(Math.min(...segments.map(([a,b])=>{
    const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
    return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
  })));
  const distances=positions.map((p,i)=>boundary.has(i)?0:distance(p)), maximum=Math.max(...distances);
  if (!(maximum>0)) throw new Error('Completion has no interior.');
  const back=positions.map((p,i)=>[p[0],p[1],p[2]-recipe.depthMeters*unitsPerMeter*Math.sqrt(distances[i]/maximum)]);
  const added=[...gapFaces.map(ids=>ids.map(i=>positions[i])),...rear.map(ids=>[...ids].reverse().map(i=>back[i]))];
  if (added.length>recipe.faceBudget) throw new Error(`Completion requires ${added.length} faces; budget is ${recipe.faceBudget}.`);
  const faces=added.map(vertices=>{
    const [a,b,c]=vertices,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...n);
    if (!(length>0)) throw new Error('Degenerate estimated face.');
    const normal=n.map(v=>v/length);return {vertices,normal,estimated:true};
  });
  return {faces,report:{method:recipe.method,depthMeters:recipe.depthMeters,observedFaces:observed.length,
    addedFaces:faces.length,gapFaces:gapFaces.length,boundaryVertices:boundary.size,maximumOutlineDistanceMeters:maximum/unitsPerMeter,
    interpretation:'Illustrative depth envelope below the observed height field, tapered to its exact outline. Depth is assumed, not measured. Every added face is missing-data grid.'}};
}

/** Reduce the completed display mesh as one closed surface. The measured
 * source remains the independent geometry/material oracle. Vertices introduced
 * by the assumed rear can never become photographic or scalar faces. */
export async function reduceCompletedImageDem(observed, completion, recipe, scale) {
  if (!Number.isInteger(recipe.targetFaces) || recipe.targetFaces < 4 || recipe.targetFaces > 2000 ||
      !Number.isFinite(recipe.maximumErrorMeters) || !(recipe.maximumErrorMeters > 0)) throw new TypeError('Invalid completed mesh reduction.');
  const positions=[], lookup=new Map(), measured=new Set(observed.flatMap(f=>f.vertices.map(p=>p.join(','))));
  const sourceFlags=[];
  const indices=Uint32Array.from([...observed,...completion.faces].flatMap(f=>f.vertices.map(p=>{
    const k=p.join(',');if(!lookup.has(k)){lookup.set(k,positions.length);positions.push(p);sourceFlags.push(measured.has(k));}return lookup.get(k);
  })));
  await MeshoptSimplifier.ready;
  const [raw,error]=MeshoptSimplifier.simplify(indices,Float32Array.from(positions.flatMap(p=>p.map(v=>v/scale))),3,
    recipe.targetFaces*3,recipe.maximumErrorMeters,['ErrorAbsolute']);
  const reduced=removeOppositeFacePairs(raw);
  if(reduced.length/3>recipe.targetFaces)throw new Error('Completed mesh did not reach its face budget.');
  const faces=Array.from({length:reduced.length/3},(_,i)=>{
    const ids=[...reduced.slice(i*3,i*3+3)],vertices=ids.map(id=>positions[id]),[a,b,c]=vertices;
    const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...n);
    if(!(length>0))throw new Error('Completed mesh has a degenerate face.');
    return {vertices,normal:n.map(v=>v/length),...(!ids.every(id=>sourceFlags[id])||cross2(a,b,c)<=0?{estimated:true}:{})};
  });
  return {faces,report:{...completion.report,observedFaces:faces.filter(f=>!f.estimated).length,
    addedFaces:faces.filter(f=>f.estimated).length,reduction:{method:'meshoptimizer-closed-surface',version:'1.2.0',
      inputFaces:indices.length/3,targetFaces:recipe.targetFaces,outputFaces:faces.length,removedOppositeFaces:(raw.length-reduced.length)/3,estimatedErrorMeters:error,
      qualification:'Source fit is checked separately against the full measured DEM, excluding every estimated face.'}}};
}
