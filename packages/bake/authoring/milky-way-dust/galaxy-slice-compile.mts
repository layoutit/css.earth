/** Grow prepared image leaves in the accepted leaf's affine/raster calibration. */
import {compileCssVolume} from '@cssearth/bake/volume-leaves';
import {validatePreparedCssVolume,type PreparedCssVolume} from '@cssearth/objects';
import {galaxySlices,record} from './galaxy-slices.mts';

function numeric(value:unknown):number{
 if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError('Expected finite image calibration.');return value;
}
function px(text:string):number{
 if(!/^-?[\d.]+px$/u.test(text))throw new TypeError('Expected prepared pixel size.');return numeric(Number(text.slice(0,-2)));
}
function vector(input:unknown,length:number):number[]{
 if(!Array.isArray(input)||input.length!==length)throw new TypeError('Invalid image crop.');return input.map(numeric);
}
export function compileGalaxySliceVolume(input:unknown,physicalFrame:unknown,directory:string,id:string):PreparedCssVolume{
 const data=record(input),prepared=galaxySlices(data,physicalFrame,directory);
 const compiled=compileCssVolume({id,frame:prepared.frame,slices:prepared.slices,recipe:{anchors:[]}});
 if(!record(data.bakeControls??{}).inPlaneField)return compiled;
 if(!Array.isArray(data.leaves))throw new TypeError('Missing extended image leaves.');
 const inputs=data.leaves.map(record);
 const dims=vector(record(data.field).dims,3);
 const canonical=galaxySlices({...data,leaves:inputs.map(leaf=>{
  const crop=vector(leaf.canonicalCrop,4),a='xyz'.indexOf(String(leaf.axis)),h=a===0?1:0,v=a===2?1:2;
  if(!crop.every(n=>Number.isInteger(n)&&n>=0)||crop[2]!==dims[h]||crop[3]!==dims[v]||crop[0]!+crop[2]!>numeric(leaf.width)||crop[1]!+crop[3]!>numeric(leaf.height))throw new TypeError('Invalid canonical image crop.');
  return {...leaf,imageBounds:undefined,width:crop[2],height:crop[3]};
 })},physicalFrame,directory);
 const base=compileCssVolume({id,frame:canonical.frame,slices:canonical.slices,recipe:{anchors:[]}});
 return validatePreparedCssVolume({...compiled,stacks:compiled.stacks.map((stack,i)=>({...stack,leaves:stack.leaves.map(leaf=>{
  const previous=base.stacks[i]!.leaves.find(l=>l.id===leaf.id),source=inputs.find(l=>`b30-slices/${String(l.texturePath)}`===leaf.texturePath);
  if(!previous||!source)throw new TypeError('Missing canonical image calibration.');
  const [x,y,w,h]=vector(source.canonicalCrop,4);
  const text=previous.style.transform;
  if(!text.startsWith('matrix3d(')||!text.endsWith(')'))throw new TypeError('Expected affine image calibration.');
  const matrix=text.slice(9,-1).split(',').map(Number);
  if(matrix.length!==16||matrix.some(n=>!Number.isFinite(n))||matrix[3]!==0||matrix[7]!==0||matrix[11]!==0||matrix[15]!==1)throw new TypeError('Expected finite affine image calibration.');
  const sx=px(previous.style.width)/w!,sy=px(previous.style.height)/h!;
  if(x!*sx%1!==0||y!*sy%1!==0)throw new TypeError('Image border changes the canonical CSS raster phase.');
  const width=leaf.widthPx*sx,height=leaf.heightPx*sy;
  for(let a=0;a<3;a++)matrix[12+a]=matrix[12+a]!-matrix[a]!*x!*sx-matrix[4+a]!*y!*sy;
  // Preserve matrix columns exactly, including the accepted PolyCSS edge extension.
  const style={...previous.style,width:width+'px',height:height+'px',backgroundSize:width+'px '+height+'px',transform:'matrix3d('+matrix.map(n=>Number(n.toFixed(6))).join(',')+')'};
  const points=[[0,0],[width,0],[width,height],[0,height]].map(([u,v])=>[0,1,2].map(a=>matrix[a]!*u!+matrix[4+a]!*v!+matrix[12+a]!));
  const triple=(values:number[]):readonly[number,number,number]=>[values[0]!,values[1]!,values[2]!];
  const boundsCssPixels={min:triple([0,1,2].map(a=>Math.min(...points.map(p=>p[a]!)))),max:triple([0,1,2].map(a=>Math.max(...points.map(p=>p[a]!))))};
  return {...leaf,style,boundsCssPixels};
 })}))});
}
