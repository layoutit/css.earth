import { CANONICAL_PREPARED_IMAGE_DENSITY, canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from '../../rendering/prepared-object-assets.js';
import { POINT_MIN_RADIUS_PX } from '@cssearth/engine';
import type { PreparedVariant, PreparedWrite } from '../../rendering/prepared-presentation.js';
import type { AtlasAddress, PresentationInputs, PresentationDraft, SourceMaterialTrack } from './types.js';
import type { PreparedNode, PresentationAdapters } from './adapters.js';
const PREPARED_PRESENTATION_SCHEMA = 'cssearth-prepared-presentation@3';
const BILLBOARD_LIGHTING_KEY = 'lighting-billboard';
export async function prepareComposite(input: PresentationInputs, adapters: PresentationAdapters): Promise<PresentationDraft> {
  const { namespace: ns, scene: plan, assets, lenses, sun, markers: systemMarkerStrip, solarSource: solarSystemSource } = input;
  const { createPreparedNodeTree, prepareCssomDeclarationReads, prepareCatalogueStars, prepareSolarSystemPresentation, navigationMarkers: PREPARED_NAVIGATION_MARKERS } = adapters;

  const material=plan.material;
  const layers=["surface","poles","material"] as const;
  const warm=[...preparedSkyResources(plan.starfield,sun,"warm"),
    {key:"lighting",url:canonicalPreparedAsset(material.lightingUrl,material.lighting2xUrl),pool:"warm"}];
  const entries=[...warm,...lenses.controls.flatMap(lens=>layers.map(layer=>({key:`${layer}:${lens.id}`,
    url:canonicalPreparedAsset(lens[`${layer}Url`],lens[`${layer}2xUrl`]),pool:"material"})))];
  const required=(id: string)=>layers.map(layer=>`${layer}:${id}`);
  const b=createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(plan.body.leaves.map(leaf => leaf.style)) });
  const camera=b.element("div","polycss-camera planet-render-root");
  const scene=b.element("div","polycss-scene",`transform:${plan.camera.defaultTransform}`,{"aria-hidden":"true","data-polycss-lighting":"baked"});
  const system=b.mesh(`${ns}-system`,`transform:${plan.systemTransform}`),body=b.mesh(`${ns}-body`,"",{style:""});
  b.append(null,camera);b.append(camera,scene);b.append(scene,system);b.append(system,body);
  for(const leaf of plan.body.leaves)b.append(body,b.leaf(leaf));
  const composite=b.element("div",`${ns}-material-composite planet-render-root`,"",{"aria-hidden":"true"});
  const plane=b.element("s",`${ns}-fixed-material`);
  plane.style.backgroundSize=material.backgroundSize;
  plane.style.backgroundPosition=material.backgroundPositions[material.defaultFrame];
  b.append(null,composite);b.append(composite,plane);
  const {tree,index}=b.finish({camera,scene});
  const track: SourceMaterialTrack={id:"lighting",target:index(plane),frame:{source:"sun-z",minimum:material.minimumLightViewZ,
    maximum:material.maximumLightViewZ,count:material.frameCount,baseFrame:0,span:material.directionalFrameCount-1,
    maximumFrame:material.directionalFrameCount-1,remap:null},
    banks:[{id:"lighting",frames:material.backgroundPositions.map((backgroundPosition,frame)=>({
      resource:null,frame,row:null,backgroundPosition,backgroundSize:material.backgroundSize})),default:null,fixed:null}],
    demand:{ capacity:1, defaultFrame:material.defaultFrame },
    rotation:{kind:"angle",source:"view-sun",reference:"prepared",baseDegrees:material.baseLightAzimuthDegrees,
      zeroAtPole:false,property:`--${ns}-light-roll`},frameAttribute:null,modeAttribute:null,quoted:true};
  const variants: PreparedVariant[]=[];
  for(const lens of lenses.controls)for(const atmosphere of [false,true])for(const stars of [false,true])for(const shadows of [false,true]){
    variants.push({when:{lensId:lens.id,atmosphere,stars,shadows},required:required(lens.id),writes:[
      {kind:"attribute",target:-1,name:"data-lens",value:lens.id},{kind:"attribute",target:-1,name:"data-view",value:null},
      {kind:"class",target:-1,name:`${ns}-hide-atmosphere`,value:!atmosphere},
      {kind:"class",target:-1,name:`${ns}-hide-stars`,value:!stars},
    ],materials:[{track:"lighting",bank:"lighting",mode:"frames",enabled:true,rotationEnabled:shadows,
      frameOverride:shadows?null:material.frameCount-1,clearWhenHidden:false,fixedMode:"shadowless"}]});
  }
  const catalogue = await prepareCatalogueStars({ fovDegrees: plan.starfield.catalogueStars.exposure.fovDegrees });
  const heliocentricView = prepareSolarSystemPresentation({
    bodyId: solarSystemSource.bodyId, plan: plan.heliocentricView,
    navigationMarkers: PREPARED_NAVIGATION_MARKERS, markerAtlasUrl: solarSystemSource.markerAtlasUrl,
    systemMarkerStrip: systemMarkerStrip, captionNames: solarSystemSource.captionNames, catalogue,
    phaseAtlas: { url: canonicalPreparedAsset(material.lightingUrl, material.lighting2xUrl),
      columns: material.frameColumns, rowCount: material.frameRows, frameCount: material.directionalFrameCount,
      minimumLightViewZ: material.minimumLightViewZ, maximumLightViewZ: material.maximumLightViewZ,
      baseLightAzimuthDegrees: material.baseLightAzimuthDegrees },
  });
  return {schema:PREPARED_PRESENTATION_SCHEMA,camera:plan.camera,sky:plan.starfield,sun:sun,
    assets:{entries,pools:[preparedResourcePool("warm",entries,{retention:"warm"}),
      preparedResourcePool("material",entries,{retention:"selection",capacity:6,concurrency:6})],
      startup:[...warm.map(entry=>entry.key),...required(lenses.defaultLens)]},tree,variants,materials:[track],
    heliocentricView,
    viewBindings:[{kind:"silhouette-fit",target:index(composite),minimumRadius:POINT_MIN_RADIUS_PX,
      unitScale:2/plan.camera.logicalBodyDiameter},
      {kind:"view-attribute",target:-1,property:"data-lod",source:"level-of-detail-stage",precision:null},
      ...([["data-polycss-camera-rot-x","scene-pitch",2],["data-polycss-camera-rot-y","control-yaw",null],
        ["data-polycss-camera-zoom","zoom",null],[`data-${ns}-camera-matrix`,"scene-matrix",null]] as const)
        .map(([property,source,precision])=>({kind:"view-attribute" as const,target:index(camera),property,source,precision}))],
    animations:[],
  };
}
