// Source authoring for the archived SN263 system. Runtime preparation stays shared.
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import * as fontkit from 'fontkit';
import {createPlanetTitleSource} from '../../../tools/prepare-planet-title-sources.mjs';
import {PLANET_TITLE_RECIPE} from '../../../src/platform/planet-title-recipe.mjs';
import {parseObjShape} from '../../../tools/objects/terrestrial-layers/obj-shape.mjs';
import {simplifyRadialShape} from '../../../tools/objects/terrestrial-layers/radial-terrain.mjs';
import {renderRadialSnapshot} from '../../../tools/objects/terrestrial-layers/radial-snapshot.mjs';
import {paintMissingCoverage} from '../../../src/platform/prepare-missing-coverage.mjs';

const root=resolve(import.meta.dirname,'../../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(p));
const write=async(p,v)=>{await mkdir(dirname(p),{recursive:true});await writeFile(p,Buffer.isBuffer(v)||typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');};
const files=async d=>(await Promise.all((await readdir(d,{withFileTypes:true})).map(e=>e.isDirectory()?files(resolve(d,e.name)):[resolve(d,e.name)]))).flat();
const base='https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-153591.radar.shape-model/';
const release='urn:nasa:pds:gbo.ast-153591.radar.shape-model::1.0';
const cohort=[['asteroid-2001-sn263','alpha','2001 SN263 Alpha'],['sn263-beta','beta','2001 SN263 Beta'],['sn263-gamma','gamma','2001 SN263 Gamma']];
const primarySource=resolve(root,'src/planets/asteroid-2001-sn263/source');
const fontPath=resolve(primarySource,'presentation/InterVariable.ttf');

export async function repin(id){
 const pkg=resolve(root,'src/planets',id),src=resolve(pkg,'source'),manifest=await read(resolve(src,'manifest.json'));
 for(const entry of [...manifest.inputs,...manifest.generatedIntermediates]){const bytes=await readFile(resolve(src,entry.path));entry.expectedBytes=bytes.length;entry.expectedSha256=hash(bytes);}
 const owned=new Set([...manifest.inputs,...manifest.generatedIntermediates].map(x=>x.path));manifest.documents=[];
 for(const path of (await files(src)).sort()){
  const name=relative(src,path);if(name==='manifest.json'||owned.has(name))continue;
  const bytes=await readFile(path);manifest.documents.push({path:name,expectedBytes:bytes.length,expectedSha256:hash(bytes),purpose:'Source metadata, numerical interpretation or authored preparation input.'});
 }
 await write(resolve(src,'manifest.json'),manifest);
 const descriptor=await read(resolve(pkg,'object.json'));
 for(const ref of descriptor.properties.recipe.sources)ref.sha256=hash(await readFile(resolve(pkg,ref.path)));
 await write(resolve(pkg,'object.json'),descriptor);
}
if(process.argv.includes('--refresh-pins')){for(const [id] of cohort)await repin(id);process.exit(0);}
const metrics=Object.fromEntries((await read(resolve(import.meta.dirname,'source-models.json'))).map(({id,preparedFaces,contextBytes,...m},index)=>[cohort[index][1],m]));
if(hash(await readFile(fontPath))!==PLANET_TITLE_RECIPE.sourceSha256)throw new Error('Inter font pin differs.');
const font=fontkit.openSync(fontPath).getVariation({wght:PLANET_TITLE_RECIPE.weight,opsz:PLANET_TITLE_RECIPE.opticalSize});
const common=await read(resolve(primarySource,'manifest.json'));
const width=512,height=256;
const grid=paintMissingCoverage(Buffer.alloc(width*height*3),{width,height,channels:3},new Uint8Array(width*height).fill(1));
const map=await sharp(grid,{raw:{width,height,channels:3}}).png().toBuffer();
const report=[];
for(const [id,component,name] of cohort){
 const pkg=resolve(root,'src/planets',id),src=resolve(pkg,'source'),m=metrics[component],R=m.radiusKm;
 const isMoon=component!=='alpha';
 const shapePath=`shape/a153591${component}.tab`,shapeUrl=base+'data/a153591'+component+'.tab';
 const role=component==='alpha'?'primary':component==='beta'?'larger, outer moon':'smaller, inner moon';
 const coverage=`Published ${isMoon?'radar':'radar and light-curve'} shape of the ${role}. Fine terrain and visible-light color are unresolved; the grid marks missing imagery. The archive includes weakly observed model regions. ${isMoon?'The model assumes the primary’s spin pole for this moon. ':''}Rotational phase is illustrative.`;
 const orbitLimit=isMoon?'Orbital placement is approximate context extrapolated from the 2008 mutual-orbit fit. Current phase and long-term three-body evolution are not measured.':'Heliocentric placement uses a retained JPL state. The shape is a radar reconstruction from 2008 observations.';
 await write(resolve(root,`src/renderers/css/styles/${id}-surfaces.css`),(await readFile(resolve(root,'src/renderers/css/styles/squannit-surfaces.css'),'utf8')).replaceAll('squannit',id));
 await mkdir(resolve(src,'shape'),{recursive:true});
 // Native mesh is checked in at shapePath; no scratch download is required.
 await readFile(resolve(src,shapePath));
 for(const suffix of ['.xml','_unseen.tab','_unseen.xml'])await write(resolve(src,'reference',`a153591${component}${suffix}`),await readFile(resolve(src,'reference',`a153591${component}${suffix}`)));
 for(const suffix of ['pole.tab','pole.xml','rot.tab','rot.xml'])await write(resolve(src,'reference','a153591'+suffix),await readFile(resolve(primarySource,'reference','a153591'+suffix)));
 await write(resolve(src,'reference/archive-readme.txt'),await readFile(resolve(primarySource,'reference/archive-readme.txt')));
 const shapeInput={id:'radar-shape',path:shapePath,origin:shapeUrl,release,product:(await readFile(resolve(scratch,`a153591${component}.xml`),'utf8')).match(/<logical_identifier>([^<]+)<\/logical_identifier>/)[1]+'::1.0',credit:'Becker et al. (2015, PDS release 2020); Arecibo radar and optical light-curve teams',license:'NASA PDS archived scientific data; retain citation and attribution. See NOTICE.md.',acquisition:'Restore the unmodified PDS file through source/preparation/acquisition.json.',redistribution:'Attributed NASA PDS scientific data; retain archive citation and model limits.',consumers:['terrain','shape'],coverage,projection:{kind:'body-fixed-cartesian-triangular-mesh',units:'kilometers',longitudeDirection:'east',latitudeType:'planetocentric',referenceRadiusMeters:R*1000}};
 const config={schema:'cssearth-terrestrial-preparation@1',kind:'solid-observation-body',namespace:id,displayName:name,publicBase:`/scenes/${id}/`,distanceAu:1.9869,
  raster:{width,height,bandCount:16,gutter:64,poleSize:128,surfaceQuality:94,reportMissingPixels:true,observations:[],scientific:[],observedColors:[],shapeViews:[{id:'shape',label:'Shape',consumer:'shape'}]},
  lighting:{frameSize:512,columns:8,frameCount:128,logicalSize:460,terminatorWidth:.1,directionalAmbient:.05,fullPhaseAmbient:.35,fullPhaseDiffuse:.65,maximumOpacity:.95},
  geometry:{radius:230,radiusKm:R,camera:{initialScenePitchDegrees:20,defaultControlYawDegrees:-45,framingScale:Math.min(1,R/m.maxRadiusKm)},mapUrl:`/scenes/${id}/${id}-shape-surface@2x.webp`,polesUrl:`/scenes/${id}/${id}-shape-poles@2x.webp`,
   radialTerrain:{path:shapePath,format:'wavefront-obj',grid:{metersPerUnit:1000,expectedVertices:1148,expectedFaces:2292},faceBudget:800,tileSize:64,atlasColumns:16,primitive:'u',simplification:{method:'source-meshoptimizer',targetFaces:800,maximumErrorMeters:{alpha:35,beta:12,gamma:10}[component],regularize:false}}},
  celestial:{sunSource:orbitLimit+' '+coverage},presentation:{defaultLens:'shape',pointColor:[160,160,160],markerAtlasUrl:'/navigation/planet-markers@2x.webp'}};
 await write(resolve(src,'preparation/terrestrial.json'),config);
 // Archive pole table is ecliptic J2000; convert the unit vector to equatorial J2000.
 const rad=Math.PI/180,L=309*rad,B=-80*rad,eps=84381.448/3600*rad,x=Math.cos(B)*Math.cos(L),y=Math.cos(B)*Math.sin(L),z=Math.sin(B),ey=y*Math.cos(eps)-z*Math.sin(eps),ez=y*Math.sin(eps)+z*Math.cos(eps);
 const rotation={schema:isMoon?'cssearth-display-orientation@1':'cssearth-observed-pole@1',rightAscensionDegrees:(Math.atan2(ey,x)/rad+360)%360,declinationDegrees:Math.asin(ez)/rad,periodHours:{alpha:3.4256,beta:13.43,gamma:16.4}[component],phase:'arbitrary-display-phase',displayMeridianDegrees:0,source:base+'data/a153591pole.tab',coordinateSystem:'ICRF/J2000; converted from published ecliptic J2000 pole',qualification:isMoon?'Archive assumes the primary pole for this moon; it is not an independent pole measurement. Display meridian is arbitrary.':'Measured primary pole has about 15 degree uncertainty. Display meridian is arbitrary.'};
 if(component==='gamma')rotation.periodQualification='The archive assumes the rotation period equals the orbital period; it is not an independent spin measurement.';
 await write(resolve(src,'preparation/rotation.json'),rotation);
 const diameter={alpha:'2.5 ± 0.3 km',beta:'0.77 ± 0.12 km',gamma:'0.43 ± 0.14 km'}[component];
 const content={schema:'cssearth-object-content@1',version:1,id,displayName:name,panel:{introduction:`${name} is the ${role} of the triple asteroid system 2001 SN263. ${coverage} ${orbitLimit}`,facts:[{id:'parent',label:'Orbits',value:isMoon?'2001 SN263 Alpha':'Sun'},{id:'diameter',label:'Estimated diameter',value:diameter},{id:'shape',label:'Shape evidence',value:isMoon?'Radar':'Radar and light curves'},{id:'rotation',label:'Rotation period',value:rotation.periodHours+(component==='gamma'?' hours (assumed synchronous)':' hours')}],moreFacts:[{id:'shape-epoch',label:'Observations',value:'January–March 2008'},{id:'shape-scale',label:'Model extents',value:m.extentsKm.map(x=>x.toFixed(3)).join(' × ')+' km'},{id:'phase',label:'Orientation',value:isMoon?'Assumed pole · illustrative spin phase':'Measured pole · illustrative spin phase'},{id:'orbit-limit',label:'Position',value:orbitLimit}]},
  lenses:{titleKey:'lenses',defaultLens:'shape',labels:{shape:'Shape'},controls:[{id:'shape',label:'Shape',detail:'Radar',title:'Radar shape',description:coverage,thumbnail:`/scenes/${id}/${id}-shape-thumbnail.webp`,surface:`${id}-shape-surface@2x.webp`,poles:`${id}-shape-poles@2x.webp`,source:{id:'radar-shape',path:'../manifest.json',url:shapeUrl}}]},settings:{titleKey:'settings',controls:[{kind:'toggle',name:'shadows',label:'Shadows',checked:false},{kind:'toggle',name:'orbit',label:'Orbit',checked:true}]},charts:[],resources:[{label:'PDS shape archive',role:'surface',description:'Original component mesh, pole and rotation tables',href:'https://sbn.psi.edu/pds/resource/shape153591.html'},{label:'Becker et al. (2015)',role:'facts',description:'Shape reconstruction and physical measurements',href:'https://doi.org/10.1016/j.icarus.2014.10.048'},{label:'Fang et al. (2011)',role:'facts',description:'Mutual orbits and dynamical limits',href:'https://arxiv.org/abs/1012.2154'},{label:'ESO',role:'stars',description:'Milky Way panorama',href:'https://www.eso.org/public/images/eso0932a/'}],provenance:{title:{path:'../presentation/title-mark.json'},editorial:{url:shapeUrl,credit:shapeInput.credit},physical:{path:'../measurements.json',credit:shapeInput.credit}}};
 await write(resolve(src,'content/object.json'),content);
 await write(resolve(src,'measurements.json'),{schema:'cssearth-source-shape-measurements@1',id,component,release,source:shapeUrl,sourceUnits:'km',...m,publishedDiameter:diameter,referenceRadiusMeaning:'Equivalent-volume radius computed from the original closed triangular mesh; not an independent measurement.',shapeLimit:coverage,orbitLimit,physicalSource:'Becker et al. (2015), Table 4; physical API row order is not used.'});
 await write(resolve(src,'presentation/title-mark.json'),{schema:'cssearth-title-source@1',...createPlanetTitleSource(name,font)});
 await write(resolve(src,'presentation/InterVariable.ttf'),await readFile(fontPath));
 for(const f of ['stars/ESO-IMAGE-LICENSE.md','stars/LICENSE.md','stars/hyg-v41-field.json','presentation/LICENSE.INTER-OFL'])await write(resolve(src,f),await readFile(resolve(primarySource,f)));
 const catalog=await read(resolve(src,'stars/hyg-v41-field.json'));catalog.schema=`css${id}-prepared-star-source@1`;await write(resolve(src,'stars/hyg-v41-field.json'),catalog);
 await write(resolve(src,'stars/eso0932a.tif'),await readFile(resolve(primarySource,'stars/eso0932a.tif')));
 const mesh=parseObjShape(await readFile(resolve(src,shapePath),'utf8'),config.geometry.radialTerrain.grid),faces=await simplifyRadialShape(mesh,config.geometry.radialTerrain,230/(R*1000));
 const recipe={generator:'tools/objects/terrestrial-layers/radial-snapshot.mjs',inputs:['radar-shape'],size:512,longitudeDegrees:55,latitudeDegrees:20,ambient:.45,diffuse:.55,lensId:'shape'};
 const context=await renderRadialSnapshot({...recipe,faces,map});await write(resolve(src,'presentation/context.png'),context);
 const contextEntry={id:'prepared-radial-context',path:'presentation/context.png',origin:shapeUrl,credit:shapeInput.credit,license:shapeInput.license,consumers:['navigation'],generator:recipe.generator,recipe,expectedBytes:context.length,expectedSha256:hash(context)};
 await write(resolve(src,'preparation/navigation.json'),{schema:'cssearth-navigation-marker@1',planetId:id,owner:'object',presentation:{size:5},source:contextEntry,operations:[{type:'resize',width:'tile',height:'tile',fit:'cover',position:'centre',kernel:'lanczos3'},{type:'png'}],context:{pixels:512}});
 const inputs=[...common.inputs.filter(x=>['eso-milky-way-panorama','inter-title-font'].includes(x.id)),shapeInput];
 await write(resolve(src,'preparation/acquisition.json'),{schema:'cssearth-acquisition-plan@1',operations:inputs.map(x=>({kind:'download',groups:['restore','refresh'],path:x.path,url:x.origin}))});
 await write(resolve(src,'manifest.json'),{schema:`css${id}-authoritative-sources@1`,inputs,generatedIntermediates:[contextEntry],documents:[]});
 await write(resolve(pkg,'object.json'),{schema:'cssearth-object@1',id,type:'layered-body',properties:{page:{stylesheets:[`src/renderers/css/styles/${id}-surfaces.css`]},preparation:{schema:'cssearth-object-preparation@1',label:name,steps:['verify-sources','assets','starfield','sky-sun','scene','controls','presentation','runtime-assets']},recipe:{schema:'cssearth-authored-object@1',sources:[['terrestrial','preparation/terrestrial.json'],['content','content/object.json'],['title','presentation/title-mark.json'],['navigation','preparation/navigation.json'],['acquisition','preparation/acquisition.json'],['rotation','preparation/rotation.json']].map(([id,path])=>({id,path:'source/'+path,sha256:'0'.repeat(64)})),shape:{kind:'radial-terrain',radiusKm:R},surfaces:[{id:'body',source:'terrestrial',projection:'equirectangular',lenses:[{id:'shape',source:'content',material:'lighting'}]}],materials:[{id:'lighting',source:'terrestrial',model:'lit'}]}},prepared:{format:'cssearth-css-object@4',url:'prepared/object.json',sha256:'0'.repeat(64)}});
 await write(resolve(pkg,'.gitignore'),'source/stars/eso0932a.tif\nsource/presentation/InterVariable.ttf\n!source/shape/*.tab\n!source/reference/*.tab\n');
 await write(resolve(pkg,'NOTICE.md'),`# ${name} credits\n\nShape data: Becker et al. (2020), Shape model of Asteroid (153591) 2001 SN263 V1.0, NASA Planetary Data System, DOI [10.26033/7h7w-bx62](https://doi.org/10.26033/7h7w-bx62). Original radar and light-curve interpretation: Becker et al. (2015). PDS data reuse follows the [PDS data citation policy](https://pds.nasa.gov/citations/). The article has separate publisher terms; its figures are not runtime textures.\n\nOrbital facts: Fang et al. (2011) and JPL Horizons. ESO/S. Brunier panorama: CC BY 4.0. HYG catalogue: David Nash/Astronexus, CC BY-SA 4.0. Inter font: SIL Open Font License 1.1. Source license documents accompany the package.\n`);
 await write(resolve(pkg,'README.md'),`# ${name}\n\nA selectable ${role} through the shared CSS object renderer. ${coverage}\n\n## Sources\n\n| Source | Used for |\n| --- | --- |\n| [PDS SN263 V1.0](https://sbn.psi.edu/pds/resource/shape153591.html) | Original ${component} mesh, model limits, pole and rotation metadata |\n| [Becker et al. (2015)](https://doi.org/10.1016/j.icarus.2014.10.048) | Body identity and physical measurements |\n| [Fang et al. (2011)](https://arxiv.org/abs/1012.2154) | ${isMoon?'Mutual orbit and its uncertainties':'System interpretation'} |\n\nThe source mesh has 1,148 vertices and 2,292 faces, in kilometres. Its computed equivalent-volume radius is ${R.toFixed(6)} km. The paper's estimated diameter is **${diameter}**; the exact mesh volume is a model property, not a more precise observation. Credits and terms are in [NOTICE.md](NOTICE.md).\n\n## Evidence\n\nSource inputs and generated records are pinned in [the manifest](source/manifest.json). Preparation and browser qualification are in progress for this PR; no completed qualification is claimed here.\n\n## Known problems\n\n${orbitLimit} ${isMoon?'The archived pole is an assumed alignment with Alpha, not an independently measured moon pole. ':''}The published mesh contains areas with weak radar constraints; the original unseen-facet list is retained in source/reference. The all-over grid represents missing optical imagery, not radar coverage.\n\n<details>\n<summary>Preparation and source choices</summary>\n\nThe original PDS file is retained byte for byte. The existing source-mesh simplifier prepares ${faces.length} triangles and native PolyCSS raster leaves. The same mesh supplies the navigation image. All geometry, surface pixels, lighting and context assets are prepared offline. The displayed Shape view has no synthetic craters or albedo.\n\nThe PDS catalog landing page says 2003 observations, while the native product labels and paper identify January–March 2008; the latter control this package. The archive's rotation uncertainty columns also differ from the paper, so no uncertainty is silently taken from those columns. JPL's unnamed satellite API rows pair physical values with inconsistent inner/outer orbits; component identity follows the native mesh labels and papers.\n\nResolved optical imagery, mapped composition and a present spin-phase solution were not located. The published shape is the selected useful dataset.\n</details>\n`);
 await repin(id);report.push({id,...m,preparedFaces:faces.length,contextBytes:context.length});console.log(JSON.stringify(report.at(-1)));
}
await write(resolve(root,'docs/moons/b11-companion-catalog/source-models.json'),report);
