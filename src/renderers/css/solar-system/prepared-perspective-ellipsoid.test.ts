import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createPreparedEllipsoidProjection, invertPreparedAffineMatrix4, multiplyPreparedMatrix4, preparedRotationMatrix4,
  readPreparedMatrix4 } from '../prepared-data/prepared-ellipsoid-projection.js';
import type { PhysicalProjection } from '../prepared-data/physical-projection.js';
import { createPreparedMaterialPublisher, type PreparedMaterialTrack } from '../rendering/prepared-material.js';
import type { PreparedResources } from '../rendering/prepared-residency.js';

const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const translation = (x:number,y:number,z=0) => [...identity.slice(0,12),x,y,z,1];
const point = (m:readonly number[],p:readonly number[],w=1) => [0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]*w);
function fixture() {
  const projection = { equatorialRadius:20,polarRadius:9,coverageScale:1,
    bodySystemMatrix:preparedRotationMatrix4('z',17),bodyMeshMatrix:identity,
    materialSystemMatrix:identity,materialMeshMatrix:identity,
    baseProjection:translation(-50,-40),centerTranslation:translation(50,40),inverseCenterTranslation:translation(-50,-40) };
  return { projection,width:100,height:80,publish:createPreparedEllipsoidProjection({projection,width:100,height:80}) };
}

// Independent geometric proof: every ray through the fitted material's circle
// must have exactly one intersection with the prepared body's ellipsoid.
function tangentError(f:ReturnType<typeof fixture>,matrix:readonly number[],physical:PhysicalProjection,counter:readonly number[]) {
  const body = multiplyPreparedMatrix4(physical.eyeFromScene,f.projection.bodySystemMatrix);
  const inverse = invertPreparedAffineMatrix4(body), eye=point(inverse,[0,0,0]);
  const material = multiplyPreparedMatrix4(multiplyPreparedMatrix4(physical.eyeFromScene,counter),matrix);
  const radii=[20,20,9],metric=(a:readonly number[],b:readonly number[])=>a.reduce((sum,n,i)=>sum+n*b[i]/radii[i]**2,0);
  let error=0;
  for(let angle=0;angle<Math.PI*2;angle+=.19){
    const p=point(material,[50+50*Math.cos(angle),40+40*Math.sin(angle),0]);
    const direction=point(inverse,[p[0]/-p[2],p[1]/-p[2],-1],0);
    const a=metric(direction,direction),b=metric(eye,direction),c=metric(eye,eye)-1;
    error=Math.max(error,Math.abs(b*b-a*c)/(Math.abs(b*b)+Math.abs(a*c)));
  }
  return error;
}

test('perspective overlays follow exact off-axis ellipsoid tangents across inclination, roll and scene scale',()=>{
  const f=fixture(); let cases=0;
  for(const scale of [1,.022])for(const pitch of [0,39,89,126])for(const roll of [0,57])for(const distance of [70,250]){
    const scene=preparedRotationMatrix4('x',pitch),counter=preparedRotationMatrix4('x',-pitch);
    const eyeFromScene=scene.map((value,i)=>i<12?value*scale:value);
    eyeFromScene[12]=distance*.3*scale;eyeFromScene[13]=-distance*.11*scale;eyeFromScene[14]=-distance*scale;
    const physical:PhysicalProjection={eyeFromScene,focalPixels:870,principalOffsetPixels:[-130,48]};
    const result=readPreparedMatrix4(f.publish({degrees:roll,counterMatrix:counter,projection:physical}));
    assert.ok(tangentError(f,result,physical,counter)<2e-9,`physical tangency ${JSON.stringify({scale,pitch,roll,distance})}`);
    cases++;
  }
  assert.equal(cases,32);
});

test('the default pose satisfies the physical silhouette guarantee',()=>{
  const f=fixture(),physical:PhysicalProjection={eyeFromScene:translation(28,-9,-70),focalPixels:800,principalOffsetPixels:[40,-20]};
  const view={degrees:0,counterMatrix:identity};
  assert.ok(tangentError(f,readPreparedMatrix4(f.publish({...view,projection:physical})),physical,identity)<1e-10);
});

test('far off-axis physical overlays stay finite instead of losing covariance through centre subtraction',()=>{
  const f=fixture(),physical:PhysicalProjection={eyeFromScene:translation(3e18,-1e18,-1e19),focalPixels:800,principalOffsetPixels:[0,0]};
  assert.ok(readPreparedMatrix4(f.publish({degrees:20,counterMatrix:identity,projection:physical})).every(Number.isFinite));
});

test('grazing near-surface overlays retain the unbounded conic and remain ahead of the body',()=>{
  const f=fixture(),scene=preparedRotationMatrix4('x',90),counter=preparedRotationMatrix4('x',-90);
  const eyeFromScene=[...scene];eyeFromScene[12]=15;eyeFromScene[14]=-16;
  const physical:PhysicalProjection={eyeFromScene,focalPixels:800,principalOffsetPixels:[-170,0]};
  const result=readPreparedMatrix4(f.publish({degrees:0,counterMatrix:counter,projection:physical}));
  assert.ok(result.every(Number.isFinite));
  assert.ok(tangentError(f,result,physical,counter)<1e-9);
  const material=multiplyPreparedMatrix4(multiplyPreparedMatrix4(eyeFromScene,counter),result);
  for(let angle=0;angle<Math.PI*2;angle+=.2){
    const p=point(material,[50+50*Math.cos(angle),40+40*Math.sin(angle),0]);
    assert.ok(Math.hypot(...p)<Math.hypot(15,16)-20,'entire retained overlay is ahead of every solid-body point');
  }
});

test('the retained material publisher fits angle-only textures in their actual CSS coordinate system',()=>{
  const f=fixture(),style={transform:`matrix3d(${f.projection.baseProjection})`,transformOrigin:'50px 40px',rotate:'',backgroundPosition:'',backgroundSize:'',
    removeProperty(name:string){if(name==='rotate')this.rotate='';}};
  const element={style,setAttribute(){},removeAttribute(){}} as unknown as HTMLElement;
  const address={resource:null,frame:0,row:0,backgroundPosition:'0px 0px',backgroundSize:'100px 80px'};
  const track:PreparedMaterialTrack={id:'material',target:0,frame:{thresholds:[],indices:[0]},defaultFrame:0,
    banks:[{id:'bank',frames:[address],default:address,fixed:address}],rotation:{kind:'angle',property:'rotate',reference:'initial',baseDegrees:0,
      physical:{projection:f.projection,width:f.width,height:f.height,systemTransform:`matrix3d(${identity})`}}};
  const publisher=createPreparedMaterialPublisher(track,element),physical:PhysicalProjection={eyeFromScene:translation(28,-9,-70),focalPixels:800,principalOffsetPixels:[-170,0]};
  const view={controlPitch:0,controlYaw:0,zoom:1,sceneMatrix:`matrix3d(${identity})`,sunViewDirection:[1,0,0],
    principalOffset: physical.principalOffsetPixels, stageViewport: physical,
    levelOfDetail: {stage:'geometry',silhouetteDiameter:40,billboardOpacity:0,markerOpacity:0}, body:{visible:true},
    counterRotation:`matrix3d(${identity})`,counterRotationFor:()=>`matrix3d(${identity})`,projection:physical};
  const selected={track:'material',bank:'bank',mode:'frames' as const,fixedMode:'fixed',enabled:true,rotationEnabled:true};
  const resources={has:()=>true,url:()=>null} as unknown as PreparedResources;
  publisher.publish(selected,{...view,reference:view},resources);
  // CSS conjugates transform by transform-origin. Testing just the supplied
  // matrix misses the extra centring that detached the actual atmosphere.
  const [x,y]=style.transformOrigin.split(' ').map(parseFloat);
  const applied=multiplyPreparedMatrix4(multiplyPreparedMatrix4(translation(x,y),readPreparedMatrix4(style.transform)),translation(-x,-y));
  assert.ok(tangentError(f,applied,physical,identity)<1e-10);
  assert.equal(element.style,style);assert.ok(publisher.observe().transformWrites>0);
});
