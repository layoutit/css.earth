import { invertPreparedAffineMatrix4, multiplyPreparedMatrix4, preparedRotationMatrix4 } from '@cssearth/core';
import type { AuthoredPresentationBasis } from './world-navigation-sources.ts';

/** A prepared runtime definition or authored source, read as JSON. The reads below keep JavaScript's own property semantics,
 * so an ill-formed record fails, or is accepted, exactly where an untyped read would, with the same TypeError. */
type Value = unknown;
type Fields = Readonly<Record<string, Value>>;
/** `value?.[key]`: undefined for null or undefined, else the property as JavaScript reads it. */
const optional = (value: Value, key: Value): Value =>
  value === null || value === undefined ? undefined : (Object(value) as Fields)[String(key)];
/** `value[key]`: a required read, failing on null or undefined with JavaScript's own TypeError. */
function required(value: Value, key: Value): Value {
  if (value === null || value === undefined) throw new TypeError(`Cannot read properties of ${String(value)} (reading '${String(key)}')`);
  return optional(value, key);
}
/** `target.method(callback)` for a JSON value: only an array has the method, and anything else fails as the call would. */
function arrayCall<T>(target: Value, method: 'map' | 'some' | 'find', expression: string, callback: (value: Value) => T): Value {
  if (Array.isArray(target)) return (target as Value[])[method]((value: Value) => callback(value) as never);
  if (target === null || target === undefined) throw new TypeError(`Cannot read properties of ${String(target)} (reading '${method}')`);
  throw new TypeError(`${expression} is not a function`);
}
/** A JSON value as object spread reads it: its own enumerable properties, `__proto__` included, and nothing for null. */
const boxed = (value: Value): object => Object(value);
const positive = (value: Value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

/** Add only numerical projection metadata. The accepted affine material,
 * its atlas addresses, resources and retained tree remain the same objects: the result is the definition with its materials
 * replaced. */
export function preparePhysicalMaterialTracks<Definition extends object>({definition,bodyToPresentation,sourceRadiusUnits,tilePixels,physicalShape,sources,refreshPhysical=false}:AuthoredPresentationBasis & {
  definition:Definition;physicalShape:{equatorialRadiusM:number;polarRadiusM:number};sources:ReadonlyMap<string,Value>;
  /** The physical projection is derived from the solved system node, so a re-prepared body replaces the one it carried. */
  refreshPhysical?:boolean;
}):Definition & {materials:Value} {
  const tree=required(definition,'tree'),body=matrix4(bodyToPresentation);
  const equatorialRadius=sourceRadiusUnits*tilePixels;
  const polarRadius=equatorialRadius*physicalShape.polarRadiusM/physicalShape.equatorialRadiusM;
  if(![equatorialRadius,polarRadius].every(value=>Number.isFinite(value)&&value>0))throw new TypeError('Physical material needs positive authored radii.');
  const materials=arrayCall(required(definition,'materials'),'map','definition.materials.map',(track:Value)=>{
    const {physical:carried,...rotation}:Fields=Object(required(track,'rotation')??{});
    if(!required(track,'rotation') || rotation.kind==='ellipsoid' || (carried&&!refreshPhysical))return track;
    const chain:Value[]=[];let cursor=required(track,'target');
    while(cursor!==required(tree,'scene')){
      if(cursor===-1&&arrayCall(required(definition,'viewBindings'),'some','definition.viewBindings.some',(binding:Value)=>required(binding,'kind')==='silhouette-fit'&&chain.includes(required(binding,'target'))))return track;
      if(!Number.isSafeInteger(cursor)||(typeof cursor==='number'&&cursor<0)||chain.includes(cursor)||!required(required(tree,'nodes'),cursor))throw new TypeError('Physical material must close over its prepared scene.');
      chain.unshift(cursor);cursor=required(required(required(tree,'nodes'),cursor),'parent');
    }
    const counter=arrayCall(required(definition,'viewBindings'),'find','definition.viewBindings.find',(binding:Value)=>required(binding,'kind')==='counter-rotation'&&chain.includes(required(binding,'target')));
    if(!counter)throw new TypeError('Physical material needs its actual prepared counter binding.');
    const counterIndex=chain.indexOf(required(counter,'target')),target=required(required(tree,'nodes'),required(track,'target'));
    const width=rotation.width??pixelSize(target,'--polycss-atlas-width')??optional(sources.get('atmosphere'),'size');
    const height=rotation.height??pixelSize(target,'--polycss-atlas-height')??width;
    if(!positive(width)||!positive(height))throw new TypeError('Physical material needs authored texture dimensions.');
    const product=(nodes:Value[])=>nodes.reduce<number[]>((left,node)=>multiplyPreparedMatrix4(left,nodeMatrix(tree,node)),identity);
    const materialSystemMatrix=product(chain.slice(0,counterIndex));
    const materialMeshMatrix=product(chain.slice(counterIndex+1,-1));
    const baseProjection=nodeMatrix(tree,required(track,'target'));
    const material=multiplyPreparedMatrix4(multiplyPreparedMatrix4(materialSystemMatrix,materialMeshMatrix),baseProjection);
    const inverse=invertPreparedAffineMatrix4(material),local=multiplyPreparedMatrix4(inverse,body);
    // Calibrate the body's footprint in the already-accepted texture plane.
    // This retains padding, atmosphere extent and non-circular raster contours;
    // no radius is guessed from a planet id or sampled from an image.
    const radii=[equatorialRadius,equatorialRadius,polarRadius];
    const covariance=(a:number,b:number)=>[0,4,8].reduce((sum,column,index)=>sum+local[column+a]!*local[column+b]!*radii[index]!**2,0);
    const textureEllipse={center:[local[12],local[13]],covariance:[covariance(0,0),covariance(0,1),covariance(1,1)]};
    return {...boxed(track),rotation:{...rotation,physical:{width,height,systemTransform:required(counter,'systemTransform')||`matrix3d(${identity})`,projection:{
      equatorialRadius,polarRadius,coverageScale:1,bodySystemMatrix:body,bodyMeshMatrix:identity,
      materialSystemMatrix,materialMeshMatrix,baseProjection,
      centerTranslation:[...identity.slice(0,12),width/2,height/2,0,1],
      inverseCenterTranslation:[...identity.slice(0,12),-width/2,-height/2,0,1],textureEllipse,
    }}}};
  });
  return {...definition,materials};
}

function pixelSize(node:Value,name:string):number|undefined {
  const match=String(required(node,'style')).match(new RegExp(`(?:^|;)${name}:([\\d.]+)px(?:;|$)`));
  return match?Number(match[1]):undefined;
}
function nodeMatrix(tree:Value,index:Value):number[] {
  const node=required(required(tree,'nodes'),index);
  const bound=arrayCall(arrayCall(required(node,'properties'),'map','node.properties.map',(entry:Value)=>required(required(tree,'properties'),entry)),
    'find','node.properties.map(...).find',(property:Value)=>required(property,'name')==='transform');
  const transform=optional(bound,'value')??String(required(node,'style')).match(/(?:^|;)transform:([^;]+)/u)?.[1]??'';
  return parsePreparedTransform(transform);
}
function matrix4(rotation:readonly number[]):number[] {
  if(rotation.length!==9||!rotation.every(Number.isFinite))throw new TypeError('Physical material body axes are invalid.');
  return [rotation[0]!,rotation[3]!,rotation[6]!,0,rotation[1]!,rotation[4]!,rotation[7]!,0,rotation[2]!,rotation[5]!,rotation[8]!,0,0,0,0,1];
}
/** A node transform read as CSS text; any other value fails with the TypeError calling `input.trim` on it would raise. */
function parsePreparedTransform(input:Value):number[] {
  if(typeof input!=='string'){
    if(input===null||input===undefined)throw new TypeError(`Cannot read properties of ${String(input)} (reading 'trim')`);
    throw new TypeError('input.trim is not a function');
  }
  const value=input.trim();if(!value||value==='none')return [...identity];
  let remaining=value,result=[...identity];
  for(const match of value.matchAll(/([A-Za-z0-9]+)\(([^()]*)\)/gu)){
    const name=match[1]!,parts=match[2]!.split(/[ ,]+/u).filter(Boolean),numbers=parts.map(Number.parseFloat);let next:number[];
    if(numbers.some(value=>!Number.isFinite(value)))throw new TypeError('Physical material transform must be numerical prepared data.');
    if(name==='matrix3d'&&numbers.length===16)next=numbers;
    else if(/^rotate[XYZ]?$/u.test(name)&&numbers.length===1&&parts[0]!.endsWith('deg'))next=preparedRotationMatrix4(name.length===6?'z':name.slice(-1).toLowerCase(),numbers[0]!);
    else if(name==='scale'&&numbers.length>=1&&numbers.length<=2)next=[numbers[0]!,0,0,0,0,numbers[1]??numbers[0]!,0,0,0,0,1,0,0,0,0,1];
    else if(name==='scale3d'&&numbers.length===3)next=[numbers[0]!,0,0,0,0,numbers[1]!,0,0,0,0,numbers[2]!,0,0,0,0,1];
    else if(name==='translate3d'&&numbers.length===3)next=[...identity.slice(0,12),...numbers,1];
    else throw new TypeError(`Unsupported physical material transform ${name}.`);
    result=multiplyPreparedMatrix4(result,next);remaining=remaining.replace(match[0],'');
  }
  if(remaining.trim())throw new TypeError('Unparsed physical material transform.');
  return result;
}
