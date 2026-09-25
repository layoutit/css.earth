import { CANONICAL_PREPARED_IMAGE_DENSITY, canonicalPreparedAsset, preparedResourcePool } from '../../rendering/prepared-object-assets.js';
import { POINT_MIN_RADIUS_PX } from '@cssearth/engine';
import type { PreparedVariant, PreparedWrite } from '../../rendering/prepared-presentation.js';
import type { AtlasAddress, PresentationInputs, PresentationDraft, SourceMaterialTrack } from './types.js';
import type { PreparedNode, PresentationAdapters } from './adapters.js';
import { seamOutsetBinding, seamOutsetInitialValue } from '../scene/seam-outset.js';
import { RASTER_LEVEL_FACTORS, RASTER_LEVEL_HYSTERESIS, rasterPageName, type RasterPagePlan } from '../../../../preparation/raster/pages.js';
import type { PreparedResourceEntry } from '../../rendering/prepared-residency.js';
const PREPARED_PRESENTATION_SCHEMA = 'cssearth-prepared-presentation@3';
const BILLBOARD_LIGHTING_KEY = 'lighting-billboard', SHADOWLESS_BILLBOARD_KEY = 'shadowless-billboard';
export async function prepareComposite(input: PresentationInputs, adapters: PresentationAdapters): Promise<PresentationDraft> {
  const { namespace: ns, scene: plan, assets, lenses, sun, solarSource: solarSystemSource } = input;
  const { createPreparedNodeTree, prepareCssomDeclarationReads } = adapters;

  const material=plan.material;
  // An airless body carries Mercury's Lambert row bank instead of an atmospheric phase atlas: the composite plane
  // then streams the same row shards and billboard the row-bank cutaway uses, and no atmosphere toggle exists.
  const planes=plan.planes??[];
  const atmospheric='lightingUrl' in material && typeof material.lightingUrl==='string';
  const bank=atmospheric?null:assets.lighting?.banks[String(CANONICAL_PREPARED_IMAGE_DENSITY)];
  if(!atmospheric&&(!bank||!bank.billboard||bank.billboard.presentations.length!==assets.lighting.frameCount))throw new TypeError('Airless composite needs the prepared lighting bank and billboard atlas.');
  const layers=atmospheric?(["surface","poles","material"] as const):(["surface","poles"] as const);
  const warm=[
    ...(atmospheric?[{key:"lighting",url:canonicalPreparedAsset(material.lightingUrl,material.lighting2xUrl),pool:"warm"}]
      :[{key:"shadowless",url:bank!.shadowless.url,pool:"warm"},{key:SHADOWLESS_BILLBOARD_KEY,url:bank!.billboard.shadowless.url,pool:"warm"}])];
  // The billboard atlas serves the far view with shadows on; it loads when that view needs a frame.
  const billboardAtlas=atmospheric?[]:[{key:BILLBOARD_LIGHTING_KEY,url:bank!.billboard.url,pool:"billboard"}];
  const lightingRows=atmospheric?[]:bank!.rows.map((row,index)=>({key:`lighting:${index}`,url:row.url,pool:"lighting"}));
  // A surface too large to decode as one image comes as pages, each at every level (preparation/raster/pages.ts).
  const paged=pagedSurface(plan.body.surfacePages,lenses);
  const entries=[...warm,...lenses.controls.flatMap(lens=>layers.filter(layer=>!(paged&&layer==="surface")).map(layer=>({key:`${layer}:${lens.id}`,
    url:canonicalPreparedAsset(lens[`${layer}Url`],lens[`${layer}2xUrl`]),pool:"material"}))),...(paged?.entries??[]),...lightingRows,...billboardAtlas,
    ...planes.map(entry=>({key:entry.id,url:entry.url,pool:"warm"}))];
  const required=(id: string)=>[...(paged?.keys(id)??[]),...layers.filter(layer=>!(paged&&layer==="surface")).map(layer=>`${layer}:${id}`),
    ...(atmospheric?[]:["shadowless",SHADOWLESS_BILLBOARD_KEY])];
  const b=createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads([...plan.body.leaves,...planes.flatMap(entry=>entry.leaves)].map(leaf => leaf.style)) });
  const camera=b.element("div","polycss-camera object-render-root");
  const scene=b.element("div","polycss-scene",`transform:${plan.camera.defaultTransform}`,{"aria-hidden":"true","data-polycss-lighting":"baked"});
  const system=b.mesh(`${ns}-system`,`transform:${plan.systemTransform}`),body=b.mesh(`${ns}-body`,"",{style:""});
  const seamOutset=plan.body.seamRepair?.outset;
  if(seamOutset)system.style.setProperty(seamOutset.property,seamOutsetInitialValue(seamOutset,plan.camera.logicalBodyDiameter));
  b.append(null,camera);b.append(camera,scene);b.append(scene,system);b.append(system,body);
  for(const leaf of plan.body.leaves)b.append(body,b.leaf(leaf));
  // A ring hangs beside the body under the system node, so the body's orientation carries it.
  const planeNodes = new Map<string, PreparedNode>();
  for(const entry of planes){
    const mesh=b.mesh(`${entry.className}`,"",{style:""});
    planeNodes.set(entry.id, mesh);
    b.append(system,mesh);
    for(const leaf of entry.leaves){
      const node=b.leaf(leaf);
      node.style.backgroundImage=`url(${entry.url})`;
      b.append(mesh,node);
    }
  }
  const composite=b.element("div",`${ns}-material-composite object-render-root`,"",{"aria-hidden":"true"});
  const plane=b.element("s",`${ns}-fixed-material`);
  if(atmospheric){plane.style.backgroundSize=material.backgroundSize;plane.style.backgroundPosition=material.backgroundPositions[material.defaultFrame];}
  b.append(null,composite);b.append(composite,plane);
  const {tree,index}=b.finish({camera,scene});
  const address=(p: AtlasAddress,resource=`lighting:${p.rowIndex}`,row=p.rowIndex)=>({resource,frame:p.frameIndex,row,backgroundPosition:p.backgroundPosition,backgroundSize:p.backgroundSize});
  const billboardAddress=(p: AtlasAddress)=>address(p,BILLBOARD_LIGHTING_KEY,0);
  const track: SourceMaterialTrack=atmospheric?{id:"lighting",target:index(plane),frame:{source:"sun-z",minimum:material.minimumLightViewZ,
    maximum:material.maximumLightViewZ,count:material.frameCount,baseFrame:0,span:material.directionalFrameCount-1,
    maximumFrame:material.directionalFrameCount-1,remap:null},
    banks:[{id:"lighting",frames:material.backgroundPositions.map((backgroundPosition,frame)=>({
      resource:null,frame,row:null,backgroundPosition,backgroundSize:material.backgroundSize})),default:null,fixed:null}],
    demand:{ capacity:1, defaultFrame:material.defaultFrame },
    rotation:{kind:"angle",source:"view-sun",reference:"prepared",baseDegrees:material.baseLightAzimuthDegrees,
      zeroAtPole:false,property:`--${ns}-light-roll`},frameAttribute:null,modeAttribute:null,quoted:true}
  :{id:"lighting",target:index(plane),frame:{source:"sun-z",minimum:assets.lighting.minimumLightViewZ,maximum:assets.lighting.maximumLightViewZ,
      count:assets.lighting.frameCount,baseFrame:0,remap:null},
    banks:[{id:"rows",frames:bank!.presentations.map(p=>address(p)),default:null,fixed:{resource:"shadowless",frame:bank!.shadowless.frameIndex,row:null,backgroundPosition:bank!.shadowless.backgroundPosition,backgroundSize:bank!.shadowless.backgroundSize},
      rows:bank!.rows.map((_,row)=>({row,resource:`lighting:${row}`,firstFrame:row*bank!.transport.framesPerRow,
        lastFrame:Math.min(bank!.presentations.length-1,(row+1)*bank!.transport.framesPerRow-1)}))},
     {id:"billboard",frames:bank!.billboard.presentations.map(billboardAddress),default:null,fixed:{resource:SHADOWLESS_BILLBOARD_KEY,frame:bank!.billboard.shadowless.frameIndex,row:null,
       backgroundPosition:bank!.billboard.shadowless.backgroundPosition,backgroundSize:bank!.billboard.shadowless.backgroundSize},
      rows:[{row:0,resource:BILLBOARD_LIGHTING_KEY,firstFrame:0,lastFrame:bank!.billboard.presentations.length-1}]}],
    farBank:"billboard",
    demand:{capacity:bank!.transport.maximumRetainedRowCount,defaultFrame:bank!.transport.defaultFrame},
    rotation:{kind:"angle",source:"view-sun",reference:"prepared",baseDegrees:assets.lighting.baseLightAzimuthDegrees,
      zeroAtPole:false,property:`--${ns}-light-roll`},frameAttribute:null,modeAttribute:null,quoted:true};
  const variants: PreparedVariant[]=[];
  const atmospheres: (boolean|null)[]=atmospheric?[false,true]:[null];
  const ringNode = planeNodes.get('rings');
  const ringStates: (boolean|null)[] = ringNode ? [false,true] : [null];
  for(const lens of lenses.controls)for(const atmosphere of atmospheres)for(const shadows of [false,true])for(const rings of ringStates){
    const focus=input.lensFocus?.[lens.id];
    variants.push({...(focus?{navigation:adapters.prepareLensNavigation(solarSystemSource.bodyId,focus,plan.camera)}:{}),when:{lensId:lens.id,...(atmosphere===null?{}:{atmosphere}),shadows,...(rings===null?{}:{rings})},required:required(lens.id),writes:[
      {kind:"attribute",target:-1,name:"data-lens",value:lens.id},{kind:"attribute",target:-1,name:"data-view",value:null},
      // Each lens's own images reach the leaves through these textures (scene/projector.ts binds every leaf to them).
      ...(paged?paged.keys(lens.id).map((resource,page)=>({kind:"texture",target:index(body),name:`--${ns}-surface-page-${page}`,resource,quoted:true} as PreparedWrite))
        :[{kind:"texture",target:index(body),name:`--${ns}-surface-image`,resource:`surface:${lens.id}`,quoted:true} as PreparedWrite]),
      {kind:"texture",target:index(body),name:`--${ns}-poles-image`,resource:`poles:${lens.id}`,quoted:true} as PreparedWrite,
      ...(atmosphere===null?[]:[{kind:"class",target:-1,name:`${ns}-hide-atmosphere`,value:!atmosphere} as PreparedWrite]),
      ...(atmospheric?[]:[{kind:"class",target:-1,name:`${ns}-hide-shadows`,value:!shadows} as PreparedWrite]),
      ...(ringNode && rings!==null?[{kind:"style",target:index(ringNode),name:"display",value:rings?"block":"none"} as PreparedWrite]:[]),
    ],materials:[atmospheric?{track:"lighting",bank:"lighting",mode:"frames",enabled:true,rotationEnabled:shadows,
      frameOverride:shadows?null:material.frameCount-1,clearWhenHidden:false,fixedMode:"shadowless"}
      :{track:"lighting",bank:"rows",mode:shadows?"frames":"fixed",enabled:true,rotationEnabled:shadows,
        frameOverride:shadows?null:assets.lighting.frameCount-1,clearWhenHidden:false,fixedMode:"full-phase-curvature",
        modeLabel:shadows?"directional-terminator":"full-phase-curvature",
        addressAttributes:[{name:"data-material-frame",source:shadows?"frame":"literal",value:null},
          {name:"data-material-mode",source:"literal",value:shadows?null:"full-phase-curvature"}]}]});
  }
  return {schema:PREPARED_PRESENTATION_SCHEMA,camera:plan.camera,sky:plan.starfield,sun:sun,
    ...(paged?{textureLevels:paged.textureLevels}:{}),
    assets:{entries,pools:[preparedResourcePool("warm",entries,{retention:"warm"}),
      preparedResourcePool("material",entries,{retention:"selection",capacity:6,concurrency:6}),
      ...(paged?[preparedResourcePool("pages",entries,{retention:"selection",concurrency:2,capacity:paged.pageCount*2*paged.textureLevels.levels.length,
        eviction:"capacity",maximumDecodedBytes:paged.maximumDecodedBytes})]:[]),
      ...(atmospheric?[]:[preparedResourcePool("lighting",entries,{retention:"selection",decoding:"sync",capacity:bank!.transport.maximumRetainedRowCount,
        concurrency:bank!.transport.maximumRetainedRowCount,eviction:"capacity",reuse:true}),
        preparedResourcePool("billboard",entries,{retention:"selection",decoding:"sync"})])],
      // A paged surface starts at its first level, the one the first selection chooses. Lighting rows are not startup
      // assets: shadows start off, which shows the one shadowless frame, and the rows load when shadows are turned on.
      startup:[...new Set([...warm.map(entry=>entry.key),...required(lenses.defaultLens).map(key=>paged?.textureLevels.levels[0]!.resources[key]??key)])]},
    tree,variants,...(atmospheric?{}:{resourceOrder:"materials-first" as const}),materials:[track],
    viewBindings:[{kind:"silhouette-fit",target:index(composite),minimumRadius:POINT_MIN_RADIUS_PX,
      unitScale:2/plan.camera.logicalBodyDiameter},
      {kind:"view-attribute",target:-1,property:"data-lod",source:"level-of-detail-stage",precision:null},
      ...([["data-polycss-camera-rot-x","scene-pitch",2],["data-polycss-camera-rot-y","control-yaw",null],
        ["data-polycss-camera-zoom","zoom",null],[`data-${ns}-camera-matrix`,"scene-matrix",null]] as const)
        .map(([property,source,precision])=>({kind:"view-attribute" as const,target:index(camera),property,source,precision})),
      ...(seamOutset?[seamOutsetBinding(seamOutset,index(system))]:[])],
    animations:[],
  };
}

/** Page resources of every lens at every level: `surface:<lens>:<page>` is the full page, and each smaller level maps it
 * to `surface:<lens>:<page>:level:<width>`, the page's `-level-<width>` file (preparation/raster/pages.ts). */
function pagedSurface(pages: RasterPagePlan | undefined, lenses: PresentationInputs['lenses']) {
  if (!pages) return null;
  const last = RASTER_LEVEL_FACTORS.length - 1, entries: PreparedResourceEntry[] = [];
  const levels = pages.levelDiameters.map(minimumDiameter => ({ minimumDiameter, resources: {} as Record<string, string> }));
  const keys = (id: string) => Array.from({ length: pages.pageCount }, (_, page) => `surface:${id}:${page}`);
  let largest = 0;
  for (const lens of lenses.controls) {
    const url = canonicalPreparedAsset(lens.surfaceUrl, lens.surface2xUrl), cut = url.lastIndexOf('/') + 1, name = url.slice(cut);
    const surface = pages.surfaces.find(entry => entry.name === name);
    if (!surface) throw new TypeError(`Lens ${lens.id} shows ${name}, which is not a paged surface of this body (${pages.surfaces.map(entry => entry.name).join(', ')}).`);
    for (const [page, key] of keys(lens.id).entries()) RASTER_LEVEL_FACTORS.forEach((factor, level) => {
      const width = surface.width / factor, resource = level === last ? key : `${key}:level:${width}`;
      entries.push({ key: resource, url: url.slice(0, cut) + rasterPageName(name, page, level === last ? undefined : width),
        pool: 'pages', decodedBytes: width * surface.pageRows / factor * 4 });
      levels[level]!.resources[key] = resource;
    });
    largest = Math.max(largest, surface.width * surface.pageRows * 4 * pages.pageCount);
  }
  // Two complete lenses at full resolution can coexist during a lens switch, as Earth's pages allow.
  return { entries, keys, pageCount: pages.pageCount, maximumDecodedBytes: 2 * largest,
    textureLevels: { hysteresis: RASTER_LEVEL_HYSTERESIS, levels } };
}

