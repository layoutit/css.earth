import { pathToFileURL } from "node:url";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { prepareCssomDeclarationReads } from "../../../../tools/prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../../../tools/prepared-node-tree.mjs";
import { writePreparedPresentation } from "../../../../tools/prepare-presentation.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_EARTH_SCENE as plan } from "../runtime/preparedScene.mjs";
import { PREPARED_EARTH_LENSES as lenses } from "../runtime/preparedLenses.mjs";
import { PREPARED_EARTH_STARFIELD as sky } from "../runtime/preparedStarfield.mjs";
import { PREPARED_EARTH_SKY_SUN as sun } from "../runtime/preparedSkySun.mjs";
import { PREPARED_EARTH_PLACES as catalog } from "../runtime/preparedPlaces.mjs";
import { PREPARED_EARTH_CITY_PAGES } from "../runtime/preparedCityPages.mjs";
import { PREPARED_EARTH_NOISE } from "../runtime/preparedNoise.mjs";
import { cameraPlan } from "./prepared-camera.mjs";
import { earthSurfaceBankInventory } from "./prepared-surface-pages.mjs";

export async function prepareEarthPresentation() {
  const banks=earthSurfaceBankInventory();
  const pageKeys=lens=>banks.find(bank=>bank.id===(lens.surfaceBankId??lens.id)).urls.map((_,i)=>`page:${lens.surfaceBankId??lens.id}:${i}`);
  const interiorUrls=[...new Set([plan.interior.outerAssets.poles,
    ...plan.interior.shells.flatMap(shell=>shell.leaves.map(leaf=>leaf.asset)),
    ...plan.interior.sectionLeaves.map(leaf=>leaf.asset)].map(pair=>canonicalPreparedAsset(pair)))];
  const interiorKeys=interiorUrls.map((_,i)=>`interior:${i}`);
  const celestial=preparedSkyResources(sky,sun,"mounted");
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
  const system=b.mesh("earth-system",plan.earth.systemTransform);
  b.append(null,camera);b.append(camera,scene);b.append(scene,system);
  const pages=plan.body.assets.surface.urls.length;
  const writePages=(node,urls)=>{for(let i=0;i<pages;i++)node.style.setProperty(`--earth-surface-page-${i}`,urls.length?`url("${urls[i]}")`:"none");};
  function bands(parent,records,className,polarClass,marker,urls,poles) {
    const grouped=new Map(),surface=[],polar=[];
    for(const band of records) {
      if(!band.leaves.length)continue;
      const isPolar=band.leaves.some(leaf=>leaf.className?.includes(marker)),key=`${isPolar?"polar":"body"}:${band.visualRotationSeconds}`;
      let carrier=grouped.get(key);
      if(!carrier) {
        carrier=b.mesh(isPolar?`${className} ${polarClass}`:className,`${plan.earth.meshTransform};animation-duration:${band.visualRotationSeconds}s`);
        grouped.set(key,carrier);(isPolar?polar:surface).push(carrier);b.append(parent,carrier);
        if(isPolar)carrier.style.setProperty("--earth-poles-texture",`url("${poles}")`);else writePages(carrier,urls);
      }
      for(const leaf of band.leaves)b.append(carrier,b.leaf(leaf));
    }
    return {surface,polar};
  }
  const body=bands(system,plan.body.bands,"earth-body","earth-body-polar","earth-polar",plan.body.assets.surface.urls,canonicalPreparedAsset(plan.body.assets.poles));
  const cutawayCounter=b.mesh("earth-cutaway-counter"),presentation=b.mesh("earth-cutaway-presentation",plan.interior.presentationLock.transform);
  const cutawaySystem=b.mesh("earth-system earth-cutaway-system",plan.earth.systemTransform),cutaway=b.mesh("earth-cutaway");
  b.append(scene,cutawayCounter);b.append(cutawayCounter,presentation);b.append(presentation,cutawaySystem);b.append(cutawaySystem,cutaway);
  const interior=bands(cutaway,plan.interior.outerBodyBands,"earth-cutaway-body","earth-cutaway-body-polar","earth-interior-outer-polar",[],canonicalPreparedAsset(plan.interior.outerAssets.poles));
  for(const shell of plan.interior.shells) {
    const mesh=b.mesh(`earth-interior-shell ${shell.className}`,plan.earth.meshTransform);b.append(cutaway,mesh);
    for(const leaf of shell.leaves) {const node=b.leaf(leaf);node.style.backgroundImage=`url("${canonicalPreparedAsset(leaf.asset)}")`;b.append(mesh,node);}
  }
  const sections=b.mesh("earth-interior-sections",plan.earth.meshTransform);b.append(cutaway,sections);
  for(const leaf of plan.interior.sectionLeaves) {
    const node=b.leaf(leaf);node.style.backgroundImage=`url("${canonicalPreparedAsset(leaf.asset)}")`;
    if(leaf.backfaceVisible)node.style.backfaceVisibility="visible";b.append(sections,node);
  }
  const materialCounter=b.mesh("earth-material-counter"),materialSystem=b.mesh("earth-system",plan.earth.systemTransform),materialMesh=b.mesh("earth-material",plan.material.transform);
  b.append(scene,materialCounter);b.append(materialCounter,materialSystem);b.append(materialSystem,materialMesh);
  const materialNodes=Object.fromEntries(["lighting","atmosphere"].map(id=>{
    const material=plan.material[id],node=b.leaf(material.leaf),frame=material.defaultPresentation;
    node.style.transform=frame.transform;node.style.backgroundImage=`url("${canonicalPreparedAsset(frame.assets)}")`;
    node.style.backgroundPosition=frame.backgroundPosition;node.style.backgroundSize=frame.backgroundSize;
    node.attributes["data-material-frame"]="default";b.append(materialMesh,node);return[id,node];
  }));
  const {tree,index}=b.finish({camera,scene,registrations:[{bodySystem:system,lightingOverlays:[materialCounter]}]});
  const tracks=["lighting","atmosphere"].map(id=>{
    const material=plan.material[id],address=(frame,resource,frameIndex=null,row=null)=>({resource,frame:frameIndex,row,backgroundPosition:frame.backgroundPosition,backgroundSize:frame.backgroundSize});
    return {id,target:index(materialNodes[id]),frame:{source:"sun-z",minimum:-1,maximum:1,count:material.frameCount,baseFrame:0,remap:null},
      defaultPose:[{source:"frame",scale:-65/(material.frameCount-1),offset:65,value:material.defaultScenePitchDegrees,epsilon:0.01}],
      banks:[{id,frames:material.frames.map(frame=>address(frame,`${id}:${frame.rowIndex}`,frame.frameIndex,frame.rowIndex)),
        default:address(material.defaultPresentation,`default:${id}`),fixed:id==="lighting"?address(material.shadowlessPresentation,"shadowless:lighting"):null,
        rows:material.preparedRows.map((_,row)=>({row,resource:`${id}:${row}`,firstFrame:row*material.framesPerShard,lastFrame:Math.min(material.frameCount-1,(row+1)*material.framesPerShard-1)}))}],
      demand:{mode:"visible-directional",prewarm:"symmetric",capacity:material.transport.maximumRetainedRowCount,framesPerRow:material.framesPerShard,
        defaultFrame:material.defaultFrame,defaultRow:material.transport.defaultRow,initialRows:material.transport.initialWarmRows,holdHiddenNeighborhood:false,fallback:"hold"},
      rotation:{kind:"planar",source:"view-sun",reference:"initial",baseDegrees:0,zeroAtPole:false,polePolicy:"azimuth",width:material.presentationTileSize,height:material.presentationTileSize},
      frameAttribute:null,modeAttribute:null,quoted:true};
  });
  const variants=lenses.controls.flatMap(lens=>[false,true].flatMap(shadows=>[false,true].map(atmosphere=>{
    const isInterior=lens.view==="interior",keys=pageKeys(lens),texture=(node,name,resource)=>({kind:"texture",target:index(node),name,resource,quoted:true});
    const pageWrites=(carriers,active)=>carriers.flatMap(node=>Array.from({length:pages},(_,i)=>texture(node,`--earth-surface-page-${i}`,active?keys[i]:null)));
    return {when:{lensId:lens.id,shadows,atmosphere},navigation:{maximumZoom:lens.maximumZoom,camera:lens.camera??null},required:[...keys,...(isInterior?interiorKeys:[`poles:${lens.id}`])],
      writes:[...pageWrites(isInterior?interior.surface:body.surface,true),
        ...(!isInterior?body.polar.map(node=>texture(node,"--earth-poles-texture",`poles:${lens.id}`)):[]),
        ...pageWrites(isInterior?body.surface:interior.surface,false),
        {kind:"attribute",target:-1,name:"data-view",value:isInterior?"interior":null},
        {kind:"attribute",target:-1,name:"data-lens",value:isInterior?null:lens.id},
        {kind:"class",target:-1,name:"earth-hide-atmosphere",value:!atmosphere}],
      materials:tracks.map(track=>({track:track.id,bank:track.id,mode:track.id==="lighting"&&!shadows?"fixed":"default-pose",
        enabled:!isInterior&&(track.id==="lighting"?shadows&&lens.id!=="night-lights":atmosphere),rotationEnabled:track.id!=="lighting"||shadows,
        frameOverride:null,clearWhenHidden:false,fixedMode:"shadowless",publishWhenHidden:"static",
        addressAttributes:[{name:"data-material-frame",source:"mode-or-frame",value:null}]}))};
  })));
  return {schema:PREPARED_PRESENTATION_SCHEMA,camera:cameraPlan,sky,sun,inputSelector:".earth-input-surface",
    destinations:{catalog,defaultLens:"normal",statuses:{detail:"WorldCover imagery · 2021. Source gaps retain the Earth base map.",overview:"Earth overview. WorldCover detail is unavailable at this location."}},
    assets:{entries,pools:[preparedResourcePool("mounted",entries,{concurrency:2}),preparedResourcePool("default-materials",entries,{retention:"warm"}),
      preparedResourcePool("pages",entries,{retention:"selection",concurrency:2,capacity:pages*2}),
      ...tracks.map(track=>preparedResourcePool(track.id,entries,{retention:"selection",reuse:true,capacity:track.demand.capacity,concurrency:3,eviction:"capacity",stabilityMilliseconds:120,decoding:"sync"}))],
      startup:[...celestial.map(entry=>entry.key),...pageKeys(lenses.controls.find(lens=>lens.id===lenses.defaultLens)),"poles:normal","shadowless:lighting","default:lighting","default:atmosphere",
        ...plan.material.atmosphere.transport.initialWarmRows.map(row=>`atmosphere:${row}`)]},
    tree,variants,materials:tracks,viewBindings:[materialCounter,cutawayCounter].map(node=>({kind:"counter-rotation",target:index(node),systemTransform:null})),animations:[],
    motionFrame:[index(system),index(body.surface[0])],
    pageLayers:[{id:"city",plan:PREPARED_EARTH_CITY_PAGES,lensIds:["normal","buenos-aires-noise"]},{id:"noise",plan:PREPARED_EARTH_NOISE,lensIds:["buenos-aires-noise"]}]
      .map(layer=>({...layer,plan:{...layer.plan,schema:"cssearth-prepared-map-pages@1",assetPath:"/scenes/earth/"},carrier:index(body.surface[0]),system:index(system),className:"earth-city-page",textureClassName:"earth-api-texture"})),
    observations:{constants:{dom:{interiorMounted:true}},counts:[{category:"dom",name:"interiorLeafCount",target:index(cutaway),kind:"leaves",includeRoot:false}],
      materials:[{category:"material",name:"materialFrame",track:"lighting",field:"frame"}],
      attributes:tracks.map(track=>({category:"material",name:track.id,target:track.target,attribute:"data-material-frame",default:null})),
      sums:["material","camera"].map(category=>({category,name:"materialAddressWrites",tracks:tracks.map(track=>track.id),field:"addressWrites",includePresentation:false}))}};
}
if(import.meta.url===pathToFileURL(process.argv[1]??"").href)await writePreparedPresentation(new URL("../runtime/preparedPresentation.mjs",import.meta.url),await prepareEarthPresentation(),objectControls);
