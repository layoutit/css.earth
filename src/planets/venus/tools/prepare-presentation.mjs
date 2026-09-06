import { pathToFileURL } from "node:url";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { prepareCssomDeclarationReads } from "../../../../tools/prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../../../tools/prepared-node-tree.mjs";
import { writePreparedPresentation } from "../../../../tools/prepare-presentation.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_VENUS_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_VENUS_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_VENUS_SKY_SUN } from "../runtime/preparedSkySun.mjs";

export async function prepareVenusPresentation() {
  const plan=PREPARED_VENUS_SCENE,lenses=PREPARED_VENUS_LENSES,material=plan.material;
  const layers=["surface","poles","material"];
  const warm=[...preparedSkyResources(plan.starfield,PREPARED_VENUS_SKY_SUN,"warm"),
    {key:"lighting",url:canonicalPreparedAsset(material.lightingUrl,material.lighting2xUrl),pool:"warm"}];
  const entries=[...warm,...lenses.controls.flatMap(lens=>layers.map(layer=>({key:`${layer}:${lens.id}`,
    url:canonicalPreparedAsset(lens[`${layer}Url`],lens[`${layer}2xUrl`]),pool:"material"})))];
  const required=id=>layers.map(layer=>`${layer}:${id}`);
  const b=createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(plan.body.leaves.map(leaf => leaf.style)) });
  const camera=b.element("div","polycss-camera planet-render-root",plan.camera.style);
  const scene=b.element("div","polycss-scene",plan.camera.sceneStyle,{"aria-hidden":"true","data-polycss-lighting":"baked"});
  const system=b.mesh("venus-system",`transform:rotateY(${-plan.body.axialTiltDegrees}deg)`),body=b.mesh("venus-body","",{style:""});
  b.append(null,camera);b.append(camera,scene);b.append(scene,system);b.append(system,body);
  for(const leaf of plan.body.leaves)b.append(body,b.leaf(leaf));
  const composite=b.element("div","venus-material-composite planet-render-root","",{"aria-hidden":"true"});
  composite.style.setProperty("--venus-camera-zoom",String(plan.camera.defaultZoom));
  const plane=b.element("s","venus-fixed-material");
  plane.style.backgroundSize=material.backgroundSize;
  plane.style.backgroundPosition=material.backgroundPositions[material.defaultFrame];
  b.append(null,composite);b.append(composite,plane);
  const {tree,index}=b.finish({camera,scene});
  const sourceRemap=material.lightingModel.presentationPhaseRemap;
  const track={id:"lighting",target:index(plane),frame:{source:"sun-z",minimum:material.minimumLightViewZ,
    maximum:material.maximumLightViewZ,count:material.frameCount,baseFrame:0,span:material.directionalFrameCount-1,
    maximumFrame:material.directionalFrameCount-1,remap:{kind:"phase-plateau",lowerTransition:sourceRemap.lowerTransition,
      plateau:sourceRemap.plateau,upperTransition:sourceRemap.upperTransition,plateauViewZ:sourceRemap.plateauViewZ}},
    banks:[{id:"lighting",frames:material.backgroundPositions.map((backgroundPosition,frame)=>({
      resource:null,frame,row:null,backgroundPosition,backgroundSize:material.backgroundSize})),default:null,fixed:null}],
    demand:{ capacity:1, defaultFrame:material.defaultFrame },
    rotation:{kind:"angle",source:"view-sun",reference:"prepared",baseDegrees:material.baseLightAzimuthDegrees,
      zeroAtPole:false,property:"--venus-light-roll"},frameAttribute:null,modeAttribute:null,quoted:true};
  const variants=[];
  for(const lens of lenses.controls)for(const atmosphere of [false,true])for(const stars of [false,true])for(const shadows of [false,true]){
    variants.push({when:{lensId:lens.id,atmosphere,stars,shadows},required:required(lens.id),writes:[
      {kind:"attribute",target:-1,name:"data-lens",value:lens.id},{kind:"attribute",target:-1,name:"data-view",value:null},
      {kind:"class",target:-1,name:"venus-hide-atmosphere",value:!atmosphere},
      {kind:"class",target:-1,name:"venus-hide-stars",value:!stars},
    ],materials:[{track:"lighting",bank:"lighting",mode:"frames",enabled:true,rotationEnabled:shadows,
      frameOverride:shadows?null:material.frameCount-1,clearWhenHidden:false,fixedMode:"shadowless"}]});
  }
  return {schema:PREPARED_PRESENTATION_SCHEMA,camera:plan.camera,sky:plan.starfield,sun:PREPARED_VENUS_SKY_SUN,
    inputSelector:".venus-input-surface",assets:{entries,pools:[preparedResourcePool("warm",entries,{retention:"warm"}),
      preparedResourcePool("material",entries,{retention:"selection",capacity:6,concurrency:6})],
      startup:[...warm.map(entry=>entry.key),...required(lenses.defaultLens)]},tree,variants,materials:[track],
    viewBindings:[{kind:"zoom-property",target:index(composite),property:"--venus-camera-zoom"},
      ...[["data-polycss-camera-rot-x","scene-pitch",2],["data-polycss-camera-rot-y","control-yaw",null],
        ["data-polycss-camera-zoom","zoom",null],["data-venus-camera-matrix","scene-matrix",null]]
        .map(([property,source,precision])=>({kind:"view-attribute",target:index(camera),property,source,precision}))],
    animations:[],
  };
}
if(import.meta.url===pathToFileURL(process.argv[1]??"").href){
  await writePreparedPresentation(new URL("../runtime/preparedPresentation.mjs",import.meta.url),await prepareVenusPresentation(),objectControls);
}
