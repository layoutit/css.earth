import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLimbProfile } from '@cssearth/bake/photometry';
import { prepareGeometryScene, parseGeometryProfile, leafImageCandidates, widestLeafImages } from './index.js';
import type { GeometryProfile, GeometrySceneAssets, LeafImagePixels, SolarSceneSource } from './index.js';
import { prepareLeafSeamOutset, prepareSeamOutsetSteps } from './seam-outset.js';
import { parseRasterRecipe, outputName, RASTER_DENSITY, packedRasterSize, rasterPageName } from '@cssearth/bake/raster';
import type { RasterRecipe } from '@cssearth/bake/raster';
import { prepareProjectiveTextureLayer, TEXELS_PER_CSS_PIXEL } from '../../../../platform/projective-surface-raster.mts';
import { prepareComposite } from '../presentation/composite.js';
import { loadPresentationAdapters } from '../presentation/adapters.js';
import type { PresentationInputs } from '../presentation/types.js';
const fixtureRoot=process.cwd();
const readJson=async(path:string):Promise<unknown>=>JSON.parse(await readFile(join(fixtureRoot,path),'utf8')) as unknown;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** The widths the raster lane publishes, from its recipe: surfaces.ts packs each surface, poles are two tiles per surface
 * per lens, interior.ts writes the outer shell at the map's size and the core, poles and section at theirs. */
function publishedWidths(raster:RasterRecipe):LeafImagePixels{
 const url=(template:string,id?:string)=>raster.publicBase+outputName(template,RASTER_DENSITY,id),widths=new Map<string,number>();
 for(const surface of raster.surfaces){
  widths.set(url(surface.output,surface.id),packedRasterSize(raster,RASTER_DENSITY,surface.resolutionScale).width);
  widths.set(url(raster.polesOutput,surface.id),raster.polarTile*RASTER_DENSITY*2);
 }
 const interior=raster.interior;
 if(interior)for(const [template,width] of [[interior.outerOutput,raster.width],[interior.outerUnlitOutput,raster.width],[interior.outerPolesOutput,interior.poleTile*2],
  [interior.outerUnlitPolesOutput,interior.poleTile*2],[interior.coreOutput,interior.width],[interior.corePolesOutput,interior.poleTile*2],[interior.sectionOutput,interior.sectionWidth]] as const)
  widths.set(url(template),width*RASTER_DENSITY);
 return image=>{const width=widths.get(image);if(width===undefined)throw new TypeError(`No published width for ${image}.`);return width;};
}
const styleOf=(style:string)=>new Map(style.split(';').map(entry=>[entry.slice(0,entry.indexOf(':')),entry.slice(entry.indexOf(':')+1)]));
const matrixOf=(style:string)=>(/transform:matrix3d\(([^)]+)\)/.exec(style)?.[1]??'').split(',').map(Number);
async function prepareAuthored(id:string,direction:[number,number,number],edit:(profile:GeometryProfile)=>GeometryProfile=profile=>profile,extra:Partial<GeometrySceneAssets>={},
 widths:(raster:RasterRecipe,profile:GeometryProfile)=>LeafImagePixels=publishedWidths){
 const root=`src/objects/${id}/source`, profile=edit(parseGeometryProfile(await readJson(`${root}/preparation/geometry.json`))),raster=parseRasterRecipe(await readJson(`${root}/preparation/raster.json`));
 const assets:GeometrySceneAssets={...extra};
 if(raster.lighting)assets.lighting={frameCount:raster.lighting.frameCount,defaultFrame:raster.lighting.defaultFrame};
 if(raster.interior){
  const source=await readJson(`${root}/${raster.interior.source}`) as {metallicCoreRadiusFraction:number;presentation:{cutaway:{centerLongitudeDegrees:number;widthDegrees:number}}};
  const url=(template:string)=>raster.publicBase+outputName(template,RASTER_DENSITY);
  assets.interior={cutaway:source.presentation.cutaway,metallicCoreRadiusFraction:source.metallicCoreRadiusFraction,coreUrl:url(raster.interior.coreOutput),corePolesUrl:url(raster.interior.corePolesOutput),sectionUrl:url(raster.interior.sectionOutput),outerPolesUrl:url(raster.interior.outerPolesOutput)};
 }
 // The scene record carries the atmosphere bake's metadata; a fixed reference colour and outer radius stand in for the bake.
 if(raster.atmosphere){const atmosphere=raster.atmosphere,halo=atmosphere.halo===undefined?null:await loadLimbProfile(join(fixtureRoot,root),atmosphere.halo);assets.atmosphere={limb:{model:'published-photometric-models-relative-to-the-flood-lit-disc-centre',models:atmosphere.limb.models,referenceColor:[128,128,128],referenceSource:'fixture'},halo:halo?{model:'nasa-psg-full-phase-limb-profile-single-scattering-day-side',table:atmosphere.halo!,radiusKm:halo.radiusKm,edgeAltitudeKm:atmosphere.haloEdgeAltitudeKm!,topAltitudeKm:halo.altitudesKm[halo.altitudesKm.length-1],outerRadiusScale:1}:null};}
 const outputDirectory=await mkdtemp(join(tmpdir(),'geometry-parity-'));
 try{
  const result=await prepareGeometryScene({profile,raster,assets,solarSource:await readJson(`${root}/presentation/solar-system.json`) as SolarSceneSource,starfield:{faces:[]},sun:{},outputDirectory,imagePixels:widths(raster,profile),
   adapters:{bodyFixedSunDirection:()=>direction,sunReferenceViewDirection:()=>direction,preparePhysicalScene:async()=>({camera:null,systemTransform:null,presentationFrame:null,worldFrame:null,starfield:null})}});
  assert.deepEqual(JSON.parse(await readFile(join(outputDirectory,'scene.json'),'utf8')),JSON.parse(JSON.stringify(result)));
  return result;
 } finally {await rm(outputDirectory,{recursive:true,force:true});}
}
const fixtures:[string,[number,number,number],number,string,string?][]=[
 ['mercury',[0.9590465723427557,-0.28324830064510237,0.00026881085002734145],0.005,'75eea24dcbd8643f00280fa02908c4d4a65f0902190816b601df2961363d1134','48dec28b7d2245edb753ad0bae1a59e203dca6ad80a619dd56bfe13b2f8fde19'],
 ['venus',[0.9978458208272254,-0.04897654126493434,0.043646491993803105],0.008,'52c1a1286be1648205e12257163550b38c79c8d8cadd005d21af6b293db672d7']];
for(const [id,direction,fixedOverlap,bodyHash,interiorHash] of fixtures){
 test(`authored ${id} geometry preserves independent pre-migration leaf oracle`,async()=>{
  // The oracle predates the stepped seam outset. Restoring the fixed overlap it was taken
  // with must reproduce it exactly, so the outset changes nothing else about the leaves.
  const result=await prepareAuthored(id,direction,profile=>{const {seamOutset:_stepped,...projection}=profile.projection;return {...profile,projection:{...projection,overlap:fixedOverlap,rasterOverscan:0,projectivePoles:id==='mercury'}};});
  // Four changes since this oracle was taken touched these leaves, each by name: d10c041091 draws every polar cap from
  // both sides, 36198077d3 moved raster images to the canonical 2x density, leafRasterScale draws each leaf at two
  // texels per CSS pixel instead of the recipe's raster scale (its caps already were), and a leaf binds its lens's
  // texture instead of inlining the profile's image. Undoing exactly those four reproduces the oracle, and every cap must
  // carry the both-sided suffix. A fifth change was taken into the hashes rather than undone: #712 grows each band
  // leaf's texture with this fixed overlap instead of stretching the cell across it, and stops rounding background sizes
  // to the decimals Array.map handed formatCssLength as its index. A sixth is also in Mercury's hashes: its leaves write the
  // texture address and lens image inline like every other body (no position variables), and each lens has its own
  // two-tile pole sprite (512 px) where one atlas held all six tiles (1,536 px). Checked against the published leaves before
  // the rehash: every matrix, box, texture position and projective layer is unchanged; only the four caps' sprite size moved.
  // A seventh is restored rather than undone: Mercury's caps were projective when the oracle was taken, and are plain leaves
  // like every other body's now.
  const both=';border-radius:50%',isCap=(leaf:object)=>Boolean((leaf as {polar?:unknown;polarCap?:unknown}).polar||(leaf as {polarCap?:unknown}).polarCap);
  const geometry=parseGeometryProfile(await readJson(`src/objects/${id}/source/preparation/geometry.json`)),ns=geometry.namespace;
  const recipeLayer=(leaf:{style:string;projectiveTextureLayer?:object})=>isCap(leaf)||!leaf.projectiveTextureLayer?leaf
   :{...leaf,projectiveTextureLayer:prepareProjectiveTextureLayer(matrixOf(leaf.style),geometry.projection.rasterScale)};
  const inlined=(leaf:{style:string})=>({...leaf,style:leaf.style.replace(`background-image:var(--${ns}-surface-image)`,`background-image:url(${geometry.surface.surface.url})`)
   .replace(`background-image:var(--${ns}-poles-image)`,`background-image:url(${geometry.surface.poles.url})`)});
  const undo=(set:readonly {style:string;projectiveTextureLayer?:object}[])=>JSON.parse(JSON.stringify(set.map(recipeLayer).map(inlined).map(leaf=>isCap(leaf)?{...leaf,style:leaf.style.replace(both,'')}:leaf)).replaceAll('@2x.webp','.webp')) as unknown;
  const leaves='bodyLeaves' in result?result.bodyLeaves:result.body.leaves,caps=leaves.filter(isCap);
  assert.ok(caps.length>=2&&caps.every(leaf=>leaf.style.endsWith(both)&&!leaf.style.includes('backface-visibility')),'every polar cap is a disc, culled when it faces away');
  assert.equal(hash(undo(leaves)),bodyHash);
  if(interiorHash){assert.ok('interior' in result&&result.interior);const interior=result.interior;
   assert.equal(hash({outerBodyLeaves:undo(interior.outerBodyLeaves),coreLeaves:undo(interior.coreLeaves),sectionLeaves:undo(interior.sectionLeaves)}),interiorHash);}
 });
 test(`authored ${id} geometry overlaps by its raster overscan and gives every surface leaf a seam outset`,async()=>{
  const result=await prepareAuthored(id,direction);
  const seamRepair='bodyLeaves' in result?result.preparedSurface.seamRepair:result.body.seamRepair;
  assert.equal(seamRepair.model,'prepared-matched-raster-overscan-with-silhouette-stepped-outset');
  // Half a canonical texel: one displayed @2x texel of real neighbouring imagery past each edge.
  assert.equal(seamRepair.rasterOverscan,0.5);
  assert.ok(seamRepair.presentationOverlap>0);
  const projective=('bodyLeaves' in result?result.bodyLeaves:result.body.leaves).filter(leaf=>leaf.projectiveTextureLayer);
  // Mercury also projects its polar caps; only the 14 × 32 band leaves carry the outset.
  const polar=(leaf:typeof projective[number])=>Boolean(('polar' in leaf&&leaf.polar)||('polarCap' in leaf&&leaf.polarCap));
  assert.ok(projective.filter(polar).every(leaf=>leaf.projectiveTextureLayer?.seamOutset===undefined),`${id} polar caps carry no outset`);
  const leaves=projective.filter(leaf=>!polar(leaf));
  assert.equal(leaves.length,448,'the 14 × 32 band leaves');
  for(const leaf of leaves){
   const outset=leaf.projectiveTextureLayer?.seamOutset;
   assert.equal(outset?.property,'--surface-seam-outset');
   // A 16 × 32 cell spans 11.25° of latitude, a chord of 2R·sin(π/32): about 20.4 leaf
   // scales per body diameter. Longitude cells narrow toward the poles, never below that.
   const [a,b]=outset.scale;
   assert.ok(Math.min(a,b)>19.5&&Math.min(a,b)<21.5&&Math.max(a,b)<110,`${id} leaf scale ${a} × ${b}`);
  }
 });
 test(`authored ${id} band leaves sample exactly their own map cell`,async()=>{
  // Array.map once handed formatCssLength its index as the decimals, rounding every background width to whole pixels
  // and height to tenths: Venus' leaves sampled up to half a map unit, Triton's two and a half, away from their cells.
  const {surface,projection}=parseGeometryProfile(await readJson(`src/objects/${id}/source/preparation/geometry.json`));
  const result=await prepareAuthored(id,direction),gutter=projection.rasterGutter;
  const cellWidth=surface.surface.width/surface.longitudeSegments,cellHeight=surface.surfaceLatitudeHeight/surface.latitudeSegments;
  const packedWidth=surface.surface.width+2*gutter,packedHeight=surface.latitudeSegments*(cellHeight+2*gutter);
  const polar=(leaf:object)=>Boolean(('polar' in leaf&&leaf.polar)||('polarCap' in leaf&&leaf.polarCap));
  const bands=('bodyLeaves' in result?result.bodyLeaves:result.body.leaves).filter(leaf=>!polar(leaf));
  bands.forEach((leaf,index)=>{
   const style=new Map(leaf.style.split(';').map(entry=>[entry.slice(0,entry.indexOf(':')),entry.slice(entry.indexOf(':')+1)]));
   const position=style.get('background-position')??'';
   const [x=NaN,y=NaN]=position.split(' ').map(parseFloat),[width=NaN,height=NaN]=(style.get('background-size')??'').split(' ').map(parseFloat);
   // The matched overscan is drawn around the exact cell, which starts one gutter into its packed band.
   const cellX=gutter+index%surface.longitudeSegments*cellWidth;
   const cellY=(surface.latitudeSegments-2-Math.floor(index/surface.longitudeSegments))*(cellHeight+2*gutter)+gutter;
   const sampledX=-x/width*packedWidth+projection.rasterOverscan,sampledY=-y/height*packedHeight+projection.rasterOverscan;
   assert.ok(Math.abs(sampledX-cellX)<0.01&&Math.abs(sampledY-cellY)<0.01,`${id} band leaf ${index} samples (${sampledX}, ${sampledY}), its cell starts at (${cellX}, ${cellY})`);
  });
 });
}
test('a band leaf holds its widest image at two texels per CSS pixel, and a cap already there keeps its box',async()=>{
 // Venus's @2x maps put about two texels on each CSS pixel of a leaf at raster scale 1, so the recipe's 2 shrinks to just over 1.
 const raster=parseRasterRecipe(await readJson('src/objects/venus/source/preparation/raster.json')),width=publishedWidths(raster);
 const {projection,surface}=parseGeometryProfile(await readJson('src/objects/venus/source/preparation/geometry.json'));
 const result=await prepareAuthored('venus',[1,0,0]);
 assert.ok(!('bodyLeaves' in result));
 const bands=result.body.leaves.filter(leaf=>!leaf.polarCap),caps=result.body.leaves.filter(leaf=>leaf.polarCap);
 assert.equal(bands.length,448);
 for(const leaf of bands){
  const style=styleOf(leaf.style),image=surface.surface.url,backgroundWidth=parseFloat(style.get('background-size')??'');
  const scale=leaf.projectiveTextureLayer?.rasterScale??NaN;
  assert.ok(scale>1&&scale<projection.rasterScale,`a band leaf at raster scale ${scale}`);
  // The style rounds the background width that the scale was taken from; the texel density at that scale is two.
  assert.ok(Math.abs(width(image)/(backgroundWidth*scale)-TEXELS_PER_CSS_PIXEL)<1e-5,`${image} holds ${width(image)/(backgroundWidth*scale)} texels per CSS pixel`);
 }
 // A plain cap is never enlarged: a pole image four times as wide leaves it as it is.
 const unchanged=await prepareAuthored('venus',[1,0,0],profile=>profile,{},raster=>{const published=publishedWidths(raster);return image=>published(image)*4;});
 assert.ok(!('bodyLeaves' in unchanged));
 assert.deepEqual(caps,unchanged.body.leaves.filter(leaf=>leaf.polarCap));
});
test('a paged leaf whose finest page holds more than two texels per CSS pixel keeps the recipe raster scale',async()=>{
 // Triton's full pages carry about seven texels per CSS pixel of a leaf at raster scale 1: the recipe's 4 is the ceiling.
 const result=await prepareAuthored('triton',[1,0,0]);
 assert.ok(!('bodyLeaves' in result));
 const bands=result.body.leaves.filter(leaf=>!leaf.polarCap);
 assert.ok(bands.length===448&&bands.every(leaf=>leaf.projectiveTextureLayer?.rasterScale===4));
});
test('a plain cap whose image holds fewer than two texels per CSS pixel shrinks its box and keeps every point in place',async()=>{
 // A 1x pole image (half the published width) puts one texel on each CSS pixel of Venus's cap: the box halves.
 const half=(raster:RasterRecipe,profile:GeometryProfile):LeafImagePixels=>{const published=publishedWidths(raster);return image=>image===profile.surface.poles.url?published(image)/2:published(image);};
 const [before,after]=await Promise.all([prepareAuthored('venus',[1,0,0]),prepareAuthored('venus',[1,0,0],profile=>profile,{},half)]);
 assert.ok(!('bodyLeaves' in before)&&!('bodyLeaves' in after));
 const caps=(set:typeof before.body.leaves)=>set.filter(leaf=>leaf.polarCap);
 assert.deepEqual(after.body.leaves.filter(leaf=>!leaf.polarCap),before.body.leaves.filter(leaf=>!leaf.polarCap));
 assert.equal(caps(after.body.leaves).length,2);
 caps(before.body.leaves).forEach((leaf,index)=>{
  const shrunk=caps(after.body.leaves)[index]!,a=styleOf(leaf.style),b=styleOf(shrunk.style);
  assert.equal(shrunk.projectiveTextureLayer,undefined);
  for(const name of ['--polycss-atlas-width','--polycss-atlas-height'])assert.equal(parseFloat(b.get(name)!),parseFloat(a.get(name)!)/2);
  for(const name of ['background-size','background-position'])assert.deepEqual(b.get(name)!.split(' ').map(parseFloat),a.get(name)!.split(' ').map(value=>parseFloat(value)/2));
  // transform-origin 0 0: a point (u, v) of the box maps to M·(u, v, 0, 1); the shrunk box's (u/2, v/2) must land on it.
  const [m,n]=[matrixOf(leaf.style),matrixOf(shrunk.style)],w=parseFloat(a.get('--polycss-atlas-width')!),h=parseFloat(a.get('--polycss-atlas-height')!);
  for(const [u,v] of [[0,0],[w,0],[0,h],[w,h],[0.37*w,0.61*h]] as const)for(const axis of [0,1,2]){
   const p=(m[axis]!*u+m[4+axis]!*v+m[12+axis]!)/(m[3]!*u+m[7]!*v+m[15]!),q=(n[axis]!*u/2+n[4+axis]!*v/2+n[12+axis]!)/(n[3]!*u/2+n[7]!*v/2+n[15]!);
   assert.ok(Math.abs(p-q)<1e-9*Math.max(1,Math.abs(p)),`cap ${index} point (${u}, ${v}) axis ${axis}: ${p} became ${q}`);
  }
 });
});
test('leaf image candidates cover every lens, page, level and cutaway image a leaf can show',async()=>{
 const venus=parseGeometryProfile(await readJson('src/objects/venus/source/preparation/geometry.json')),venusRaster=parseRasterRecipe(await readJson('src/objects/venus/source/preparation/raster.json'));
 const lens=(id:string,extra:Record<string,unknown>={})=>({id,surfaceUrl:`/scenes/venus/venus-${id}@2x.webp`,surface2xUrl:`/scenes/venus/venus-${id}@2x.webp`,
  polesUrl:`/scenes/venus/venus-poles-${id}@2x.webp`,poles2xUrl:`/scenes/venus/venus-poles-${id}@2x.webp`,...extra});
 // An interior lens draws the cutaway, and a dataset that borrows another lens's surface draws that lens's: neither adds images.
 const candidates=leafImageCandidates({objectId:'venus',profile:venus,raster:venusRaster,lenses:{controls:[lens('clouds'),lens('radar'),
  lens('section',{view:'interior'}),{id:'disc',volume:{surface:'clouds'}}]}});
 assert.deepEqual([...candidates.keys()],[venus.surface.surface.url,venus.surface.poles.url]);
 assert.deepEqual(candidates.get(venus.surface.surface.url),['/scenes/venus/venus-clouds@2x.webp','/scenes/venus/venus-radar@2x.webp']);
 assert.deepEqual(candidates.get(venus.surface.poles.url),['/scenes/venus/venus-poles-clouds@2x.webp','/scenes/venus/venus-poles-radar@2x.webp']);
 assert.throws(()=>leafImageCandidates({objectId:'venus',profile:venus,raster:venusRaster,lenses:{controls:[lens('clouds',{surfaceUrl:'venus-clouds.webp'})]}}),/venus: lens clouds\.surfaceUrl must be a \/scenes\/ url, not "venus-clouds\.webp"/);
 // A paged surface publishes no whole atlas: every page at every level instead.
 const triton=parseGeometryProfile(await readJson('src/objects/triton/source/preparation/geometry.json')),tritonRaster=parseRasterRecipe(await readJson('src/objects/triton/source/preparation/raster.json'));
 const paged=leafImageCandidates({objectId:'triton',profile:triton,raster:tritonRaster,lenses:{controls:[{id:'normal',surfaceUrl:triton.surface.surface.url,surface2xUrl:triton.surface.surface.url}]}});
 const pages=paged.get(triton.surface.surface.url)!,full=packedRasterSize(tritonRaster,RASTER_DENSITY).width;
 assert.equal(pages.length,16*4);
 assert.ok(!pages.includes(triton.surface.surface.url));
 assert.ok(pages.includes(`/scenes/triton/${rasterPageName('triton-normal@2x.webp',0)}`)&&pages.includes(`/scenes/triton/${rasterPageName('triton-normal@2x.webp',15,full/8)}`));
 // The cutaway draws the band leaves again over its outer shell, lit or unlit, and names its own poles, core and section.
 const mercury=parseGeometryProfile(await readJson('src/objects/mercury/source/preparation/geometry.json')),mercuryRaster=parseRasterRecipe(await readJson('src/objects/mercury/source/preparation/raster.json'));
 const interior=Object.fromEntries(['outerSurface','outerSurfaceUnlit','outerPoles','outerPolesUnlit','core','corePoles','section'].map(name=>[`${name}Url`,`/scenes/mercury/${name}.webp`]));
 const cutaway=leafImageCandidates({objectId:'mercury',profile:mercury,raster:mercuryRaster,interior,lenses:{controls:[{id:'normal',surfaceUrl:mercury.surface.surface.url,polesUrl:mercury.surface.poles.url}]}});
 assert.deepEqual(cutaway.get(mercury.surface.surface.url),[mercury.surface.surface.url,'/scenes/mercury/outerSurface.webp','/scenes/mercury/outerSurfaceUnlit.webp']);
 assert.deepEqual(cutaway.get('/scenes/mercury/outerPoles.webp'),['/scenes/mercury/outerPoles.webp','/scenes/mercury/outerPolesUnlit.webp']);
 assert.deepEqual(['core','corePoles','section'].map(name=>cutaway.get(`/scenes/mercury/${name}.webp`)),['core','corePoles','section'].map(name=>[`/scenes/mercury/${name}.webp`]));
 const {coreUrl:_core,...coreless}=interior;
 assert.throws(()=>leafImageCandidates({objectId:'mercury',profile:mercury,raster:mercuryRaster,interior:coreless,lenses:{controls:[{id:'normal'}]}}),/mercury: prepared interior\.coreUrl is missing/);
});
test('the widest candidate answers for a leaf, and a leaf naming an unmeasured image is refused',async()=>{
 const widths=new Map([['/scenes/a/one.webp',1024],['/scenes/a/two.webp',2048],['/scenes/a/poles.webp',512]]);
 const pixels=await widestLeafImages('a',new Map([['/scenes/a/one.webp',['/scenes/a/one.webp','/scenes/a/two.webp']],['/scenes/a/poles.webp',['/scenes/a/poles.webp']]]),async url=>widths.get(url)!);
 assert.equal(pixels('/scenes/a/one.webp'),2048);assert.equal(pixels('/scenes/a/poles.webp'),512);
 assert.throws(()=>pixels('/scenes/a/two.webp'),/a: a leaf names \/scenes\/a\/two\.webp, which is none of the measured leaf textures/);
 await assert.rejects(widestLeafImages('a',new Map([['/scenes/a/one.webp',['/scenes/a/one.webp']]]),async()=>0),/a: leaf image \/scenes\/a\/one\.webp measures 0 px wide/);
});
test('every lens reaches the leaves: a leaf binds its lens texture and each composite variant writes its own lens',async()=>{
 // Uranus's leaves once inlined the profile's 1x normal map, and its variants wrote no surface: every lens drew that map.
 const result=await prepareAuthored('uranus',[1,0,0],profile=>profile,{},profileWidths);
 assert.ok(!('bodyLeaves' in result));
 const bands=result.body.leaves.filter(leaf=>!leaf.polarCap),caps=result.body.leaves.filter(leaf=>leaf.polarCap);
 assert.ok(bands.length>0&&bands.every(leaf=>styleOf(leaf.style).get('background-image')==='var(--uranus-surface-image)'));
 assert.ok(caps.length===2&&caps.every(leaf=>styleOf(leaf.style).get('background-image')==='var(--uranus-poles-image)'));
 const base='src/objects/uranus/prepared',[published,assets,lenses,sun,controls,solarSource]=await Promise.all([
  ...['scene','assets','lenses','sun','controls'].map(file=>readJson(`${base}/${file}.json`)),readJson('src/objects/uranus/source/presentation/solar-system.json')]);
 const scene={...published as {body:object},body:{...(published as {body:object}).body,leaves:result.body.leaves}};
 // No browser here: the CSSOM reads only rescale leaf addresses, which this test does not read.
 const adapters={...await loadPresentationAdapters(),prepareCssomDeclarationReads:async()=>new Map()};
 const draft=await prepareComposite({namespace:'uranus',mode:'composite',scene,assets,lenses,sun,controls,solarSource} as unknown as PresentationInputs,adapters);
 const body=draft.tree.nodes.findIndex(node=>node.className==='polycss-mesh uranus-body'),defaultLens=(lenses as {defaultLens:string}).defaultLens;
 const lensIds=[...new Set(draft.variants.map(variant=>variant.when.lensId))];
 assert.ok(lensIds.length===3&&lensIds.includes('methane'));
 for(const variant of draft.variants){
  const textures=variant.writes.filter(write=>write.kind==='texture');
  assert.deepEqual(textures,[{kind:'texture',target:body,name:'--uranus-surface-image',resource:`surface:${variant.when.lensId}`,quoted:true},
   {kind:'texture',target:body,name:'--uranus-poles-image',resource:`poles:${variant.when.lensId}`,quoted:true}],`variant ${JSON.stringify(variant.when)}`);
  for(const write of textures)assert.ok(write.kind==='texture'&&write.resource&&variant.required.includes(write.resource));
 }
 // A lens other than the default draws its own map: methane's surface resource is the methane file, not the normal one.
 const methane=draft.variants.find(variant=>variant.when.lensId==='methane'&&variant.when.lensId!==defaultLens)!;
 const surface=methane.writes.find(write=>write.kind==='texture'&&write.name==='--uranus-surface-image');
 assert.ok(surface?.kind==='texture');
 assert.equal(draft.assets.entries.find(entry=>entry.key===surface.resource)?.url,'/scenes/uranus/uranus-surface-methane@2x.webp');
});
test('a paged body reads each band from its page and samples its own cell there',async()=>{
 // Triton's atlas is past the decode limit, so it comes as pages of one band each (preparation/raster/pages.ts).
 const {surface,projection}=parseGeometryProfile(await readJson('src/objects/triton/source/preparation/geometry.json'));
 const result=await prepareAuthored('triton',[1,0,0]),gutter=projection.rasterGutter;
 assert.ok(!('bodyLeaves' in result));
 const pages=result.body.surfacePages;
 assert.equal(pages?.bandsPerPage,1);assert.equal(pages?.pageCount,16);
 const cellWidth=surface.surface.width/surface.longitudeSegments,cellHeight=surface.surfaceLatitudeHeight/surface.latitudeSegments;
 // Without an overscan the texture grows with the patch by whole texels (createSurfacePatches).
 const grow=(cell:number)=>Math.round(projection.overlap*cell*projection.rasterScale)/projection.rasterScale;
 const packedWidth=surface.surface.width+2*gutter,pageHeight=(cellHeight+2*gutter)*pages!.bandsPerPage;
 const bands=result.body.leaves.filter(leaf=>!leaf.polarCap);
 assert.ok(result.body.leaves.filter(leaf=>leaf.polarCap).every(leaf=>leaf.style.includes('background-image:var(--triton-poles-image)')));
 bands.forEach((leaf,index)=>{
  const style=new Map(leaf.style.split(';').map(entry=>[entry.slice(0,entry.indexOf(':')),entry.slice(entry.indexOf(':')+1)]));
  const band=surface.latitudeSegments-2-Math.floor(index/surface.longitudeSegments),page=Math.floor(band/pages!.bandsPerPage);
  assert.equal(style.get('background-image'),`var(--triton-surface-page-${page})`);
  const [x=NaN,y=NaN]=(style.get('background-position')??'').split(' ').map(parseFloat),[width=NaN,height=NaN]=(style.get('background-size')??'').split(' ').map(parseFloat);
  const cellX=gutter+index%surface.longitudeSegments*cellWidth-grow(cellWidth),cellY=(band-page*pages!.bandsPerPage)*(cellHeight+2*gutter)+gutter-grow(cellHeight);
  const sampledX=-x/width*packedWidth,sampledY=-y/height*pageHeight;
  assert.ok(Math.abs(sampledX-cellX)<0.01&&Math.abs(sampledY-cellY)<0.01,`band leaf ${index} samples (${sampledX}, ${sampledY}) of page ${page}, its cell starts at (${cellX}, ${cellY})`);
 });
});
test('seam outset steps hold the target within their silhouette steps',()=>{
 const steps=prepareSeamOutsetSteps({targetPixels:0.5,stepRatio:Math.SQRT2,hysteresis:0.1,firstDiameter:16,lastDiameter:32768});
 assert.equal(steps.levels[0].minimumDiameter,0);
 for(let index=1;index<steps.levels.length-1;index++){
  const level=steps.levels[index],next=steps.levels[index+1],value=Number(level.value);
  assert.ok(next.minimumDiameter>level.minimumDiameter);
  const smallest=level.minimumDiameter*(1-steps.hysteresis)*value,largest=next.minimumDiameter*value;
  // Values keep six significant digits: allow that rounding around 0.5 × 0.9 / 2^¼ and 0.5 × 2^¼.
  assert.ok(smallest>=0.378&&largest<=0.595,`step ${index}: ${smallest}–${largest}`);
 }
 assert.throws(()=>prepareSeamOutsetSteps({targetPixels:0.5,stepRatio:1,hysteresis:0.1,firstDiameter:16,lastDiameter:32768}));
});
test('a leaf seam outset moves each edge by the same share of the body diameter',()=>{
 // An axis-aligned 32 × 16 box mapped onto 200 × 50 units of a body 1000 units across:
 // an outset of 0.001 scales x by 1.01 and y by 1.04, one unit on every edge.
 const matrix=[200/32,0,0,0,0,50/16,0,0,0,0,1,0,10,20,30,1].join(',');
 assert.deepEqual(prepareLeafSeamOutset(matrix,32,16,1000),{property:'--surface-seam-outset',scale:[10,40]});
});
test('a stepped seam outset requires an overlap matched to its raster overscan',async()=>{
 const profile=await readJson('src/objects/venus/source/preparation/geometry.json') as {projection:Record<string,unknown>};
 assert.doesNotThrow(()=>parseGeometryProfile(profile));
 assert.throws(()=>parseGeometryProfile({...profile,projection:{...profile.projection,overlap:0.008}}),/overlap x texels per cell = rasterOverscan/);
 assert.doesNotThrow(()=>parseGeometryProfile({...profile,projection:{...profile.projection,overlap:0,rasterOverscan:0}}));
});

/** Uranus's surfaces are observed products, not the raster recipe's: its profile names the 1x files at their own widths. */
const profileWidths=(_raster:RasterRecipe,profile:GeometryProfile):LeafImagePixels=>image=>
 image===profile.surface.surface.url?profile.surface.surface.width:image===profile.surface.poles.url?profile.surface.poles.width:Number.NaN;
test('a ring drawn as wedges is one leaf per wedge, and every wedge starts outside the body',async()=>{
 const ringWedges={'uranus-rings-wedges@2x.webp':{count:16,contentPixels:213.4}};
 const result=await prepareAuthored('uranus',[1,0,0],profile=>profile,{ringWedges},profileWidths);
 const planes='planes' in result?result.planes??[]:[];
 const rings=planes.find(plane=>plane.id==='rings');
 assert.ok(rings);assert.equal(rings.leaves.length,16);
 const profile=parseGeometryProfile(await readJson('src/objects/uranus/source/preparation/geometry.json'));
 const bodyRadius=profile.surface.radius*profile.projection.tileSize;
 for(const leaf of rings.leaves){
  const values=/matrix3d\(([^)]+)\)/.exec(leaf.style)?.[1]?.split(',').map(Number);
  assert.ok(values&&values.length===16);
  const height=Number(/--polycss-atlas-height:([0-9.]+)px/.exec(leaf.style)?.[1]);
  // The nearest point of a wedge is the middle of its inner edge.
  const x=values[4]*height/2+values[12],y=values[5]*height/2+values[13];
  assert.ok(Math.hypot(x,y)>bodyRadius,`a wedge starts ${Math.hypot(x,y)} from the centre, inside the body's ${bodyRadius}`);
 }
});
test('ring wedges that would reach into the body are refused',async()=>{
 await assert.rejects(prepareAuthored('uranus',[1,0,0],profile=>profile,{ringWedges:{'uranus-rings-wedges@2x.webp':{count:16,contentPixels:120}}},profileWidths),/reach into the body/);
});
