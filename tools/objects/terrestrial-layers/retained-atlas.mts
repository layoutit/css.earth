/** Read prepared geometry and atlas addresses without loading source preparation or refresh commands. */
import { BASE_TILE } from '@layoutit/polycss';
import { requireRecord, requireArray, requireFiniteNumber, requireString } from '@cssearth/core';
import { shadeRadialFaces } from './radial-mesh.mts';
import type { PhotographicAtlas } from './native-photograph.mts';
const records=(value:unknown)=>requireArray(value).map(value=>requireRecord(value));

const vector=(value:unknown)=>{const result=requireArray(value).map(value=>requireFiniteNumber(value));if(result.length!==3)throw new Error('Expected a 3D point.');return result;};

/** Recover the exact retained triangles and texture layout; never simplify or replan. */
export function retainedPhotographicAtlas(scene:Record<string,unknown>):PhotographicAtlas {
  const triangles=requireArray(scene.surfaceTriangles).map(value=>{
    const vertices=requireArray(value).map(value=>{const v=vector(value);return [v[1]/BASE_TILE,v[0]/BASE_TILE,v[2]/BASE_TILE];});
    if(vertices.length!==3)throw new Error('Expected one retained triangle.');
    const [a,b,c]=vertices,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...normal);
    if(!(length>0))throw new Error('Degenerate retained face.');
    return {vertices,normal:normal.map(n=>n/length)};
  });
  const faces=shadeRadialFaces(triangles),leaves=records(scene.bodyLeaves);
  if(leaves.length!==faces.length)throw new Error('Retained atlas and triangle count disagree.');
  let width=0,height=0;
  const plans=leaves.map((leaf,index)=>{
    const style=requireString(leaf.style);
    const numbers=(pattern:RegExp)=>{const match=style.match(pattern);if(!match)throw new Error('Missing retained atlas property.');return match[1].split(/[ ,]+/).map(value=>parseFloat(value));};
    const matrix=numbers(/transform:matrix3d\(([^)]+)\)/),[x,y]=numbers(/background-position:([^;]+)/),[w,h]=numbers(/background-size:([^;]+)/);
    const [tw]=numbers(/--polycss-atlas-width:([^;]+)/),[th]=numbers(/--polycss-atlas-height:([^;]+)/);
    if(leaf.tag!=='u' || matrix.length!==16 || ![...matrix,x,y,w,h,tw,th].every(Number.isFinite) ||
      (index>0 && (w!==width || h!==height)))throw new Error('Unsupported retained atlas layout.');
    width=w;height=h;
    return {face:faces[index],matrix,rect:{x:-x,y:-y,width:tw,height:th},geometry:{leafWidth:tw,leafHeight:th}};
  });
  return {width,height,plans};
}

/** Select an existing model without changing a triangle, camera, or atlas address. */
export function retainedShapeAtlas(scene: Record<string, unknown>, lensId: string) {
  const ranges = scene.surfaceLensRanges === undefined ? [] : records(scene.surfaceLensRanges);
  const range = ranges.find(range => range.lensId === lensId);
  if (ranges.length && !range) throw new Error(`Shape lens has no retained geometry: ${lensId}.`);
  const triangles = requireArray(scene.surfaceTriangles), leaves = requireArray(scene.bodyLeaves);
  const start = range ? requireFiniteNumber(range.start) : 0, count = range ? requireFiniteNumber(range.count) : triangles.length;
  if (![start, count].every(Number.isSafeInteger) || start < 0 || count < 1 || start + count > triangles.length || leaves.length !== triangles.length)
    throw new Error('Invalid retained shape range.');
  const atlas = retainedPhotographicAtlas({ surfaceTriangles: triangles.slice(start, start + count), bodyLeaves: leaves.slice(start, start + count) });
  return { ...atlas, faces: atlas.plans.map(plan => plan.face) };
}
