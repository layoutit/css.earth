import type { prepareTextureLevels, TextureLevelConfiguration } from './texture-levels.mts';
import type { PreparedNode } from '../../prepared/prepared-node-tree.mts';
import type { MaterialSourceTrack } from '../../prepare/prepare-materials.mts';
import type { PreparedCubicSkyPlan } from '../../../src/platform/cubic-sky-contract.mts';
import type { PreparedDirectionalSunPlan } from '../../../src/platform/directional-sun-contract.mts';
import type { ShellObjectControls } from '../../../site/shell-contract-types.mts';
import type { preparePagedEllipsoidScene } from './scene.mts';
import type { preparePlaces } from './geographic/places.mts';
import type { CameraPlan } from '../../../src/renderers/css/navigation/types.ts';
import type { SurfaceBankLenses } from './contracts.mts';
import { requireRecord, requireString } from '@cssearth/core';
type PagedPlan = ReturnType<typeof preparePagedEllipsoidScene>['scene'];
type MaterialId = 'lighting' | 'atmosphere';
export type PagedLens = SurfaceBankLenses['controls'][number] & { maximumZoom: number; polesUrl?: string;
  interiorTextures?: Readonly<Record<string, string>>; camera?: {controlPitch: number; controlYaw: number; controlRoll?: number; zoom: number; transition?: {durationMilliseconds: number; preserveZoom: boolean}} };
interface PresentationConfiguration { textureLevels?: TextureLevelConfiguration; camera: CameraPlan; namespace: string; publicBase: string; sceneBodyKey: string;
  destinations: {statuses: {detail: string; overview: string}}; }
export interface PagedPresentationInput { config: PresentationConfiguration; plan: PagedPlan; lenses: {defaultLens: string; controls: readonly PagedLens[]};
  textureLevels?: Awaited<ReturnType<typeof prepareTextureLevels>>; sky: PreparedCubicSkyPlan; sun: PreparedDirectionalSunPlan; controls: ShellObjectControls;
  catalog?: Awaited<ReturnType<typeof preparePlaces>>; }
const materialIds: readonly MaterialId[] = ['lighting', 'atmosphere'];
import { canonicalPreparedAsset, preparedResourcePool } from "../../../src/platform/prepared-object-assets.mts";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../src/platform/prepared-presentation-contract.mts";
import { prepareCssomDeclarationReads } from "../../prepared/prepared-cssom.mts";
import { seamOutsetBinding, seamOutsetInitialValue } from "../../../src/renderers/css/preparation/scene/seam-outset.ts";
import { textureTileStyles, tiledTextureKeys } from "../../../src/renderers/css/dist/index.js";
import { createPreparedNodeTree } from "../../prepared/prepared-node-tree.mts";
import { prepareMaterialTracks } from "../../prepare/prepare-materials.mts";
import { surfaceBankInventory } from "./surface-banks.mts";

export async function preparePagedEllipsoidPresentation({ config, plan, lenses, sky, sun, catalog, textureLevels, controls }: PagedPresentationInput) {
  if (Boolean(config.textureLevels) !== Boolean(textureLevels)) throw new TypeError('Prepared texture levels must match the authored recipe.');
  const fixedTextureLevel = config.textureLevels?.fixedWidth === undefined ? undefined : config.textureLevels.widths.indexOf(config.textureLevels.fixedWidth);
  if (fixedTextureLevel === -1) throw new TypeError('Fixed texture width must be a prepared level.');
 const cameraPlan=config.camera;
  const bodyFrame=requireRecord(plan[config.sceneBodyKey], 'paged body frame');
  const systemTransform=requireString(bodyFrame.systemTransform, 'paged system transform');
  const meshTransform=requireString(bodyFrame.meshTransform, 'paged mesh transform');
  const shadowlessAssets=plan.material.lighting.shadowlessAssets;
  const shadowlessPresentation=plan.material.lighting.shadowlessPresentation;
  if (!shadowlessAssets || !shadowlessPresentation) throw new TypeError('Paged lighting requires a prepared shadowless material.');
  const defaultLens=lenses.controls.find(lens=>lens.id===lenses.defaultLens);
  if (!defaultLens) throw new TypeError('Paged presentation requires its declared default lens.');
  const banks=surfaceBankInventory(plan,lenses,config.publicBase);
  const bankId=(lens: PagedLens,shadows=false)=>lens.view==="interior"&&shadows?`${lens.id}-lit`:lens.surfaceBankId??lens.id;
  const pageKeys=(lens: PagedLens,shadows=false)=>{
    const bank=banks.find(bank=>bank.id===bankId(lens,shadows));
    if (!bank) throw new TypeError(`Missing prepared surface bank: ${bankId(lens,shadows)}`);
    return bank.urls.map((_,i)=>`page:${bankId(lens,shadows)}:${i}`);
  };
  const interiorUrls=[...new Set([
    ...plan.interior.shells.flatMap(shell=>shell.leaves.map(leaf=>leaf.asset)),
    ...plan.interior.sectionLeaves.map(leaf=>leaf.asset)].map(pair=>canonicalPreparedAsset(pair)))];
  const interiorBanks=new Map(lenses.controls.filter(lens=>lens.view==='interior').map(lens=>{
    const overrides=lens.interiorTextures??{};
    for(const [original,url] of Object.entries(overrides)) {
      if(!interiorUrls.includes(original)||typeof url!=='string'||!url.startsWith(config.publicBase))
        throw new TypeError(`Invalid prepared interior texture override for ${lens.id}: ${original}`);
    }
    return [lens.id,interiorUrls.map((url,i)=>({key:`interior:${lens.id}:${i}`,url:overrides[url]??url,pool:'mounted'}))];
  }));
  const levelled=new Set(textureLevels?.entries.map(entry=>entry.key));
  const entries=[...(textureLevels?.entries??banks.flatMap(bank=>bank.urls.map((url,i)=>({key:`page:${bank.id}:${i}`,url,pool:"pages"})))),
    ...lenses.controls.filter(lens=>!levelled.has(`poles:${lens.id}`)).flatMap(lens=>lens.view==="interior"?
      [{key:`poles:${lens.id}`,url:canonicalPreparedAsset(plan.interior.outerAssets.poles),pool:"mounted"},
        {key:`poles:${lens.id}-lit`,url:canonicalPreparedAsset(plan.interior.outerAssets.litPoles),pool:"mounted"}]:
      [{key:`poles:${lens.id}`,url:canonicalPreparedAsset(requireString(lens.polesUrl, `Pole texture for ${lens.id}`)),pool:"mounted"}]),
    ...[...interiorBanks.values()].flat(),
    {key:"shadowless:lighting",url:canonicalPreparedAsset(shadowlessAssets),pool:"mounted"},
    ...materialIds.flatMap(id=>[
      {key:`default:${id}`,url:canonicalPreparedAsset(plan.material[id].defaultAssets),pool:"default-materials"},
      ...(plan.material[id].floodAssets?[{key:`${id}:flood`,url:canonicalPreparedAsset(plan.material[id].floodAssets),pool:id}]:[]),
      ...plan.material[id].preparedRows.map(row=>({key:`${id}:${row.rowIndex}`,url:canonicalPreparedAsset(row.assets),pool:id}))])];
  const allLeaves=[...plan.body.bands.flatMap(band=>band.leaves),...plan.interior.outerBodyBands.flatMap(band=>band.leaves),
    ...plan.interior.shells.flatMap(shell=>shell.leaves),...plan.interior.sectionLeaves,
    plan.material.lighting.leaf,plan.material.atmosphere.leaf];
  const b=createPreparedNodeTree({cssomReads:await prepareCssomDeclarationReads(allLeaves.map(leaf=>leaf.style))});
  const camera=b.element("div","polycss-camera object-render-root",plan.camera.style);
  const scene=b.element("div","polycss-scene",plan.camera.sceneStyle);
  const system=b.mesh(`${config.namespace}-system`,systemTransform);
  // The body and the cutaway body, which reuses the surface leaves, both read the outset from the system.
  const seamOutset=plan.body.seamRepair.outset;
  if(seamOutset)system.style.setProperty(seamOutset.property,seamOutsetInitialValue(seamOutset,cameraPlan.logicalBodyDiameter));
  b.append(null,camera);b.append(camera,scene);b.append(scene,system);
  const pages=plan.body.assets.surface.urls.length;
  // A page the first level draws from a sheet also carries its tile (prepared-texture-levels.ts), as a commit writes it.
  const tiledKeys=tiledTextureKeys(textureLevels?.textureLevels),initialTiles=textureLevels?.textureLevels.levels[0]?.tiles??{};
  const writePages=(node: PreparedNode,urls: readonly string[])=>{for(let i=0;i<pages;i++){
    const name=`--${config.namespace}-surface-page-${i}`,key=pageKeys(defaultLens)[i]!;
    node.style.setProperty(name,urls.length?`url("${urls[i]}")`:"none");
    if(urls.length&&tiledKeys.has(key))for(const [property,value] of textureTileStyles(name,initialTiles[key]))node.style.setProperty(property,value);
  }};
  function bands(parent: PreparedNode,records: PagedPlan['body']['bands'],className: string,polarClass: string,marker: string,urls: readonly string[],poles: string | null) {
    const grouped=new Map<string, PreparedNode>(),surface: PreparedNode[]=[],polar: PreparedNode[]=[];
    for(const band of records) {
      if(!band.leaves.length)continue;
      const isPolar=band.leaves.some(leaf=>leaf.className?.includes(marker)),key=`${isPolar?"polar":"body"}:${band.visualRotationSeconds}`;
      let carrier=grouped.get(key);
      if(!carrier) {
        carrier=b.mesh(isPolar?`${className} ${polarClass}`:className,`${meshTransform};animation-duration:${band.visualRotationSeconds}s`);
        grouped.set(key,carrier);(isPolar?polar:surface).push(carrier);b.append(parent,carrier);
        if(isPolar)carrier.style.setProperty(`--${config.namespace}-poles-texture`,poles?`url("${poles}")`:"none");else writePages(carrier,urls);
      }
      for(const leaf of band.leaves)b.append(carrier,b.leaf(leaf));
    }
    return {surface,polar};
  }
  const initialResource = (key: string) => textureLevels?.textureLevels.levels[0].resources[key] ?? key;
  const initialUrls = pageKeys(defaultLens).map(key=>{
    const resource=entries.find(entry=>entry.key===initialResource(key));
    if(!resource)throw new TypeError(`Missing initial prepared page resource: ${key}`);
    return resource.url;
  });
  const body=bands(system,plan.body.bands,`${config.namespace}-body`,`${config.namespace}-body-polar`,`${config.namespace}-polar`,initialUrls,canonicalPreparedAsset(plan.body.assets.poles));
  const cutaway=b.mesh(`${config.namespace}-cutaway`);
  b.append(system,cutaway);
  // Inactive datasets own no browser image references. Selection publishes
  // their prepared URLs only after the complete resource demand is decoded.
  const interior=bands(cutaway,plan.interior.outerBodyBands,`${config.namespace}-cutaway-body`,`${config.namespace}-cutaway-body-polar`,`${config.namespace}-interior-outer-polar`,[],null);
  const interiorTextureNodes: {node: PreparedNode; url: string}[]=[];
  for(const shell of plan.interior.shells) {
    const mesh=b.mesh(`${config.namespace}-interior-shell ${shell.className}`,meshTransform);b.append(cutaway,mesh);
    for(const leaf of shell.leaves) {const node=b.leaf(leaf),url=canonicalPreparedAsset(leaf.asset);node.style.backgroundImage="none";b.append(mesh,node);interiorTextureNodes.push({node,url});}
  }
  const sections=b.mesh(`${config.namespace}-interior-sections`,meshTransform);b.append(cutaway,sections);
  for(const leaf of plan.interior.sectionLeaves) {
    const node=b.leaf(leaf);node.style.backgroundImage="none";
    if(leaf.backfaceVisible)node.style.backfaceVisibility="visible";b.append(sections,node);
    interiorTextureNodes.push({node,url:canonicalPreparedAsset(leaf.asset)});
  }
  const materialCounter=b.mesh(`${config.namespace}-material-counter`),materialSystem=b.mesh(`${config.namespace}-system`,systemTransform),materialMesh=b.mesh(`${config.namespace}-material`,plan.material.transform);
  b.append(scene,materialCounter);b.append(materialCounter,materialSystem);b.append(materialSystem,materialMesh);
  const materialNodes=Object.fromEntries(materialIds.map(id=>{
    const material=plan.material[id],node=b.leaf(material.leaf),frame=material.defaultPresentation;
    node.style.transform=frame.transform;node.style.backgroundImage=`url("${canonicalPreparedAsset(frame.assets)}")`;
    node.style.backgroundPosition=frame.backgroundPosition;node.style.backgroundSize=frame.backgroundSize;
    node.attributes["data-material-frame"]="default";b.append(materialMesh,node);return[id,node];
  }));
  const {tree,index}=b.finish({camera,scene});
  const tracks=materialIds.map((id): MaterialSourceTrack & {id: MaterialId}=>{
    const material=plan.material[id],address=(frame: {backgroundPosition: string; backgroundSize: string},resource: string,frameIndex: number | null=null,row: number | null=null)=>({resource,frame:frameIndex,row,backgroundPosition:frame.backgroundPosition,backgroundSize:frame.backgroundSize});
    const illumination=material.illumination;
    return {id,target:index(materialNodes[id]),frame:{source:illumination?"prepared-light-z":"sun-z",minimum:illumination?.minimumLightViewZ??-1,maximum:illumination?.maximumLightViewZ??1,count:material.frameCount,baseFrame:0,remap:null},

      banks:[{id,frames:material.frames.map(frame=>frame.flood?address(frame,`${id}:flood`,frame.frameIndex):address(frame,`${id}:${frame.rowIndex}`,frame.frameIndex,frame.rowIndex)),
        default:null,fixed:id==="lighting"?address(shadowlessPresentation,"shadowless:lighting"):null,
        rows:material.preparedRows.map((_,row)=>({row,resource:`${id}:${row}`,firstFrame:row*material.framesPerShard,lastFrame:Math.min(material.frameCount-(material.floodAssets?2:1),(row+1)*material.framesPerShard-1)}))}],
      demand:{ capacity:material.transport.maximumRetainedRowCount, defaultFrame:material.defaultFrame },
      rotation:{kind:"planar",source:illumination?"prepared-light":"view-sun",reference:illumination?"prepared":"initial",baseDegrees:illumination?.baseLightAzimuthDegrees??0,
        zeroAtPole:!!illumination,publishWithAddress:true,...(!illumination?{polePolicy:"azimuth"}:{}),width:material.presentationTileSize,height:material.presentationTileSize},
      frameAttribute:null,modeAttribute:null,quoted:true};
  });
  const variants=lenses.controls.flatMap(lens=>[false,true].flatMap(shadows=>[false,true].map(atmosphere=>{
    const isInterior=lens.view==="interior",keys=pageKeys(lens,shadows),texture=(node: PreparedNode,name: string,resource: string | null)=>({kind:"texture",target:index(node),name,resource,quoted:true});
    const interiorBank=interiorBanks.get(lens.id);
    if (isInterior && !interiorBank) throw new TypeError(`Missing prepared interior bank: ${lens.id}`);
    const pageWrites=(carriers: readonly PreparedNode[],active: boolean)=>carriers.flatMap(node=>Array.from({length:pages},(_,i)=>texture(node,`--${config.namespace}-surface-page-${i}`,active?keys[i]:null)));
    // Outside the interior view the cutaway is not shown (earth-surfaces.css), so page markup leaves its 500-odd nodes out.
    return {when:{lensId:lens.id,shadows,atmosphere},...(isInterior?{}:{hiddenSubtrees:[index(cutaway)]}),navigation:{maximumZoom:lens.maximumZoom,camera:lens.camera??null},required:[...keys,`poles:${bankId(lens,shadows)}`,...(interiorBank?.map(entry=>entry.key)??[])],
      writes:[...pageWrites(isInterior?interior.surface:body.surface,true),
        ...(isInterior?interiorTextureNodes.map(({node,url})=>texture(node,'background-image',requireInteriorResource(interiorBank, interiorUrls.indexOf(url)))):[]),
        ...(isInterior?interior.polar:body.polar).map(node=>texture(node,`--${config.namespace}-poles-texture`,`poles:${bankId(lens,shadows)}`)),
        ...pageWrites(isInterior?body.surface:interior.surface,false),
        {kind:"attribute",target:-1,name:"data-view",value:isInterior?"interior":null},
        {kind:"attribute",target:-1,name:"data-lens",value:lens.id},
        {kind:"class",target:-1,name:`${config.namespace}-hide-atmosphere`,value:!atmosphere}],
      materials:tracks.map(track=>({track:track.id,bank:track.id,mode:track.id==="lighting"&&!shadows?"fixed":plan.material[track.id].illumination?"frames":"default-pose",
        // With the atmosphere on, its image holds the lit disc too, so the lighting bank loads only with the atmosphere off.
        enabled:!isInterior&&(track.id==="lighting"?shadows&&!atmosphere&&lens.id!=="night-lights":atmosphere),rotationEnabled:track.id!=="lighting"||shadows,
        frameOverride:track.id!=="lighting"&&!shadows&&plan.material[track.id].illumination?plan.material[track.id].frameCount-1:null,clearWhenHidden:false,fixedMode:"shadowless",publishWhenHidden:"static",
        addressAttributes:[{name:"data-material-frame",source:"mode-or-frame",value:null}]}))};
  })));
  const prepared = {schema:PREPARED_PRESENTATION_SCHEMA,camera:cameraPlan,sky,sun,
    ...(textureLevels?{textureLevels:{...textureLevels.textureLevels,...(fixedTextureLevel===undefined?{}:{fixedLevel:fixedTextureLevel})}}:{}),
    ...(catalog?{destinations:{catalog,defaultLens:"normal",statuses:config.destinations.statuses}}:{}),
    assets:{entries,pools:[preparedResourcePool("mounted",entries,{concurrency:2}),preparedResourcePool("default-materials",entries,{retention:"warm"}),
      preparedResourcePool("pages",entries,{retention:"selection",concurrency:2,capacity:pages*2*(textureLevels?.textureLevels.levels.length??1),eviction:"capacity",
        ...(textureLevels?{maximumDecodedBytes:textureLevels.maximumDecodedBytes}: {})}),
      ...tracks.map(track=>preparedResourcePool(track.id,entries,{retention:"selection",reuse:true,capacity:track.demand.capacity,concurrency:3,eviction:"capacity",stabilityMilliseconds:plan.material[track.id].illumination?0:120,decoding:"sync"}))],
      // What the default view shows (shadows off): its pages and poles at the first level, the shadowless lighting and
      // the atmosphere's flood frame. The default-pose materials are only base styles every variant overwrites.
      startup:[...pageKeys(defaultLens).map(initialResource),initialResource(`poles:${defaultLens.id}`),"shadowless:lighting",
        ...(plan.material.atmosphere.floodAssets?["atmosphere:flood"]:plan.material.atmosphere.transport.initialWarmRows.map(row=>`atmosphere:${row}`))]},
    tree,variants,materials:tracks,viewBindings:[{kind:"counter-rotation",target:index(materialCounter),systemTransform:null},...(seamOutset?[seamOutsetBinding(seamOutset,index(system))]:[])],animations:[],
    motionFrame:[index(system),index(body.surface[0])]};
 return {...prepared, schema:'cssearth-object-runtime@4', id:config.namespace, controls,
 materials:prepareMaterialTracks(prepared), variants:prepared.variants.map(variant=>({...variant,materials:variant.materials.map(material=>({...material,mode:material.mode==='default-pose'?'frames':material.mode}))}))};
}

function requireInteriorResource(bank: readonly {key: string}[] | undefined, index: number) {
  const resource=bank?.[index];
  if (!resource) throw new TypeError('Missing prepared interior texture resource.');
  return resource.key;
}
