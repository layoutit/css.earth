import{BASE_TILE,worldPositionToCss,createPolyCamera,buildPolyCameraSceneTransform,buildPolyMeshTransform}from'@layoutit/polycss';
import{multiplyPreparedMatrix4,preparedRotationMatrix4,readPreparedMatrix4,serializePreparedMatrix4}from'../../../src/platform/prepared-ellipsoid-projection.mjs';
import{preparedSkyResources,preparedResourcePool}from'../../../src/platform/prepared-object-assets.mjs';
import{PREPARED_PRESENTATION_SCHEMA}from'../../../src/platform/prepared-presentation-contract.mjs';
import{prepareCssomDeclarationReads}from'../../prepared-cssom.mjs';
import{createPreparedNodeTree}from'../../prepared-node-tree.mjs';
import{prepareMaterialTracks}from'../../prepare-materials.mjs';
import{rotateSequence}from'../material-composition/ellipsoid.mjs';
import{prepareNormalizedDiscProjection,phaseLightDirection}from'./photometric-disc.mjs';

const round=value=>Number(value.toFixed(12));
const scale=(vector,value)=>vector.map(component=>component*value);
const add=(...vectors)=>[0,1,2].map(axis=>vectors.reduce((total,vector)=>total+vector[axis],0));
const transform=rotation=>`transform:${buildPolyMeshTransform({rotation})}`;

export function prepareFrontBiasedDiscPlane(config,material){
 const depth=config.materialDepth,shape=material.shape;
 const screenToObject=vector=>{const value=rotateSequence(vector,[{axis:'x',degrees:-depth.scenePitchDegrees},{axis:'x',degrees:-material.systemRotationXDegrees},{axis:'z',degrees:-config.bodyRotationZDegrees}]),swapped=[value[1],value[0],value[2]],length=Math.hypot(...swapped);return swapped.map(component=>component/length);};
 const right=screenToObject([1,0,0]),down=screenToObject([0,1,0]),view=screenToObject([0,0,1]),frontDepth=Math.sqrt(shape.equatorialRadius**2*(view[0]**2+view[1]**2)+shape.polarRadius**2*view[2]**2),texelScale=shape.equatorialRadius/material.rasterSurfaceRadius,halfExtent=material.frameSize/2*texelScale;
 const matrix=[...worldPositionToCss(scale(right,texelScale)),0,...worldPositionToCss(scale(down,texelScale)),0,...worldPositionToCss(view),0,...worldPositionToCss(add(scale(right,-halfExtent),scale(down,-halfExtent),scale(view,frontDepth+depth.depthBias))),1].map(round);
 return{model:'prepared-front-depth-biased-camera-facing-material-plane',materialSystemTransform:transform(config.systemRotation),materialMeshTransform:transform([0,0,-config.bodyRotationZDegrees]),leafTransform:`matrix3d(${matrix.join(',')})`,cameraPerspectivePx:1000000,frameSize:material.frameSize,rasterSurfaceRadius:material.rasterSurfaceRadius,scenePitchDegrees:depth.scenePitchDegrees,frontDepth:Number(frontDepth.toFixed(6)),depthBias:depth.depthBias,right:right.map(round),down:down.map(round),view:view.map(round),runtimeDepthMath:false,runtimeZoomTransformWrites:false};
}

/** Address-only frame rows, derived without raster work for scene assembly. */
export function prepareNormalizedDiscAddresses(material){
 const bank=material.bank,stride=material.frameSize+bank.gutter*2,rowCount=Math.ceil(bank.frames/bank.framesPerRow),rows=[],presentations=[];
 for(let row=0;row<rowCount;row++){
  const first=row*bank.framesPerRow,count=Math.min(bank.framesPerRow,bank.frames-first),width=Math.min(bank.columns,count)*stride,height=Math.ceil(count/bank.columns)*stride,url=`${material.urlPrefix}${material.rowOutput.replace('{row}',String(row).padStart(2,'0'))}`;rows.push({url});
  for(let index=0;index<count;index++){const frame=first+index,z=-1+2*frame/(bank.frames-1);presentations.push({frameIndex:frame,rowIndex:row,backgroundPosition:`${-((index%bank.columns)*stride+bank.gutter)/material.pixelDensity}px ${-(Math.floor(index/bank.columns)*stride+bank.gutter)/material.pixelDensity}px`,backgroundSize:`${width/material.pixelDensity}px ${height/material.pixelDensity}px`,cameraLightDirection:phaseLightDirection(z,material.referenceLightDirection).map(value=>Number(value.toFixed(6)))});}
 }
 const defaultFrame=Math.round((material.referenceLightDirection[2]+1)/2*(bank.frames-1)),defaultRow=Math.floor(defaultFrame/bank.framesPerRow),initialWarmRows=[Math.max(0,defaultRow-1),defaultRow,Math.min(rowCount-1,defaultRow+1)].filter((value,index,array)=>array.indexOf(value)===index);
 return{rows,presentations,defaultFrame,initialWarmRows};
}

export async function prepareNormalizedDiscPresentation({config,geometry,materialConfig,sky,sun}){
 if(config?.schema!=='cssearth-normalized-disc-presentation@1'||!geometry?.leaves?.length||!Array.isArray(config.lenses)||!config.lenses.length)throw new TypeError('Invalid normalized-disc presentation.');
 const cameraPlan={...config.camera,materialDepthPresentation:prepareFrontBiasedDiscPlane(config,materialConfig)},depth=cameraPlan.materialDepthPresentation,lighting=prepareNormalizedDiscAddresses(materialConfig),capacity=materialConfig.bank.maximumRetainedRows,namespace=config.namespace;
 const lensKeys=id=>[`surface:${id}`,`poles:${id}`],warm=[...preparedSkyResources(sky,sun,'warm'),...config.radialResources.map(resource=>({key:`rings:${resource.id}`,url:resource.url,pool:'warm'})),{key:'shadowless',url:`${materialConfig.urlPrefix}${materialConfig.shadowlessOutput}`,pool:'warm'}];
 const entries=[...warm,...config.lenses.flatMap(lens=>['surface','poles'].map(layer=>({key:`${layer}:${lens.id}`,url:lens[layer],pool:'warm'}))),...lighting.rows.map((row,index)=>({key:`lighting:${index}`,url:row.url,pool:'lighting'}))];
 const b=createPreparedNodeTree({cssomReads:await prepareCssomDeclarationReads(geometry.leaves.map(leaf=>leaf.style))}),camera=b.element('div','polycss-camera planet-render-root','perspective:1000000px');
 const cameraState=createPolyCamera({zoom:config.initialScene.zoom,rotX:config.initialScene.totalPitchDegrees-materialConfig.systemRotationXDegrees,rotY:0,target:[0,0,0]}).state;
 const scene=b.element('div','polycss-scene',`transform:${buildPolyCameraSceneTransform(cameraState)}`),system=b.mesh(`${namespace}-system`,depth.materialSystemTransform),body=b.mesh(`${namespace}-body`,depth.materialMeshTransform),rings=b.mesh(`${namespace}-rings`,'');
 b.append(null,camera);b.append(camera,scene);for(const leaf of geometry.leaves)b.append(body,b.leaf(leaf));for(const leaf of geometry.ringLeaves)b.append(rings,b.element('s',leaf.className,leaf.style));b.append(system,rings,body);
 const materialSystem=b.mesh(`${namespace}-material-system`,depth.materialSystemTransform),counter=b.mesh(`${namespace}-fixed-material-counter`,''),material=b.mesh(`${namespace}-material`,depth.materialMeshTransform),leaf=b.element('s');leaf.style.transform=depth.leafTransform;
 b.append(scene,materialSystem,system);b.append(materialSystem,counter);b.append(counter,material);b.append(material,leaf);
 const width=materialConfig.presentationSize,half=width/2,centerTranslation=[1,0,0,0,0,1,0,0,0,0,1,0,half,half,0,1],inverseCenterTranslation=[1,0,0,0,0,1,0,0,0,0,1,0,-half,-half,0,1],shape=prepareNormalizedDiscProjection(materialConfig),fit=[1,0,0,0,0,shape.radiusY/shape.radiusX,0,0,0,0,1,0,0,0,0,1];
 const baseProjection=multiplyPreparedMatrix4(readPreparedMatrix4(leaf.style.transform),multiplyPreparedMatrix4(centerTranslation,multiplyPreparedMatrix4(fit,inverseCenterTranslation)));leaf.style.transform=serializePreparedMatrix4(baseProjection);
 const bodySystemMatrix=preparedRotationMatrix4('x',materialConfig.systemRotationXDegrees),bodyMeshMatrix=preparedRotationMatrix4('z',config.bodyRotationZDegrees),projection={equatorialRadius:materialConfig.shape.equatorialRadius*BASE_TILE,polarRadius:materialConfig.shape.polarRadius*BASE_TILE,coverageScale:half/materialConfig.rasterSurfaceRadius,bodySystemMatrix,bodyMeshMatrix,materialSystemMatrix:bodySystemMatrix,materialMeshMatrix:bodyMeshMatrix,baseProjection,centerTranslation,inverseCenterTranslation};
 const{tree,index}=b.finish({camera,scene,stageClasses:[`${namespace}-stage`]});
 const track={id:'lighting',target:index(leaf),frame:{count:materialConfig.bank.frames,samples:lighting.presentations.map(p=>p.cameraLightDirection)},banks:[{id:'lighting',frames:lighting.presentations.map(p=>({resource:`lighting:${p.rowIndex}`,frame:p.frameIndex,row:p.rowIndex,backgroundPosition:p.backgroundPosition,backgroundSize:p.backgroundSize})),rows:lighting.rows.map((row,index)=>({row:index,resource:`lighting:${index}`,firstFrame:index*materialConfig.bank.framesPerRow,lastFrame:Math.min(lighting.presentations.length-1,(index+1)*materialConfig.bank.framesPerRow-1)})),default:null,fixed:{resource:'shadowless',frame:null,row:null,backgroundPosition:'0px 0px',backgroundSize:`${materialConfig.presentationSize}px ${materialConfig.presentationSize}px`}}],demand:{capacity,defaultFrame:lighting.defaultFrame},rotation:{kind:'ellipsoid',source:'view-sun',reference:'initial',baseDegrees:0,zeroAtPole:false,width,height:width,projection,systemTransform:materialSystem.style.transform,polePolicy:'azimuth'},frameAttribute:null,modeAttribute:null,quoted:true};
 const variants=config.lenses.flatMap(lens=>[false,true].flatMap(shadows=>[false,true].map(rings=>({when:{lensId:lens.id,shadows,rings},required:lensKeys(lens.id),writes:[{kind:'attribute',target:-1,name:'data-lens',value:lens.id===config.defaultLens?null:lens.id},{kind:'class',target:-1,name:`${namespace}-hide-rings`,value:!rings},{kind:'class',target:-1,name:`${namespace}-hide-shadows`,value:!shadows}],materials:[{track:'lighting',bank:'lighting',mode:shadows?'frames':'fixed',enabled:true,rotationEnabled:shadows,frameOverride:null,clearWhenHidden:false,fixedMode:'shadowless'}]}))));
 const result={schema:PREPARED_PRESENTATION_SCHEMA,camera:cameraPlan,sky,sun,assets:{entries,pools:[preparedResourcePool('warm',entries,{retention:'warm',decoding:'sync'}),preparedResourcePool('lighting',entries,{retention:'selection',decoding:'sync',capacity,concurrency:capacity,reuse:true,eviction:'capacity'})],startup:[...warm.map(entry=>entry.key),...lensKeys(config.defaultLens),...lighting.initialWarmRows.map(row=>`lighting:${row}`)]},tree,variants,materials:[track],viewBindings:[{kind:'counter-rotation',target:index(counter),systemTransform:depth.materialSystemTransform.replace(/^transform:/u,'')}],animations:[]};
 return{...result,materials:prepareMaterialTracks(result)};
}
