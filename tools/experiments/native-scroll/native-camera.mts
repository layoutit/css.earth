import type { ObjectRuntimeDefinition } from '../../../src/renderers/css/runtime/object-runtime-types.js';
import type { ObjectSelection } from '../../../src/renderers/css/runtime/object-contract.js';
import type { PreparedWorldCameraFrame } from '../../../src/renderers/css/navigation/world-camera.js';
import type { publishPreparedNativeView } from '../../../src/renderers/css/rendering/prepared-native-view.js';
import { selectedPreparedVariant } from '../../../src/renderers/css/rendering/prepared-presentation.js';
import { readPreparedTransform } from '../../../src/renderers/css/navigation/prepared-camera-basis.js';
import { readPreparedMatrix4 } from '../../../src/renderers/css/prepared-data/prepared-ellipsoid-projection.js';
import type { PreparedMaterialRotation } from '../../../src/renderers/css/rendering/prepared-material.js';
import { CssValues } from './css-values.mts';
import type { Matrix, Value } from './css-values.mts';

export interface NativeCameraRotation {
  readonly transform: string;
  readonly css: string;
  /** The eye centre, in metres, that eyePoint subtracts. */
  readonly eyeCentre: readonly number[];
  eyePoint(point: readonly Value[]): readonly string[];
  /** Like eyePoint, for coordinates already written relative to eyeCentre. */
  eyeOffsetPoint(offset: readonly string[]): readonly string[];
  skyPoint(point: readonly number[], metersPerPixel: number): readonly string[];
}
type Publication = ReturnType<typeof publishPreparedNativeView>;
type EllipsoidRotation = Extract<PreparedMaterialRotation,{kind:'ellipsoid'}>;
type Covariance = readonly [Value,Value,Value];
type PairMatrix = readonly [Value,Value,Value,Value];

/** Experimental CSS publication of the same prepared camera/material inputs.
 * All expressions are emitted in the response; the browser runs no publisher. */
export function addNativeCamera(document: Document, definition: ObjectRuntimeDefinition,
  selection: ObjectSelection, frame: PreparedWorldCameraFrame, publication: Publication,
  options: { surfaceOnly?: boolean } = {}): NativeCameraRotation {
  if (!publication.view.projection) throw new TypeError('Native drag requires a physical camera.');
  if (definition.depthPartitions || definition.facing?.length || definition.features || definition.animations.length) {
    throw new TypeError('This camera experiment has not yet compiled this object’s extra view bindings.');
  }
  const values=new CssValues();
  const initial=readPreparedMatrix4(publication.view.sceneMatrix);
  const turn=values.chain(values.rotation('x','var(--native-pitch)'),values.rotation('y','var(--native-yaw)'));
  const rotation=values.multiply(turn,initial);
  const counter=values.multiply(values.inverse(rotation),readPreparedMatrix4(publication.view.reference.sceneMatrix));
  const oldEye=publication.view.projection.eyeFromScene;
  const centre=oldEye.slice(12,15);
  const eye=[...rotation].map((v,i)=>i<12?values.mul(v,definition.camera.sceneScale):v);
  eye[12]=centre[0];eye[13]=centre[1];
  eye[14]=values.sub(centre[2],values.value(`var(--native-dolly-m) / ${frame.metersPerUnit}`));
  const scene=publication.nodes[definition.tree.scene];
  scene.style.transform=`translate3d(${centre[0]}px,${centre[1]}px,calc(var(--native-focal) + ${centre[2]}px)) scale3d(${definition.camera.sceneScale},${definition.camera.sceneScale},${definition.camera.sceneScale}) ${values.outputMatrix(rotation)}`;
  for(const binding of definition.viewBindings){
    // A portable measurement view stays on the prepared geometry lane. Its
    // bounded dolly never reaches the billboard/marker transition.
    if(options.surfaceOnly && binding.kind==='view-attribute') {
      if(binding.source!=='level-of-detail-stage') (binding.target===-1?document.querySelector('.planet-stage')!:publication.nodes[binding.target]).removeAttribute(binding.property);
      continue;
    }
    if(options.surfaceOnly && binding.kind==='view-property') { publication.nodes[binding.target].style.setProperty(binding.property,'0'); continue; }
    if(options.surfaceOnly && binding.kind==='interior-disc' && !selection.interior) { publication.nodes[binding.target].style.visibility='hidden'; continue; }
    if(options.surfaceOnly && binding.kind==='silhouette-fit') {
      publication.nodes[binding.target].style.transform=`scale(calc(max(${binding.minimumRadius}, var(--native-radius-px)) * ${binding.unitScale}))`;
      continue;
    }
    if(options.surfaceOnly && binding.kind==='silhouette-step-property') {
      const terms=binding.levels.slice(1).map((level,i)=>`${Number(level.value)-Number(binding.levels[i].value)} * clamp(0, 1 + sign(var(--native-radius-px) * 2 - ${level.minimumDiameter}), 1)`);
      if(binding.levels.some(level=>!Number.isFinite(Number(level.value)))) throw new TypeError('Native silhouette steps require numeric prepared values.');
      publication.nodes[binding.target].style.setProperty(binding.property,`calc(${binding.levels[0].value} + ${terms.join(' + ') || '0'})`);
      continue;
    }
    if(binding.kind!=='counter-rotation') throw new TypeError(`Uncompiled native view binding: ${binding.kind}`);
    const local=readPreparedTransform(binding.systemTransform);
    publication.nodes[binding.target].style.transform=values.outputMatrix(values.chain(values.inverse(local),counter,local));
  }
  if(!definition.sun?.localDirection) throw new TypeError('Native material projection requires its prepared Sun direction.');
  const sun=definition.sun.localDirection;
  const direction=[0,1,2].map(row=>values.dot([rotation[row],rotation[row+4],rotation[row+8]],sun));
  const length=values.sqrt(values.dot(direction,direction));
  const phase=values.div(direction[2],length);
  const reference=publication.view.reference.sunViewDirection;
  if(!reference) throw new TypeError('Native material projection requires its reference light direction.');
  const referenceAngle=Math.atan2(reference[1],reference[0])*180/Math.PI;
  const lightAngle=`calc(atan2(${direction[1]},${direction[0]}) - ${referenceAngle}deg)`;
  const resources=new Map(definition.assets.entries.map(entry=>[entry.key,entry.url]));
  const rules:string[]=[];
  for(const selected of selectedPreparedVariant(definition,selection).materials){
    if(!selected.enabled) continue;
    const track=definition.materials.find(track=>track.id===selected.track);
    if(!track) throw new TypeError('Missing prepared material track.');
    const bank=track.banks.find(bank=>bank.id===selected.bank);
    if(!bank) throw new TypeError('Missing prepared material bank.');
    const node=publication.nodes[track.target];
    if(selected.mode!=='fixed'){
      const mapping=track.frame;
      const step=mapping.thresholds[1]-mapping.thresholds[0];
      const indexStep=mapping.indices[1]-mapping.indices[0];
      const regular=step>0&&mapping.thresholds.every((n,i)=>Math.abs(n-(mapping.thresholds[0]+step*i))<1e-12)
        &&mapping.indices.every((n,i)=>n===mapping.indices[0]+indexStep*i);
      if(!regular) throw new TypeError('This experiment requires a regularly prepared phase lookup.');
      const count=values.value(`clamp(0, round(down, (${phase} - ${mapping.thresholds[0]}) / ${step}, 1) + 1, ${mapping.thresholds.length})`);
      const index=selected.frameOverride??values.sum(mapping.indices[0],values.mul(count,indexStep),selected.frameOffset??0);
      const name=`native-material-${track.target}`;
      const frames=bank.frames.map((address,i)=>{
        const url=address.resource===null?null:resources.get(address.resource);
        if(address.resource!==null&&!url) throw new TypeError('The prepared material resource is missing.');
        const css=`background-image:${url===null?'none':`url(${JSON.stringify(url)})`};background-position:${address.backgroundPosition};background-size:${address.backgroundSize}`;
        return `${i/bank.frames.length*100}%{${css}}${i===bank.frames.length-1?`100%{${css}}`:''}`;
      });
      rules.push(`@keyframes ${name}{${frames.join('')}}`);
      node.style.animation=`${name} ${bank.frames.length}ms steps(1,end) calc(${index} * -1ms) both paused`;
    }
    if(track.rotation?.kind!=='ellipsoid') throw new TypeError('The native material projection is not compiled for this rotation kind.');
    const local=readPreparedTransform(track.rotation.systemTransform);
    const materialCounter=values.chain(values.inverse(local),counter,local);
    node.style.transform=values.outputMatrix(ellipsoid(values,track.rotation,eye,materialCounter,
      selected.rotationEnabled?lightAngle:'0deg'));
  }
  const relative=(point:readonly Value[],centre:readonly number[])=>[0,1,2].map(row=>
    `calc(${[0,1,2].map(column=>`${turn[column*4+row]} * ${typeof point[column]==='number'?point[column]-centre[column]:`(${point[column]} - ${centre[column]})`}`).join(' + ')} + ${centre[row]})`);
  const eyeCentre=centre.map(n=>n*frame.metersPerUnit);
  return {
    transform:values.outputMatrix(turn),css:values.css(document.documentElement.outerHTML+rules.join('\n')+turn.join(','))+'\n'+rules.join('\n'),
    eyeCentre,
    eyePoint:point=>relative(point,eyeCentre),
    eyeOffsetPoint:offset=>[0,1,2].map(row=>
      `calc(${[0,1,2].map(column=>`${turn[column*4+row]} * ${offset[column]}`).join(' + ')} + ${eyeCentre[row]})`),
    skyPoint:(point,metersPerPixel)=>relative(point,centre.map(n=>n*frame.metersPerUnit/metersPerPixel)),
  };
}

// The perspective ellipsoid and covariance correction follow the shared
// physical-projection and prepared-ellipsoid-projection publishers. Browser
// differential checks must compare these expressions with those numeric owners.
function ellipsoid(v:CssValues,rotation:EllipsoidRotation,eye:Matrix,counter:Matrix,angle:string):Matrix {
  const p=rotation.projection;
  const local=v.chain(p.centerTranslation,v.rotation('z',angle),p.inverseCenterTranslation);
  const materialProjection=v.multiply(p.baseProjection,local);
  const body=v.chain(eye,p.bodySystemMatrix,p.bodyMeshMatrix);
  const parent=v.chain(eye,p.materialSystemMatrix,counter,p.materialMeshMatrix);
  const material=v.multiply(parent,materialProjection);
  const width=rotation.width,height=rotation.height??width;
  const [cx,cy]=p.textureEllipse?.center??[width/2,height/2];
  const [xx,xy,yy]=p.textureEllipse?.covariance??[(width/2)**2,0,(height/2)**2];
  const textureX=Math.sqrt(xx),textureSkew=xy/textureX,textureY=Math.sqrt(yy-textureSkew**2);
  const textureFrame:Matrix=[textureX,textureSkew,0,0,0,textureY,0,0,0,0,1,0,cx,cy,0,1];
  const texture=v.multiply(material,textureFrame);
  const focal=v.value('var(--native-focal) / 1px');
  const target=project(v,body,[p.equatorialRadius*p.coverageScale,p.equatorialRadius*p.coverageScale,p.polarRadius*p.coverageScale],focal);
  const source=project(v,texture,[1,1],focal);
  const covarianceScale=v.max(target.covariance[0],target.covariance[2],source.covariance[0],source.covariance[2]);
  const normalize=(m:Covariance):Covariance=>[v.div(m[0],covarianceScale),v.div(m[1],covarianceScale),v.div(m[2],covarianceScale)];
  const a=squareRoot(v,normalize(target.covariance)),b=squareRoot(v,normalize(source.covariance));
  const determinant=v.sub(v.mul(b[0],b[3]),v.mul(b[1],b[2]));
  const inverse:PairMatrix=[v.div(b[3],determinant),v.div(v.mul(-1,b[1]),determinant),v.div(v.mul(-1,b[2]),determinant),v.div(b[0],determinant)];
  const correction:PairMatrix=[v.dot([a[0],a[1]],[inverse[0],inverse[2]]),v.dot([a[0],a[1]],[inverse[1],inverse[3]]),v.dot([a[2],a[3]],[inverse[0],inverse[2]]),v.dot([a[2],a[3]],[inverse[1],inverse[3]])];
  const tx=v.sub(target.center[0],v.dot([correction[0],correction[1]],source.center));
  const ty=v.sub(target.center[1],v.dot([correction[2],correction[3]],source.center));
  const screen:Matrix=[correction[0],correction[2],0,0,correction[1],correction[3],0,0,v.div(v.mul(-1,tx),focal),v.div(v.mul(-1,ty),focal),1,0,0,0,0,1];
  return v.chain(v.inverse(parent),screen,material);
}
function project(v:CssValues,m:Matrix,radii:readonly number[],focal:Value):{center:readonly [Value,Value];covariance:Covariance}{
  const q=(a:number,b:number)=>v.sum(...radii.map((r,i)=>v.mul(v.mul(m[i*4+a],m[i*4+b]),r*r)));
  const xx=q(0,0),xy=q(0,1),yy=q(1,1),xz=q(0,2),yz=q(1,2),zz=q(2,2);
  const [x,y,z]=m.slice(12,15),denominator=v.sub(v.square(z),zz);
  // Keep perspective terms in a useful numeric range across CSS engines.
  // Dividing by depth twice after the numerator avoids a tiny intermediate
  // focal²/depth⁴ value and an unnecessarily huge stored depth⁴ value.
  const projectCovariance=(numerator:Value)=>v.div(v.div(v.mul(v.square(focal),numerator),denominator),denominator);
  return {center:[v.div(v.mul(focal,v.sub(xz,v.mul(x,z))),denominator),v.div(v.mul(focal,v.sub(yz,v.mul(y,z))),denominator)],covariance:[
    projectCovariance(v.sum(v.mul(xx,denominator),v.mul(v.square(x),zz),v.mul(-2,v.mul(v.mul(x,z),xz)),v.square(xz))),
    projectCovariance(v.sum(v.mul(xy,denominator),v.mul(v.mul(x,y),zz),v.mul(-1,v.mul(v.sum(v.mul(x,yz),v.mul(y,xz)),z)),v.mul(xz,yz))),
    projectCovariance(v.sum(v.mul(yy,denominator),v.mul(v.square(y),zz),v.mul(-2,v.mul(v.mul(y,z),yz)),v.square(yz))),
  ]};
}
function squareRoot(v:CssValues,m:Covariance):PairMatrix{
  const root=v.sqrt(v.sub(v.mul(m[0],m[2]),v.square(m[1])));
  const divisor=v.sqrt(v.max(Number.EPSILON,v.sum(m[0],m[2],v.mul(2,root))));
  return [v.div(v.sum(m[0],root),divisor),v.div(m[1],divisor),v.div(m[1],divisor),v.div(v.sum(m[2],root),divisor)];
}
