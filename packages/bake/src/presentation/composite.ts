import { canonicalPreparedAsset, preparedResourcePool, PREPARED_PRESENTATION_SCHEMA, type PreparedVariant, type PreparedWrite, type PreparedResourceEntry } from '@cssearth/objects';

import { POINT_MIN_RADIUS_PX } from '@cssearth/engine';

import type { PresentationInputs, PresentationDraft, SourceMaterialTrack } from './types.ts';
import { prepareSheetLighting } from './lighting-track.ts';
import type { PreparedNode, PresentationAdapters } from './adapters.ts';
import { seamOutsetBinding, seamOutsetInitialValue } from '../scene/index.ts';
import { RASTER_LEVEL_HYSTERESIS, rasterPageName, type RasterPagePlan } from '../raster/index.ts';
import { readsTexture } from './prepared-node-tree.ts';

export async function prepareComposite(input: PresentationInputs, adapters: PresentationAdapters): Promise<PresentationDraft> {
  const { namespace: ns, scene: plan, assets, datasets, sun, solarSource: solarSystemSource } = input;
  const { createPreparedNodeTree, prepareCssomDeclarationReads } = adapters;

  const material=plan.material;
  // An airless body carries a sphere's lighting sheet instead of an atmospheric phase atlas: the composite plane then
  // draws the same sheet the row-bank cutaway uses (lighting-track.ts), and no atmosphere toggle exists.
  const planes=plan.planes??[];
  const atmospheric='lightingUrl' in material && typeof material.lightingUrl==='string';
  if(!atmospheric&&!assets.lighting)throw new TypeError('Airless composite needs the prepared lighting sheet.');
  const sheet=atmospheric?null:prepareSheetLighting(assets.lighting);
  const layers=atmospheric?(["surface","poles","material"] as const):(["surface","poles"] as const);
  // The flood-lit frame loads with the page; the sheet loads when shadows are turned on.
  const warm=atmospheric?[{key:"lighting",url:canonicalPreparedAsset(material.lightingUrl,material.lighting2xUrl),pool:"warm"}]
    :sheet!.entries.filter(entry=>entry.pool==="warm");
  const lightingSheet=sheet?sheet.entries.filter(entry=>entry.pool!=="warm"):[];
  // A surface too large to decode as one image comes as pages, each at every level (preparation/raster/pages.ts).
  const paged=pagedSurface(plan.body.surfacePages,datasets);
  const entries=[...warm,...datasets.controls.flatMap(dataset=>layers.filter(layer=>!(paged&&layer==="surface")).map(layer=>({key:`${layer}:${dataset.id}`,
    url:canonicalPreparedAsset(dataset[`${layer}Url`],dataset[`${layer}2xUrl`]),pool:"material"}))),...(paged?.entries??[]),...lightingSheet,
    ...planes.map(entry=>({key:entry.id,url:entry.url,pool:"warm"}))];
  const required=(id: string)=>[...(paged?.keys(id)??[]),...layers.filter(layer=>!(paged&&layer==="surface")).map(layer=>`${layer}:${id}`),
    ...(sheet?.required??[])];
  const b=createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads([...plan.body.leaves,...planes.flatMap(entry=>entry.leaves)].map(leaf => leaf.style)) });
  const camera=b.element("div","polycss-camera object-render-root");
  const scene=b.element("div","polycss-scene",`transform:${plan.camera.defaultTransform}`,{"aria-hidden":"true","data-polycss-lighting":"baked"});
  const system=b.mesh(`${ns}-system`,`transform:${plan.systemTransform}`),body=b.mesh(`${ns}-body`,"",{style:""});
  const seamOutset=plan.body.seamRepair?.outset;
  if(seamOutset)system.style.setProperty(seamOutset.property,seamOutsetInitialValue(seamOutset,plan.camera.logicalBodyDiameter));
  b.append(null,camera);b.append(camera,scene);b.append(scene,system);b.append(system,body);
  // A page face names its page already; a cap draws the pole write on the body.
  for(const leaf of plan.body.leaves)b.append(body,(leaf.className??"").split(/\s+/u).includes(`${ns}-polar`)?readsTexture(b.leaf(leaf),`--${ns}-poles-image`):b.leaf(leaf));
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
  const track: SourceMaterialTrack=atmospheric?{id:"lighting",target:index(plane),frame:{source:"sun-z",minimum:material.minimumLightViewZ,
    maximum:material.maximumLightViewZ,count:material.frameCount,baseFrame:0,span:material.directionalFrameCount-1,
    maximumFrame:material.directionalFrameCount-1,remap:null},
    banks:[{id:"lighting",frames:material.backgroundPositions.map((backgroundPosition,frame)=>({
      resource:null,frame,row:null,backgroundPosition,backgroundSize:material.backgroundSize})),default:null,fixed:null}],
    demand:{ capacity:1, defaultFrame:material.defaultFrame },
    rotation:{kind:"angle",source:"view-sun",reference:"prepared",baseDegrees:material.baseLightAzimuthDegrees,
      zeroAtPole:false},frameAttribute:null,modeAttribute:null,quoted:true}
  :sheet!.track(index(plane));
  const variants: PreparedVariant[]=[];
  const atmospheres: (boolean|null)[]=atmospheric?[false,true]:[null];
  const ringNode = planeNodes.get('rings');
  const ringStates: (boolean|null)[] = ringNode ? [false,true] : [null];
  for(const dataset of datasets.controls)for(const atmosphere of atmospheres)for(const shadows of [false,true])for(const rings of ringStates){
    const focus=input.datasetFocus?.[dataset.id];
    variants.push({...(focus?{navigation:adapters.prepareDatasetNavigation(solarSystemSource.bodyId,focus,plan.camera)}:{}),when:{datasetId:dataset.id,...(atmosphere===null?{}:{atmosphere}),shadows,...(rings===null?{}:{rings})},required:required(dataset.id),writes:[
      {kind:"attribute",target:-1,name:"data-dataset",value:dataset.id},{kind:"attribute",target:-1,name:"data-view",value:null},
      // Each dataset's own images reach the leaves through these textures (scene/projector.ts binds every leaf to them).
      ...(paged?paged.keys(dataset.id).map((resource,page)=>({kind:"texture",target:index(body),name:`--${ns}-surface-page-${page}`,resource,quoted:true} as PreparedWrite))
        :[{kind:"texture",target:index(body),name:`--${ns}-surface-image`,resource:`surface:${dataset.id}`,quoted:true} as PreparedWrite]),
      {kind:"texture",target:index(body),name:`--${ns}-poles-image`,resource:`poles:${dataset.id}`,quoted:true} as PreparedWrite,
      ...(atmosphere===null?[]:[{kind:"class",target:-1,name:`${ns}-hide-atmosphere`,value:!atmosphere} as PreparedWrite]),
      ...(atmospheric?[]:[{kind:"class",target:-1,name:`${ns}-hide-shadows`,value:!shadows} as PreparedWrite]),
      ...(ringNode && rings!==null?[{kind:"style",target:index(ringNode),name:"display",value:rings?"block":"none"} as PreparedWrite]:[]),
    ],materials:[atmospheric?{track:"lighting",bank:"lighting",mode:"frames",enabled:true,rotationEnabled:shadows,
      frameOverride:shadows?null:material.frameCount-1,clearWhenHidden:false,fixedMode:"shadowless"}
      :sheet!.selection(shadows)]});
  }
  return {schema:PREPARED_PRESENTATION_SCHEMA,camera:plan.camera,sky:plan.starfield,sun:sun,
    ...(paged?{textureLevels:paged.textureLevels}:{}),
    assets:{entries,pools:[preparedResourcePool("warm",entries,{retention:"warm"}),
      preparedResourcePool("material",entries,{retention:"selection",capacity:6,concurrency:6}),
      ...(paged?[preparedResourcePool("pages",entries,{retention:"selection",concurrency:2,capacity:paged.pageCount*2*paged.textureLevels.levels.length,
        eviction:"capacity",maximumDecodedBytes:paged.maximumDecodedBytes})]:[]),
      ...(sheet?[sheet.pool(entries)]:[])],
      // A paged surface starts at its first level, the one the first selection chooses. The lighting sheet is not a
      // startup asset: shadows start off, which shows the one flood-lit frame, and the sheet loads when shadows are turned on.
      startup:[...new Set([...warm.map(entry=>entry.key),...required(datasets.defaultDataset).map(key=>paged?.textureLevels.levels[0]!.resources[key]??key)])]},
    tree,variants,...(atmospheric?{}:{resourceOrder:"materials-first" as const}),materials:[track],
    viewBindings:[{kind:"silhouette-fit",target:index(composite),minimumRadius:POINT_MIN_RADIUS_PX,
      unitScale:2/plan.camera.logicalBodyDiameter},
      // No camera-pose attributes: nothing reads them, and a camera move would rewrite them every frame
      // (docs/performance/motion-freezes-membership.md).
      {kind:"view-attribute",target:-1,property:"data-lod",source:"level-of-detail-stage",precision:null},
      ...(seamOutset?[seamOutsetBinding(seamOutset,index(system))]:[])],
    animations:[],
  };
}

/** Page resources of every dataset at every level: `surface:<dataset>:<page>` is the full page, and each smaller level maps it
 * to `surface:<dataset>:<page>:level:<width>`, the page's `-level-<width>` file (preparation/raster/pages.ts). */
function pagedSurface(pages: RasterPagePlan | undefined, datasets: PresentationInputs['datasets']) {
  if (!pages) return null;
  const entries: PreparedResourceEntry[] = [];
  const levels = pages.levelDiameters.map(minimumDiameter => ({ minimumDiameter, resources: {} as Record<string, string> }));
  const keys = (id: string) => Array.from({ length: pages.pageCount }, (_, page) => `surface:${id}:${page}`);
  let largest = 0;
  for (const dataset of datasets.controls) {
    const url = canonicalPreparedAsset(dataset.surfaceUrl, dataset.surface2xUrl), cut = url.lastIndexOf('/') + 1, name = url.slice(cut);
    const surface = pages.surfaces.find(entry => entry.name === name);
    if (!surface) throw new TypeError(`Dataset ${dataset.id} shows ${name}, which is not a paged surface of this body (${pages.surfaces.map(entry => entry.name).join(', ')}).`);
    for (const [page, key] of keys(dataset.id).entries()) {
      // One resource per published reduction; a level names the reduction this surface shows there (pages.ts).
      const resources = new Map(pages.reductions.map(factor => {
        const width = surface.width / factor, resource = factor === 1 ? key : `${key}:level:${width}`;
        entries.push({ key: resource, url: url.slice(0, cut) + rasterPageName(name, page, factor === 1 ? undefined : width),
          pool: 'pages', decodedBytes: width * surface.pageRows / factor * 4 });
        return [factor as number, resource] as const;
      }));
      surface.levelReductions.forEach((reduction, level) => { levels[level]!.resources[key] = resources.get(reduction)!; });
    }
    largest = Math.max(largest, surface.width * surface.pageRows * 4 * pages.pageCount);
  }
  // Two complete datasets at full resolution can coexist during a dataset switch, as Earth's pages allow.
  return { entries, keys, pageCount: pages.pageCount, maximumDecodedBytes: 2 * largest,
    textureLevels: { hysteresis: RASTER_LEVEL_HYSTERESIS, levels } };
}
