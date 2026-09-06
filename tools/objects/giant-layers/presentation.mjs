import {createPolyCamera,buildPolyCameraSceneTransform,buildPolyMeshTransform} from '@layoutit/polycss';
import {preparedSkyResources,preparedResourcePool} from '../../../src/platform/prepared-object-assets.mjs';
import {PREPARED_PRESENTATION_SCHEMA} from '../../../src/platform/prepared-presentation-contract.mjs';
import {prepareCssomDeclarationReads} from '../../prepared-cssom.mjs';
import {createPreparedNodeTree} from '../../prepared-node-tree.mjs';
import {prepareFixedSpanMaterialPlane} from './geometry.mjs';
import {rasterEllipsoidMaterial} from './materials.mjs';
import {prepareMaterialTracks} from '../../prepare-materials.mjs';

const url=(prefix,filename)=>`${prefix}${filename}`;
function authoredTransform(config){return config.kind==='literal'?config.value:`transform:${config.rotations.map(rotation=>buildPolyMeshTransform({rotation})).join(' ')}`;}
function quantizedScenePitch(camera){const control=Math.round(camera.defaultControlPitchDegrees*100)/100;return Number((camera.maximumScenePitchDegrees*(1-control/camera.maximumControlPitchDegrees)).toFixed(4));}

/** Resolve retained scene composition from authored layout and freshly prepared
 * geometry. No object module, DOM snapshot or prepared bank is a source here. */
export async function prepareLayeredSurfacePresentation({config,geometryConfig,geometry,observationConfig,materialConfig,sky,sun}) {
  if(config?.schema!=='cssearth-layered-surface-presentation@1'||!config.namespace||!geometry?.bodyBands?.length)throw new TypeError('Invalid layered surface presentation.');
  const {camera:cameraPlan,resources,carrier,material:materialStyle}=config,bank=materialConfig.bank,prefix=materialConfig.urlPrefix;
  const lensIds=observationConfig.lenses.map(lens=>lens.id),defaultId=config.defaultLens;
  const surface=(id)=>{
    const observation=observationConfig.lenses.find(lens=>lens.id===id),material=materialConfig.lenses.find(lens=>lens.id===id);
    const highest=products=>products.find(product=>product.filename.includes('@2x'))??products[0];
    return{surface:url(prefix,highest(observation.products.filter(product=>product.kind==='surface')).filename),poles:url(prefix,highest(observation.products.filter(product=>product.kind==='poles')).filename),
      [resources.fixedRole]:url(prefix,highest(material.fixed.filter(product=>!product.shadowless)).filename),[resources.shadowlessRole]:url(prefix,highest(material.fixed.filter(product=>product.shadowless)).filename)};
  };
  const staticRoles=['surface','poles',resources.fixedRole,resources.shadowlessRole],staticKeys=id=>staticRoles.map(role=>`${role}:${id}`);
  const celestial=[...preparedSkyResources(sky,sun,resources.celestialPool),...config.planes.map(plane=>({key:plane.assetKey,url:plane.assetUrl,pool:resources.celestialPool}))];
  const rowCount=bank.frames/bank.columns,rowUrl=(id,row)=>url(prefix,materialConfig.lenses.find(lens=>lens.id===id).rowOutput.replace('{row}',String(row).padStart(2,'0')));
  const entries=[...celestial,...lensIds.flatMap(id=>[...Object.entries(surface(id)).map(([role,url])=>({key:`${role}:${id}`,url,pool:resources.staticPool})),...Array.from({length:rowCount},(_,row)=>({key:`${resources.rowKey}:${id}:${row}`,url:rowUrl(id,row),pool:resources.rowPool}))])];
  const meshTransform=authoredTransform(config.meshTransform),systemTransform=authoredTransform(config.systemTransform);
  const materialLeaf=materialStyle.projection==='fixed-span'?prepareFixedSpanMaterialPlane(geometryConfig.materialPlane,quantizedScenePitch(cameraPlan)):
    rasterEllipsoidMaterial(materialConfig.raster,{size:materialConfig.lenses[0].fixed[0].size,state:materialConfig.fixedState,geometryOnly:true,textureUrl:url(prefix,materialConfig.lenses[0].fixed[0].filename)}).leaf;
  const styleReads=geometry.bodyBands.flatMap(band=>band.leaves).map(leaf=>leaf.style);
  if(config.readPlaneCssom)styleReads.push(...Object.values(geometry.planes).map(leaf=>leaf.style),materialLeaf.style);
  const b=createPreparedNodeTree({cssomReads:await prepareCssomDeclarationReads(styleReads)});
  const element=(tag,className,style='')=>b.element(tag,className,style,config.ariaHiddenEveryElement?{'aria-hidden':'true'}:{});
  const mesh=(className,style='')=>element('div',className.includes('polycss-')?className:`polycss-mesh ${className}`,style);
  const texture=(record,className,assetUrl)=>{
    if(config.ariaHiddenEveryElement){const leaf=element('s',className,record.style);leaf.style.backgroundImage=`url(${assetUrl})`;return leaf;}
    const leaf=b.leaf(record);if(className)leaf.className=[leaf.className,className].filter(Boolean).join(' ');return leaf;
  };
  const camera=element('div','polycss-camera planet-render-root','perspective:1000000px');
  let sceneStyle='';if(config.initialScene==='quantized-camera'){
    const controlPitch=Math.round(cameraPlan.defaultControlPitchDegrees*100)/100,pitch=cameraPlan.maximumScenePitchDegrees*(1-controlPitch/cameraPlan.maximumControlPitchDegrees);
    sceneStyle=`transform:${buildPolyCameraSceneTransform(createPolyCamera({zoom:cameraPlan.defaultZoom,rotX:pitch,rotY:0,target:[0,0,0]}).state)}`;
  }
  const scene=mesh('polycss-scene',sceneStyle);if(!config.ariaHiddenEveryElement)scene.attributes['aria-hidden']='true';
  const system=mesh(config.systemClass,systemTransform);b.append(null,camera);b.append(camera,scene);b.append(scene,system);
  for(const plane of config.planes){
    const container=mesh(plane.containerClass,`${meshTransform}${plane.rotationSeconds?`;animation-duration:${plane.rotationSeconds}s`:''}`),leaf=texture(geometry.planes[plane.geometry],plane.leafClass,plane.assetUrl);
    if(!config.ariaHiddenEveryElement)leaf.style.backgroundImage=`url("${plane.assetUrl}")`;
    b.append(system,container);b.append(container,leaf);
  }
  const carriers=new Map(),normal=surface(defaultId);
  for(const band of geometry.bodyBands){
    const polar=band.leaves.some(leaf=>leaf.className?.includes(carrier.polarFragment)),duration=band.visualRotationSeconds??carrier.rotationSeconds,key=carrier.groupByDuration?`${polar}:${duration}`:(polar?'polar':'body');
    if(!carriers.has(key)){
      const body=mesh(polar?carrier.polarClass:carrier.bodyClass,`${meshTransform};animation-duration:${duration}s`);
      if(carrier.initializeTextures)for(const role of['surface','poles'])body.style.setProperty(`--${config.namespace}-${role}-image`,`url(${normal[role]})`);
      carriers.set(key,body);b.append(system,body);
    }
    for(const leaf of band.leaves)b.append(carriers.get(key),b.leaf(leaf));
  }
  const counter=mesh(materialStyle.counterClass),material=mesh(materialStyle.containerClass,materialStyle.useMeshTransform?meshTransform:''),leaf=texture(materialLeaf,materialStyle.leafClass,normal[resources.fixedRole]);
  b.append(materialStyle.parent==='scene'?scene:system,counter);b.append(counter,material);b.append(material,leaf);
  const {tree,index}=b.finish({camera,scene});
  const defaultFrame=config.frameSelection==='control-pitch'?Math.round(cameraPlan.defaultControlPitchDegrees/cameraPlan.maximumControlPitchDegrees*(bank.frames-1)):Math.round((bank.maximumScenePitchDegrees-cameraPlan.initialScenePitchDegrees)/bank.maximumScenePitchDegrees*(bank.frames-1));
  const initialRow=Math.floor(defaultFrame/bank.columns),initialRows=[initialRow-1,initialRow,initialRow+1].filter(row=>row>=0&&row<rowCount),stride=bank.frameSize+bank.gutter*2,presentationScale=bank.presentationSize/bank.frameSize;
  const banks=lensIds.map(id=>({id,frames:Array.from({length:bank.frames},(_,frame)=>({resource:`${resources.rowKey}:${id}:${Math.floor(frame/bank.columns)}`,frame,row:Math.floor(frame/bank.columns),backgroundPosition:`${-((frame%bank.columns)*stride+bank.gutter)*presentationScale}px ${-bank.gutter*presentationScale}px`,backgroundSize:`${stride*bank.columns*presentationScale}px ${stride*presentationScale}px`})),rows:Array.from({length:rowCount},(_,row)=>({row,resource:`${resources.rowKey}:${id}:${row}`,firstFrame:row*bank.columns,lastFrame:Math.min(bank.frames-1,(row+1)*bank.columns-1)})),default:{resource:`${resources.fixedRole}:${id}`,frame:null,row:null,backgroundPosition:'0px 0px',backgroundSize:`${bank.presentationSize}px ${bank.presentationSize}px`},fixed:{resource:`${resources.shadowlessRole}:${id}`,frame:null,row:null,backgroundPosition:'0px 0px',backgroundSize:`${bank.presentationSize}px ${bank.presentationSize}px`}}));
  const track={id:'lighting',target:index(leaf),frame:{source:'reference-sun-z',minimum:0,maximum:2,count:bank.frames,baseFrame:defaultFrame,remap:null},banks,demand:{capacity:materialStyle.capacity,defaultFrame},rotation:{kind:'planar',source:'view-sun',reference:'initial',baseDegrees:0,zeroAtPole:false,width:bank.presentationSize,height:bank.presentationSize,polePolicy:'azimuth'},frameAttribute:null,modeAttribute:null,quoted:materialStyle.quoted};
  const targets=carrier.textureTarget==='carriers'?[...carriers.values()].map(index):[-1];
  const variants=lensIds.flatMap(id=>[false,true].flatMap(shadows=>[false,true].map(rings=>({when:{lensId:id,shadows,rings},required:staticKeys(id),writes:[...targets.flatMap(target=>['surface','poles'].map(role=>({kind:'texture',target,name:`--${config.namespace}-${role}-image`,resource:`${role}:${id}`,quoted:materialStyle.quoted}))),{kind:'attribute',target:-1,name:'data-lens',value:id},{kind:'class',target:-1,name:`${config.namespace}-hide-rings`,value:!rings},{kind:'class',target:-1,name:`${config.namespace}-hide-shadows`,value:!shadows}],materials:[{track:'lighting',bank:id,mode:shadows?'default-pose':'fixed',enabled:true,rotationEnabled:shadows,frameOverride:null,clearWhenHidden:false,fixedMode:resources.shadowlessRole}]}))));
  const result={schema:PREPARED_PRESENTATION_SCHEMA,camera:cameraPlan,sky,sun,assets:{entries,pools:resources.pools.map(pool=>preparedResourcePool(pool.id,entries,pool.options)),startup:[...celestial.map(entry=>entry.key),...staticKeys(defaultId),...initialRows.map(row=>`${resources.rowKey}:${defaultId}:${row}`)]},tree,variants,materials:[track],viewBindings:[{kind:'counter-rotation',target:index(counter),systemTransform:materialStyle.counterSystemTransform?system.style.transform:null}],animations:[]};
  return{...result,materials:prepareMaterialTracks(result),variants:variants.map(variant=>({...variant,materials:variant.materials.map(material=>({...material,mode:material.mode==='default-pose'?'frames':material.mode}))}))};
}
