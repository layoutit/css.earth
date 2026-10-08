/** Read prepared geometry and atlas addresses without loading source preparation or refresh commands. */
import { BASE_TILE } from '@layoutit/polycss';
import { requireRecord, requireArray, requireFiniteNumber, requireString } from '@cssearth/core';
import { TEXELS_PER_CSS_PIXEL } from '@cssearth/objects';
import { shadeRadialFaces } from '../../geometry/index.ts';
import type { PhotographicAtlas } from './native-photograph.ts';
const records=(value:unknown)=>requireArray(value).map(value=>requireRecord(value));

const vector=(value:unknown)=>{const result=requireArray(value).map(value=>requireFiniteNumber(value));if(result.length!==3)throw new Error('Expected a 3D point.');return result;};

/** The scene a shape body's bake wrote beside its runtime, read back from the runtime. The runtime holds the same camera,
 * sky, Sun and system transform, the same triangles and dataset ranges (its hit surface), and one face node a triangle
 * in the same order with the same matrix and atlas address: 406 of 406 bodies, 2026-10-08. So no scene is delivered for
 * these bodies (packages/objects/src/node/prepared-delivery.ts), and a refresh reads this. */
export function retainedScene(runtime:Record<string,unknown>) {
  const id=requireString(runtime.id),hit=requireRecord(runtime.surfaceHit),nodes=records(requireRecord(runtime.tree).nodes);
  const classes=(node:Record<string,unknown>)=>typeof node.className==='string'?node.className.split(' '):[];
  const carrier=nodes.find(node=>classes(node).includes(`${id}-system`)),transform=carrier&&requireString(carrier.style);
  if(!transform?.startsWith('transform:'))throw new Error(`${id}: the runtime holds no system carrier.`);
  return {camera:runtime.camera,sky:runtime.sky,sun:runtime.sun,systemTransform:transform.slice('transform:'.length),
    surfaceTriangles:requireArray(hit.triangles),...(hit.datasetRanges===undefined?{}:{surfaceDatasetRanges:hit.datasetRanges}),
    bodyLeaves:nodes.filter(node=>node.tag==='u'&&classes(node).includes(`${id}-terrain-face`)).map(node=>({tag:'u',className:node.className,style:requireString(node.style)}))};
}

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
    // The inverse of rasterLeafStyle (radial/radial-terrain.ts): the leaf's box is written at TEXELS_PER_CSS_PIXEL, with its
    // matrix scaling the box back, and a plan counts atlas texels.
    const texels=(pattern:RegExp)=>numbers(pattern).map(value=>value*TEXELS_PER_CSS_PIXEL);
    const matrix=numbers(/transform:matrix3d\(([^)]+)\)/).map((value,i)=>i<8?value/TEXELS_PER_CSS_PIXEL:value);
    const [x,y]=texels(/background-position:([^;]+)/),[w,h]=texels(/background-size:([^;]+)/);
    // A face's size: the bake's custom properties, or the box the runtime draws the same face with.
    const [tw]=texels(/(?:--polycss-atlas-|;)width:([^;]+)/),[th]=texels(/(?:--polycss-atlas-|;)height:([^;]+)/);
    if(leaf.tag!=='u' || matrix.length!==16 || ![...matrix,x,y,w,h,tw,th].every(Number.isFinite) ||
      (index>0 && (w!==width || h!==height)))throw new Error('Unsupported retained atlas layout.');
    // Faces and triangles pair by position. A face's matrix carries its triangle's normal (largest difference 5e-10 over
    // 280,378 faces, 2026-10-08), so a record whose order changed is refused here.
    const normal=triangles[index].normal;
    if(Math.max(Math.abs(matrix[8]-normal[1]),Math.abs(matrix[9]-normal[0]),Math.abs(matrix[10]-normal[2]))>1e-6)throw new Error('A retained face does not lie on its triangle.');
    width=w;height=h;
    return {face:faces[index],matrix,rect:{x:0-x,y:0-y,width:tw,height:th},geometry:{leafWidth:tw,leafHeight:th}};
  });
  return {width,height,plans};
}

/** Select an existing model without changing a triangle, camera, or atlas address. */
export function retainedShapeAtlas(scene: Record<string, unknown>, datasetId: string) {
  const ranges = scene.surfaceDatasetRanges === undefined ? [] : records(scene.surfaceDatasetRanges);
  const range = ranges.find(range => range.datasetId === datasetId);
  if (ranges.length && !range) throw new Error(`Shape dataset has no retained geometry: ${datasetId}.`);
  const triangles = requireArray(scene.surfaceTriangles), leaves = requireArray(scene.bodyLeaves);
  const start = range ? requireFiniteNumber(range.start) : 0, count = range ? requireFiniteNumber(range.count) : triangles.length;
  if (![start, count].every(Number.isSafeInteger) || start < 0 || count < 1 || start + count > triangles.length || leaves.length !== triangles.length)
    throw new Error('Invalid retained shape range.');
  const atlas = retainedPhotographicAtlas({ surfaceTriangles: triangles.slice(start, start + count), bodyLeaves: leaves.slice(start, start + count) });
  return { ...atlas, faces: atlas.plans.map(plan => plan.face) };
}
