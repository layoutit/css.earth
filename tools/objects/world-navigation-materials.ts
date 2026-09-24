import { invertPreparedAffineMatrix4, multiplyPreparedMatrix4, preparedRotationMatrix4 } from '../../src/platform/math/matrix.mts';
import type { AuthoredPresentationBasis } from './world-navigation-sources.js';

type Data = Record<string, any>;
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

/** Add only numerical projection metadata. The accepted affine material,
 * its atlas addresses, resources and retained tree remain the same objects. */
export function preparePhysicalMaterialTracks({definition,bodyToPresentation,sourceRadiusUnits,tilePixels,physicalShape,sources,refreshPhysical=false}:AuthoredPresentationBasis & {
  definition:Data;physicalShape:{equatorialRadiusM:number;polarRadiusM:number};sources:ReadonlyMap<string,Data>;
  /** The physical projection is derived from the solved system node, so a re-prepared body replaces the one it carried. */
  refreshPhysical?:boolean;
}):Data {
  const tree=definition.tree,body=matrix4(bodyToPresentation);
  const equatorialRadius=sourceRadiusUnits*tilePixels;
  const polarRadius=equatorialRadius*physicalShape.polarRadiusM/physicalShape.equatorialRadiusM;
  if(![equatorialRadius,polarRadius].every(value=>Number.isFinite(value)&&value>0))throw new TypeError('Physical material needs positive authored radii.');
  const materials=definition.materials.map((track:Data)=>{
    const {physical:carried,...rotation}=track.rotation??{};
    if(!track.rotation || rotation.kind==='ellipsoid' || (carried&&!refreshPhysical))return track;
    const chain:number[]=[];let cursor=track.target;
    while(cursor!==tree.scene){
      if(cursor===-1&&definition.viewBindings.some((binding:Data)=>binding.kind==='silhouette-fit'&&chain.includes(binding.target)))return track;
      if(!Number.isSafeInteger(cursor)||cursor<0||chain.includes(cursor)||!tree.nodes[cursor])throw new TypeError('Physical material must close over its prepared scene.');
      chain.unshift(cursor);cursor=tree.nodes[cursor].parent;
    }
    const counter=definition.viewBindings.find((binding:Data)=>binding.kind==='counter-rotation'&&chain.includes(binding.target));
    if(!counter)throw new TypeError('Physical material needs its actual prepared counter binding.');
    const counterIndex=chain.indexOf(counter.target),target=tree.nodes[track.target];
    const width=rotation.width??pixelSize(target,'--polycss-atlas-width')??sources.get('atmosphere')?.size;
    const height=rotation.height??pixelSize(target,'--polycss-atlas-height')??width;
    if(![width,height].every(value=>Number.isFinite(value)&&value>0))throw new TypeError('Physical material needs authored texture dimensions.');
    const product=(nodes:number[])=>nodes.reduce((left,node)=>multiplyPreparedMatrix4(left,nodeMatrix(tree,node)),identity);
    const materialSystemMatrix=product(chain.slice(0,counterIndex));
    const materialMeshMatrix=product(chain.slice(counterIndex+1,-1));
    const baseProjection=nodeMatrix(tree,track.target);
    const material=multiplyPreparedMatrix4(multiplyPreparedMatrix4(materialSystemMatrix,materialMeshMatrix),baseProjection);
    const inverse=invertPreparedAffineMatrix4(material),local=multiplyPreparedMatrix4(inverse,body);
    // Calibrate the body's footprint in the already-accepted texture plane.
    // This retains padding, atmosphere extent and non-circular raster contours;
    // no radius is guessed from a planet id or sampled from an image.
    const radii=[equatorialRadius,equatorialRadius,polarRadius];
    const covariance=(a:number,b:number)=>[0,4,8].reduce((sum,column,index)=>sum+local[column+a]*local[column+b]*radii[index]**2,0);
    const textureEllipse={center:[local[12],local[13]],covariance:[covariance(0,0),covariance(0,1),covariance(1,1)]};
    return {...track,rotation:{...rotation,physical:{width,height,systemTransform:counter.systemTransform||`matrix3d(${identity})`,projection:{
      equatorialRadius,polarRadius,coverageScale:1,bodySystemMatrix:body,bodyMeshMatrix:identity,
      materialSystemMatrix,materialMeshMatrix,baseProjection,
      centerTranslation:[...identity.slice(0,12),width/2,height/2,0,1],
      inverseCenterTranslation:[...identity.slice(0,12),-width/2,-height/2,0,1],textureEllipse,
    }}}};
  });
  return {...definition,materials};
}

function pixelSize(node:Data,name:string):number|undefined {
  const match=String(node.style).match(new RegExp(`(?:^|;)${name}:([\\d.]+)px(?:;|$)`));
  return match?Number(match[1]):undefined;
}
function nodeMatrix(tree:Data,index:number):number[] {
  const node=tree.nodes[index],bound=node.properties.map((index:number)=>tree.properties[index]).find((property:Data)=>property.name==='transform');
  const transform=bound?.value??String(node.style).match(/(?:^|;)transform:([^;]+)/u)?.[1]??'';
  return parsePreparedTransform(transform);
}
function matrix4(rotation:readonly number[]):number[] {
  if(rotation.length!==9||!rotation.every(Number.isFinite))throw new TypeError('Physical material body axes are invalid.');
  return [rotation[0],rotation[3],rotation[6],0,rotation[1],rotation[4],rotation[7],0,rotation[2],rotation[5],rotation[8],0,0,0,0,1];
}
function parsePreparedTransform(input:string):number[] {
  const value=input.trim();if(!value||value==='none')return [...identity];
  let remaining=value,result=[...identity];
  for(const match of value.matchAll(/([A-Za-z0-9]+)\(([^()]*)\)/gu)){
    const name=match[1],parts=match[2].split(/[ ,]+/u).filter(Boolean),numbers=parts.map(Number.parseFloat);let next:number[];
    if(numbers.some(value=>!Number.isFinite(value)))throw new TypeError('Physical material transform must be numerical prepared data.');
    if(name==='matrix3d'&&numbers.length===16)next=numbers;
    else if(/^rotate[XYZ]?$/u.test(name)&&numbers.length===1&&parts[0].endsWith('deg'))next=preparedRotationMatrix4(name.length===6?'z':name.slice(-1).toLowerCase(),numbers[0]);
    else if(name==='scale'&&numbers.length>=1&&numbers.length<=2)next=[numbers[0],0,0,0,0,numbers[1]??numbers[0],0,0,0,0,1,0,0,0,0,1];
    else if(name==='scale3d'&&numbers.length===3)next=[numbers[0],0,0,0,0,numbers[1],0,0,0,0,numbers[2],0,0,0,0,1];
    else if(name==='translate3d'&&numbers.length===3)next=[...identity.slice(0,12),...numbers,1];
    else throw new TypeError(`Unsupported physical material transform ${name}.`);
    result=multiplyPreparedMatrix4(result,next);remaining=remaining.replace(match[0],'');
  }
  if(remaining.trim())throw new TypeError('Unparsed physical material transform.');
  return result;
}
