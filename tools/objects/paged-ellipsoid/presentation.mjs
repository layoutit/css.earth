import { canonicalPreparedAsset, preparedSunResources, preparedResourcePool } from "../../../src/platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../src/platform/prepared-presentation-contract.mjs";
import { prepareCssomDeclarationReads } from "../../prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../prepared-node-tree.mjs";
import { prepareMaterialTracks } from "../../prepare-materials.mjs";
import { surfaceBankInventory } from "./surface-banks.mjs";

export async function preparePagedEllipsoidPresentation({ config, plan, lenses, sky, sun, catalog, city, geographic, controls }) {
 const cameraPlan=config.camera;
 const declaredRootLenses=[...controls.lenses.controls.filter(lens=>!lens.entityIds).map(lens=>lens.id),...geographic.rootLenses.map(lens=>lens.id)];
 const rootLensIds=config.destinations.lensIds??declaredRootLenses;
 if (!rootLensIds.includes(controls.lenses.defaultLens) || new Set(rootLensIds).size!==rootLensIds.length || rootLensIds.some(id=>!declaredRootLenses.includes(id))) throw new Error("The root card requires declared lenses and its default view.");
 const rootLenses=geographic.rootLenses.filter(lens=>rootLensIds.includes(lens.id));
  const banks=surfaceBankInventory(plan,lenses,config.publicBase);
  const pageKeys=lens=>banks.find(bank=>bank.id===(lens.surfaceBankId??lens.id)).urls.map((_,i)=>`page:${lens.surfaceBankId??lens.id}:${i}`);
  const interiorUrls=[...new Set([plan.interior.outerAssets.poles,
    ...plan.interior.shells.flatMap(shell=>shell.leaves.map(leaf=>leaf.asset)),
    ...plan.interior.sectionLeaves.map(leaf=>leaf.asset)].map(pair=>canonicalPreparedAsset(pair)))];
  const interiorKeys=interiorUrls.map((_,i)=>`interior:${i}`);
  const celestial=preparedSunResources(sun,"mounted");
  const entries=[...celestial,...banks.flatMap(bank=>bank.urls.map((url,i)=>({key:`page:${bank.id}:${i}`,url,pool:"pages"}))),
    ...lenses.controls.filter(lens=>lens.view!=="interior").map(lens=>({key:`poles:${lens.id}`,url:canonicalPreparedAsset(lens.polesUrl),pool:"mounted"})),
    ...interiorUrls.map((url,i)=>({key:interiorKeys[i],url,pool:"mounted"})),
    {key:"shadowless:lighting",url:canonicalPreparedAsset(plan.material.lighting.shadowlessAssets),pool:"mounted"},
    ...["lighting","atmosphere"].flatMap(id=>[
      {key:`default:${id}`,url:canonicalPreparedAsset(plan.material[id].defaultAssets),pool:"default-materials"},
      ...plan.material[id].preparedRows.map(row=>({key:`${id}:${row.rowIndex}`,url:canonicalPreparedAsset(row.assets),pool:id}))])];
  const allLeaves=[...plan.body.bands.flatMap(band=>band.leaves),...plan.interior.outerBodyBands.flatMap(band=>band.leaves),
    ...plan.interior.shells.flatMap(shell=>shell.leaves),...plan.interior.sectionLeaves,
    plan.material.lighting.leaf,plan.material.atmosphere.leaf];
  const b=createPreparedNodeTree({cssomReads:await prepareCssomDeclarationReads(allLeaves.map(leaf=>leaf.style))});
  const camera=b.element("div","polycss-camera planet-render-root",plan.camera.style);
  const scene=b.element("div","polycss-scene",plan.camera.sceneStyle);
  const system=b.mesh(`${config.namespace}-system`,plan[config.sceneBodyKey].systemTransform);
  b.append(null,camera);b.append(camera,scene);b.append(scene,system);
  const pages=plan.body.assets.surface.urls.length;
  const writePages=(node,urls)=>{for(let i=0;i<pages;i++)node.style.setProperty(`--${config.namespace}-surface-page-${i}`,urls.length?`url("${urls[i]}")`:"none");};
  function bands(parent,records,className,polarClass,marker,urls,poles) {
    const grouped=new Map(),surface=[],polar=[];
    for(const band of records) {
      if(!band.leaves.length)continue;
      const isPolar=band.leaves.some(leaf=>leaf.className?.includes(marker)),key=`${isPolar?"polar":"body"}:${band.visualRotationSeconds}`;
      let carrier=grouped.get(key);
      if(!carrier) {
        carrier=b.mesh(isPolar?`${className} ${polarClass}`:className,`${plan[config.sceneBodyKey].meshTransform};animation-duration:${band.visualRotationSeconds}s`);
        grouped.set(key,carrier);(isPolar?polar:surface).push(carrier);b.append(parent,carrier);
        if(isPolar)carrier.style.setProperty(`--${config.namespace}-poles-texture`,`url("${poles}")`);else writePages(carrier,urls);
      }
      for(const leaf of band.leaves)b.append(carrier,b.leaf(leaf));
    }
    return {surface,polar};
  }
  const body=bands(system,plan.body.bands,`${config.namespace}-body`,`${config.namespace}-body-polar`,`${config.namespace}-polar`,plan.body.assets.surface.urls,canonicalPreparedAsset(plan.body.assets.poles));
  const cutawayCounter=b.mesh(`${config.namespace}-cutaway-counter`),presentation=b.mesh(`${config.namespace}-cutaway-presentation`,plan.interior.presentationLock.transform);
  const cutawaySystem=b.mesh(`${config.namespace}-system ${config.namespace}-cutaway-system`,plan[config.sceneBodyKey].systemTransform),cutaway=b.mesh(`${config.namespace}-cutaway`);
  b.append(scene,cutawayCounter);b.append(cutawayCounter,presentation);b.append(presentation,cutawaySystem);b.append(cutawaySystem,cutaway);
  const interior=bands(cutaway,plan.interior.outerBodyBands,`${config.namespace}-cutaway-body`,`${config.namespace}-cutaway-body-polar`,`${config.namespace}-interior-outer-polar`,[],canonicalPreparedAsset(plan.interior.outerAssets.poles));
  for(const shell of plan.interior.shells) {
    const mesh=b.mesh(`${config.namespace}-interior-shell ${shell.className}`,plan[config.sceneBodyKey].meshTransform);b.append(cutaway,mesh);
    for(const leaf of shell.leaves) {const node=b.leaf(leaf);node.style.backgroundImage=`url("${canonicalPreparedAsset(leaf.asset)}")`;b.append(mesh,node);}
  }
  const sections=b.mesh(`${config.namespace}-interior-sections`,plan[config.sceneBodyKey].meshTransform);b.append(cutaway,sections);
  for(const leaf of plan.interior.sectionLeaves) {
    const node=b.leaf(leaf);node.style.backgroundImage=`url("${canonicalPreparedAsset(leaf.asset)}")`;
    if(leaf.backfaceVisible)node.style.backfaceVisibility="visible";b.append(sections,node);
  }
  const materialCounter=b.mesh(`${config.namespace}-material-counter`),materialSystem=b.mesh(`${config.namespace}-system`,plan[config.sceneBodyKey].systemTransform),materialMesh=b.mesh(`${config.namespace}-material`,plan.material.transform);
  b.append(scene,materialCounter);b.append(materialCounter,materialSystem);b.append(materialSystem,materialMesh);
  const materialNodes=Object.fromEntries(["lighting","atmosphere"].map(id=>{
    const material=plan.material[id],node=b.leaf(material.leaf),frame=material.defaultPresentation;
    node.style.transform=frame.transform;node.style.backgroundImage=`url("${canonicalPreparedAsset(frame.assets)}")`;
    node.style.backgroundPosition=frame.backgroundPosition;node.style.backgroundSize=frame.backgroundSize;
    node.attributes["data-material-frame"]="default";b.append(materialMesh,node);return[id,node];
  }));
  const {tree,index}=b.finish({camera,scene});
  const tracks=["lighting","atmosphere"].map(id=>{
    const material=plan.material[id],address=(frame,resource,frameIndex=null,row=null)=>({resource,frame:frameIndex,row,backgroundPosition:frame.backgroundPosition,backgroundSize:frame.backgroundSize});
    const illumination=material.illumination;
    return {id,target:index(materialNodes[id]),frame:{source:illumination?"prepared-light-z":"sun-z",minimum:illumination?.minimumLightViewZ??-1,maximum:illumination?.maximumLightViewZ??1,count:material.frameCount,baseFrame:0,remap:null},
      // Keep the globe's limb at overview scale; regional and city views do
      // not need its full atmosphere atlas or its directional row updates.
      ...(id === "atmosphere" ? { maximumZoom: 4 } : {}),
      banks:[{id,frames:material.frames.map(frame=>address(frame,`${id}:${frame.rowIndex}`,frame.frameIndex,frame.rowIndex)),
        default:null,fixed:id==="lighting"?address(material.shadowlessPresentation,"shadowless:lighting"):null,
        rows:material.preparedRows.map((_,row)=>({row,resource:`${id}:${row}`,firstFrame:row*material.framesPerShard,lastFrame:Math.min(material.frameCount-1,(row+1)*material.framesPerShard-1)}))}],
      demand:{ capacity:material.transport.maximumRetainedRowCount, defaultFrame:material.defaultFrame },
      rotation:{kind:"planar",source:illumination?"prepared-light":"view-sun",reference:illumination?"prepared":"initial",baseDegrees:illumination?.baseLightAzimuthDegrees??0,
        zeroAtPole:!!illumination,publishWithAddress:true,...(!illumination?{polePolicy:"azimuth"}:{}),width:material.presentationTileSize,height:material.presentationTileSize},
      frameAttribute:null,modeAttribute:null,quoted:true};
  });
  const variants=lenses.controls.flatMap(lens=>[false,true].flatMap(shadows=>[false,true].map(atmosphere=>{
    const isInterior=lens.view==="interior",keys=pageKeys(lens),texture=(node,name,resource)=>({kind:"texture",target:index(node),name,resource,quoted:true});
    const pageWrites=(carriers,active)=>carriers.flatMap(node=>Array.from({length:pages},(_,i)=>texture(node,`--${config.namespace}-surface-page-${i}`,active?keys[i]:null)));
    return {when:{lensId:lens.id,shadows,atmosphere},navigation:{maximumZoom:lens.maximumZoom,camera:lens.camera??null},required:[...keys,...(isInterior?interiorKeys:[`poles:${lens.id}`])],
      writes:[...pageWrites(isInterior?interior.surface:body.surface,true),
        ...(!isInterior?body.polar.map(node=>texture(node,`--${config.namespace}-poles-texture`,`poles:${lens.id}`)):[]),
        ...pageWrites(isInterior?body.surface:interior.surface,false),
        {kind:"attribute",target:-1,name:"data-view",value:isInterior?"interior":null},
        {kind:"attribute",target:-1,name:"data-lens",value:isInterior?null:lens.id},
        {kind:"class",target:-1,name:`${config.namespace}-hide-atmosphere`,value:!atmosphere}],
      materials:tracks.map(track=>({track:track.id,bank:track.id,mode:track.id==="lighting"&&!shadows?"fixed":plan.material[track.id].illumination?"frames":"default-pose",
        enabled:!isInterior&&(track.id==="lighting"?shadows&&lens.id!=="night-lights":atmosphere),rotationEnabled:track.id!=="lighting"||shadows,
        frameOverride:null,clearWhenHidden:false,fixedMode:"shadowless",publishWhenHidden:"static",
        addressAttributes:[{name:"data-material-frame",source:"mode-or-frame",value:null}]}))};
  })));
  const prepared = {schema:PREPARED_PRESENTATION_SCHEMA,camera:cameraPlan,sky,sun,destinations:{catalog,defaultLens:controls.lenses.defaultLens,
    rootEntity:{id:config.namespace,lensIds:rootLensIds,lenses:rootLenses},
    statuses:config.destinations.statuses},
    assets:{entries,pools:[preparedResourcePool("mounted",entries,{concurrency:2}),preparedResourcePool("default-materials",entries,{retention:"warm"}),
      preparedResourcePool("pages",entries,{retention:"selection",concurrency:2,capacity:pages*2}),
      ...tracks.map(track=>preparedResourcePool(track.id,entries,{retention:"selection",reuse:true,capacity:track.demand.capacity,concurrency:3,eviction:"capacity",stabilityMilliseconds:plan.material[track.id].illumination?0:120,decoding:"sync"}))],
      startup:[...celestial.map(entry=>entry.key),...pageKeys(lenses.controls.find(lens=>lens.id===lenses.defaultLens)),"poles:normal","shadowless:lighting","default:lighting","default:atmosphere",
        ...plan.material.atmosphere.transport.initialWarmRows.map(row=>`atmosphere:${row}`)]},
    tree,variants,materials:tracks,viewBindings:[materialCounter,cutawayCounter].map(node=>({kind:"counter-rotation",target:index(node),systemTransform:null})),animations:[],
    motionFrame:[index(system),index(body.surface[0])],
    observationSurface:{slots:[...Array.from({length:pages},(_,i)=>({id:`surface:${i}`,bindings:body.surface.map(node=>({target:index(node),name:`--${config.namespace}-surface-page-${i}`}))})),
      {id:"poles",bindings:body.polar.map(node=>({target:index(node),name:`--${config.namespace}-poles-texture`}))}]},
    pageLayers:[{id:"city",plan:city,lensIds:[controls.lenses.defaultLens]},{id:"geographic",geographic:true,plan:config.geographic.observation,lensIds:[controls.lenses.defaultLens]}]
      .map(layer=>({...layer,plan:{...layer.plan,schema:"cssearth-prepared-map-pages@1",assetPath:config.publicBase},carrier:index(body.surface[0]),system:index(system),className:`${config.namespace}-city-page`,textureClassName:`${config.namespace}-api-texture`}))};
 return {...prepared, schema:'cssearth-object-runtime@4', id:config.namespace, controls,
 materials:prepareMaterialTracks(prepared), variants:prepared.variants.map(variant=>({...variant,materials:variant.materials.map(material=>({...material,mode:material.mode==='default-pose'?'frames':material.mode}))}))};
}
