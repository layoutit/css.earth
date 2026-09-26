import type { NativeCameraRotation } from './native-camera.mts';
import { ORBIT_RENDERER_LOD_PIXELS } from '@cssearth/renderer/solar-system/prepared-orbit-lines.ts';

interface Level { readonly vertexIndices:readonly number[]; readonly deviationM:number }
interface Bounds { readonly centerM:readonly number[]; readonly radiusM:number }
const scalar=(n:number)=>String(n);

/** Prepare conservative groups and select the existing prepared chord banks.
 * CSS only projects groups that can enter the viewport. No orbit is rebuilt. */
export function prepareNativeOrbitCulling(root:HTMLElement,vertices:readonly (readonly number[])[],
  leaves:readonly (HTMLElement|SVGElement|undefined)[],levels:readonly Level[],bounds:Bounds|undefined,
  eye:(point:readonly number[])=>readonly number[],camera?:NativeCameraRotation):string {
  const rules:string[]=[];
  const project=(point:readonly number[])=>camera?.eyePoint(eye(point))??eye(point).map(scalar);
  root.style.containerName='native-orbit';
  if(bounds&&levels.length){
    const p=project(bounds.centerM);
    root.style.setProperty('--native-lod-nearest',`calc(-1 * ${p[2]} + var(--native-dolly-m) - ${bounds.radiusM})`);
    root.style.setProperty('--native-orbit-lod',`calc(${levels.map(level=>`clamp(0, sign(var(--native-lod-nearest) * ${ORBIT_RENDERER_LOD_PIXELS.bars} - ${level.deviationM} * (var(--native-focal) / 1px + hypot(50cqw / 1px,50cqh / 1px))),1)`).join(' + ')})`);
  }
  const endpoints=new Map<number,number[]>();
  for(let i=0;i<vertices.length;i++){
    const node=leaves[i];if(!node||node.namespaceURI!=='http://www.w3.org/1999/xhtml')throw new TypeError('Native orbit culling needs its prepared CSS chord.');
    endpoints.set(i,[(i+1)%vertices.length]);
    for(const axis of ['x','y','z']){
      node.style.setProperty(`--native-default-p1${axis}`,node.style.getPropertyValue(`--native-p1${axis}`));
      node.style.removeProperty(`--native-p1${axis}`);
    }
  }
  for(const [index,level] of levels.entries()){
    const n=index+1;
    for(const [j,vertex] of level.vertexIndices.entries()){
      const next=level.vertexIndices[(j+1)%level.vertexIndices.length],node=leaves[vertex]!;
      node.classList.add(`native-lod-${n}`);endpoints.get(vertex)!.push(next);
      // Written relative to the eye centre, like every chord endpoint the projection reads.
      const p=eye(vertices[next]);for(const [j,axis] of ['x','y','z'].entries())node.style.setProperty(`--native-next${n}${axis}`,scalar(p[j]-(camera?.eyeCentre[j]??0)));
    }
    rules.push(`@container native-orbit style(--native-orbit-lod:${n}){
      .native-orbit-segment:not(.native-lod-${n}){display:none}
      .native-lod-${n}{--native-p1x:var(--native-next${n}x);--native-p1y:var(--native-next${n}y);--native-p1z:var(--native-next${n}z)}
    }`);
  }
  // A sphere encloses all endpoints of these prepared straight chords,
  // including every prepared LOD endpoint that can replace one of them.
  for(let start=0;start<vertices.length;start+=8){
    const indices=Array.from({length:Math.min(8,vertices.length-start)},(_,i)=>start+i);
    const points=[...new Set(indices.flatMap(i=>[i,...endpoints.get(i)!]))].map(i=>vertices[i]);
    const center=[0,1,2].map(axis=>points.reduce((sum,p)=>sum+p[axis],0)/points.length);
    const radius=Math.max(...points.map(p=>Math.hypot(...p.map((n,i)=>n-center[i]))));
    const p=project(center),r=radius+Math.max(radius,...center.map(Math.abs),1)*1e-6;
    const block=root.ownerDocument.createElement('div');block.className='native-orbit-block';
    const members=root.ownerDocument.createElement('div');members.className='native-orbit-members';
    block.style.setProperty('--native-bound-x',p[0]);block.style.setProperty('--native-bound-y',p[1]);
    block.style.setProperty('--native-bound-depth',`calc(-1 * ${p[2]} + var(--native-dolly-m))`);
    block.style.setProperty('--native-bound-radius',scalar(r));
    for(const i of indices)members.append(leaves[i]!);block.append(members);root.append(block);
  }
  for(const retired of root.querySelectorAll('.context-orbit-block'))retired.remove();
  return rules.join('\n');
}

export const nativeOrbitCullingCss=`
@property --native-lod-nearest{syntax:'<number>';inherits:false;initial-value:0}
@property --native-orbit-lod{syntax:'<number>';inherits:false;initial-value:0}
@property --native-bound-x{syntax:'<number>';inherits:false;initial-value:0}
@property --native-bound-y{syntax:'<number>';inherits:false;initial-value:0}
@property --native-bound-depth{syntax:'<number>';inherits:false;initial-value:0}
@property --native-block-visible{syntax:'<number>';inherits:false;initial-value:0}
.native-orbit-segment { --native-p1x:var(--native-default-p1x);--native-p1y:var(--native-default-p1y);--native-p1z:var(--native-default-p1z) }
.native-orbit-block {
  position:absolute;inset:0;container-name:native-orbit-block;
  --native-bound-f:calc(var(--native-focal) / 1px);
  --native-bound-w:calc(50cqw / 1px + 2);--native-bound-h:calc(50cqh / 1px + 2);
  --native-block-visible:clamp(0,sign(min(
    var(--native-bound-depth) + var(--native-bound-radius) - 1,
    var(--native-bound-radius) * hypot(var(--native-bound-f),var(--native-bound-w)) + var(--native-bound-w) * var(--native-bound-depth) - abs(var(--native-bound-f) * var(--native-bound-x)),
    var(--native-bound-radius) * hypot(var(--native-bound-f),var(--native-bound-h)) + var(--native-bound-h) * var(--native-bound-depth) - abs(var(--native-bound-f) * var(--native-bound-y))
  )),1);
}
.native-orbit-members { display:contents }
@container native-orbit-block style(--native-block-visible:0){.native-orbit-members{display:none}}
`;
