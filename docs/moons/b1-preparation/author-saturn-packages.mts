#!/usr/bin/env node
import data from './saturn-inputs.json' with {type:'json'};
import {parseAuthoringManifest,parseAuthoringDescriptor,parseAuthoringContent,parseAuthoringNavigation,parseAuthoringSolid} from '../../../tools/source-authoring-templates.mts';
import {requireRecord} from '../../../tools/source-values.mts';
/** B1 source-only authoring. No runtime baking, shared edits, acquisition or Git mutation.
 * Run from the existing B1 checkout: node docs/moons/b1-preparation/author-saturn-packages.mts
 * --refresh-pins refreshes only this cohort's manifests/descriptors after orbit receipts arrive.
 */
import {readFile,writeFile,mkdir,readdir,access} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
if(resolve(process.cwd())!==root)throw new Error('Run from the existing B1 checkout root.');
const SHA=data.commonContract.acceptedExampleCommit;
const ids=data.bodies.map(b=>b.identity.id);
if(ids.length!==18||new Set(ids).size!==18)throw new Error('B1 Saturn cohort changed.');
const hash=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex');
const git=(path:string)=>execFileSync('git',['show',`${SHA}:${path}`],{cwd:root});
const json=(path:string):unknown=>JSON.parse(git(path).toString('utf8'));
const stringify=(x:unknown)=>JSON.stringify(x,null,2)+'\n';
const write=async(path:string,value:unknown)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,typeof value==='string'||Buffer.isBuffer(value)?value:stringify(value));};
const exists=(path:string)=>access(path).then(()=>true,()=>false);
const files=async (path:string):Promise<string[]>=>(await Promise.all((await readdir(path,{withFileTypes:true})).map(async e=>e.isDirectory()?files(resolve(path,e.name)):[resolve(path,e.name)]))).flat();
const baseline='src/planets/kiviuq/';
const commonManifest=json(baseline+'source/manifest.json');
const replace=(s:string,id:string,name:string)=>s.replaceAll('kiviuq',id).replaceAll('Kiviuq',name);
const parseCopy=(value:unknown,id:string,name:string):unknown=>JSON.parse(replace(JSON.stringify(value),id,name));
async function repin(id:string){
 const pkg=resolve(root,'src/planets',id),src=resolve(pkg,'source');
 const man=parseAuthoringManifest(JSON.parse(await readFile(resolve(src,'manifest.json'),'utf8')));
 const owned=new Set([...man.inputs,...man.generatedIntermediates].map(e=>e.path));
 man.documents=[];
 for(const path of (await files(src)).sort()){
  const rel=relative(src,path).replaceAll('\\','/');if(rel==='manifest.json'||owned.has(rel))continue;
  const bytes=await readFile(path);man.documents.push({path:rel,expectedBytes:bytes.length,expectedSha256:hash(bytes),purpose:'Body-specific scientific interpretation, source evidence or preparation configuration.'});
 }
 await write(resolve(src,'manifest.json'),man);
 const descriptor=parseAuthoringDescriptor(JSON.parse(await readFile(resolve(pkg,'object.json'),'utf8')));
 for(const s of descriptor.properties.recipe.sources)s.sha256=hash(await readFile(resolve(pkg,s.path)));
 await write(resolve(pkg,'object.json'),descriptor);
}
if(process.argv.includes('--refresh-pins')){
 for(const id of ids)await repin(id);
 console.log(JSON.stringify({mode:'refresh-pins',ids}));process.exit(0);
}
for(const id of ids){
 const pkg=resolve(root,'src/planets',id);
 if(await exists(pkg))for(const path of await files(pkg))if(!relative(pkg,path).replaceAll('\\','/').startsWith('source/validation/'))throw new Error(`Refusing to replace existing package file: ${path}`);
 for(const path of [`site/pages/${id}.astro`,`tests/objects/unit/${id}`,`tests/objects/browser/${id}`])if(await exists(resolve(root,path)))throw new Error(`Refusing to replace existing owned path: ${path}`);
}
const {default:sharp}=await import('sharp');
const fontkit=await import('fontkit');
const {createPlanetTitleSource}=await import('../../../tools/prepare-planet-title-sources.mts');
const {PLANET_TITLE_RECIPE}=await import('../../../src/platform/planet-title-recipe.mts');
const {parsePdsRadiusTable}=await import('../../../tools/objects/terrestrial-layers/obj-shape.mts');
const {simplifyRadialShape}=await import('../../../tools/objects/terrestrial-layers/radial-terrain.mts');
const {renderRadialSnapshot}=await import('../../../tools/objects/terrestrial-layers/radial-snapshot.mts');
const {paintMissingCoverage}=await import('../../../src/platform/prepare-missing-coverage.mts');
const fontPath=resolve(root,baseline,'source/presentation/InterVariable.ttf');
if(hash(await readFile(fontPath))!==PLANET_TITLE_RECIPE.sourceSha256)throw new Error('Existing Inter font pin mismatch.');
const baseFont=fontkit.openSync(fontPath);
if(!('getVariation' in baseFont))throw new TypeError('Title requires its pinned variable font.');
const font=baseFont.getVariation({wght:PLANET_TITLE_RECIPE.weight,opsz:PLANET_TITLE_RECIPE.opticalSize});
const neutral=git(baseline+'source/material/neutral.png');
const width=512,height=256;
const painted=paintMissingCoverage(Buffer.alloc(width*height*3,160),{width,height,channels:3},new Uint8Array(width*height).fill(1));
const contextMap=await sharp(painted,{raw:{width,height,channels:3}}).ensureAlpha().webp({lossless:true,effort:4}).toBuffer();
const report=[];
for(const body of data.bodies){
 const {id,displayName:name,targetNaif,designation,iauNumber}=body.identity,R=body.scale.adoptedReferenceRadiusKm,q=body.shape.minimumEquatorialAxisRatio;
 const pkg=resolve(root,'src/planets',id),src=resolve(pkg,'source');
 const [a,b,c]=body.shape.derivedDisplaySemiAxesKm;
 const radRows=[];
 for(let lat=-90;lat<=90;lat+=5)for(let lon=0;lon<=360;lon+=5){
  const p=lat*Math.PI/180,l=lon*Math.PI/180,r=1/Math.sqrt((Math.cos(p)*Math.cos(l)/a)**2+(Math.cos(p)*Math.sin(l)/b)**2+(Math.sin(p)/c)**2);
  radRows.push(`${lon} ${lat} ${r.toFixed(12)}`);
 }
 const table=radRows.join('\n')+'\n';
 await write(resolve(src,'shape/ellipsoid.tab'),table);await write(resolve(src,'material/neutral.png'),neutral);
 const measurements={...structuredClone(body.measurementDefinition),sampling:{stepDegrees:5,longitudeDirection:'east-positive',radiusUnit:'km'}};
 await write(resolve(src,'measurements.json'),measurements);
 const rotation={schema:'cssearth-display-orientation@1',rightAscensionDegrees:body.displayOrientation.rightAscensionDegrees,declinationDegrees:body.displayOrientation.declinationDegrees,phase:'arbitrary-display-phase',displayMeridianDegrees:0,source:measurements.source.url,coordinateSystem:'ICRF/J2000',qualification:body.displayOrientation.qualification};
 await write(resolve(src,'preparation/rotation.json'),rotation);
 const config=parseAuthoringSolid(parseCopy(json(baseline+'source/preparation/terrestrial.json'),id,name));
 config.geometry.radiusKm=R;config.geometry.camera.framingScale=Math.min(1,R/a);
 config.geometry.radialTerrain.simplification.maximumErrorMeters=25*R;
 requireRecord(config.raster.observations[0].metadata).coverage=body.contentDefinition.lensCoverage;
 config.celestial.sunSource='JPL Saturn-system ephemeris; '+body.displayOrientation.qualification;
 await write(resolve(src,'preparation/terrestrial.json'),config);
 const content=parseAuthoringContent(parseCopy(json(baseline+'source/content/object.json'),id,name));
 content.panel.introduction=body.contentDefinition.introduction;
 content.panel.facts=[{id:'diameter',...body.contentDefinition.diameterFact},{id:'parent',label:'Orbits',value:'Saturn'},{id:'shape',...body.contentDefinition.shapeFact},{id:'rotation',...body.contentDefinition.periodFact},{id:'discovery',label:'Discovery',value:(/S\/(\d{4})/.exec(designation)??(()=>{throw new TypeError(`Missing discovery year: ${designation}`);})())[1]}];
 content.panel.moreFacts=[{id:'scale-assumption',label:'Size assumption',value:'Geometric albedo 0.06; brightness-based estimate'},{id:'orientation-limit',label:'Orientation',value:id==='bestla'?'Southward pole constraint; exact pole and phase unknown':'Unknown physical pole and phase; illustrative display'}];
 const control=content.lenses.controls[0];control.description=control.title=body.contentDefinition.lensCoverage;control.detail='Approximate shape';
 await write(resolve(src,'content/object.json'),content);
 const title={schema:'cssearth-title-source@1',...createPlanetTitleSource(name,font)};
 await write(resolve(src,'presentation/title-mark.json'),title);
 await write(resolve(src,'presentation/minimap.json'),json(baseline+'source/presentation/minimap.json'));
 for(const path of ['preparation/acquisition.json','stars/ESO-IMAGE-LICENSE.md','stars/LICENSE.md','stars/hyg-v41-field.json']){
  const bytes=git(baseline+'source/'+path);await write(resolve(src,path),replace(bytes.toString('utf8'),id,name));
 }
 const research={schema:'cssearth-source-feasibility-receipt@1',checkedOn:data.checkedOn,key:body.identity.key,identity:body.identity,scale:body.scale,rotation:body.rotation,displayOrientation:body.displayOrientation,shapeLimit:body.shape.geometryLimit,sourceDiscrepancies:body.sourceDiscrepancies??[],sourcePins:body.sourcePinIds.map(i=>{const s=data.sourcePins.find(s=>s.id===i);if(!s)throw new TypeError(`Missing source pin: ${i}`);return{id:s.id,url:s.url,retrieved:s.retrieved,expectedBytes:s.expectedBytes,sha256:s.sha256,purpose:s.purpose};}),scope:'Published numerical constraints only; full research papers/pages are not bundled or relabeled with the repository license.'};
 await write(resolve(src,'survey/research.json'),research);
 const mesh=parsePdsRadiusTable(table,config.geometry.radialTerrain.grid),faces=await simplifyRadialShape(mesh,config.geometry.radialTerrain,230/(R*1000));
 const recipe={generator:'tools/objects/terrestrial-layers/radial-snapshot.mts',inputs:['lightcurve-approximation','model-surface'],size:512,longitudeDegrees:55,latitudeDegrees:20,ambient:.45,diffuse:.55,lensId:'model'};
 const context=await renderRadialSnapshot({...recipe,faces,map:contextMap});await write(resolve(src,'presentation/context.png'),context);
 const attribution='Denk et al. (2018) minimum elongation; cssEarth assumed-depth ellipsoid and standard missing-data grid';
 const navigation=parseAuthoringNavigation(parseCopy(json(baseline+'source/preparation/navigation.json'),id,name));
 navigation.source.credit=attribution;navigation.source.recipe=recipe;navigation.source.expectedBytes=context.length;navigation.source.expectedSha256=hash(context);
 await write(resolve(src,'preparation/navigation.json'),navigation);
 const manifest=parseAuthoringManifest(parseCopy(commonManifest,id,name));
 for(const entry of manifest.inputs){
  if(['lightcurve-approximation','model-surface'].includes(entry.id ?? '')){
   const bytes=await readFile(resolve(src,entry.path));entry.expectedBytes=bytes.length;entry.expectedSha256=hash(bytes);entry.credit=attribution;entry.coverage=body.contentDefinition.lensCoverage;requireRecord(entry.projection).referenceRadiusMeters=R*1000;
   entry.licenseEvidence=[measurements.source.paper,measurements.source.url];
  }
 }
 manifest.generatedIntermediates=[{...navigation.source}];
 await write(resolve(src,'manifest.json'),manifest);
 const descriptor=parseAuthoringDescriptor(parseCopy(json(baseline+'object.json'),id,name));delete descriptor.properties.worldFrame;descriptor.properties.recipe.shape.radiusKm=R;
 // A fail-closed scaffold sentinel: no prepared artifact is copied or asserted.
 descriptor.prepared.sha256='0'.repeat(64);if(!descriptor.properties.preparation)throw new TypeError('Missing preparation state.');descriptor.properties.preparation.state='awaiting-source-restoration-orbit-fit-and-preparation';
 await write(resolve(pkg,'object.json'),descriptor);
 await repin(id);
 const notes=body.shape.geometryLimit;
 const axes=body.shape.derivedDisplaySemiAxesKm.map(x=>x.toFixed(6)).join(' × ');
 const sourceText=`# ${name} source survey\n\n## Selected shape\n\n[Denk et al. (2018), Table 3](${measurements.source.paper}) gives a minimum equatorial ratio of **${q}:1** under the uniform-reflectivity reference-ellipsoid interpretation of unresolved Cassini photometry. The [author’s Table 1C](${measurements.source.url}) gives a nominal reference radius of **${R} km**, a rounded diameter estimate **${body.scale.diameterDisplayText}**, and the reported rotation period **${body.rotation.displayText}**.\n\nSize assumes geometric albedo **0.06**. The author describes approximately −15/+30% sensitivity for albedo ±0.02 and H ±0.1 mag; the rounded range is not a measured Gaussian 1σ interval. The selected radius and rounded diameter are kept separately. No mass or density estimate is treated as measured.\n\nThe authored ellipsoid selects the published minimum ratio and assumes equal short axes. Its **derived display semi-axes** are **${axes} km**. Equal-volume scaling to the ${R} km reference radius is a display convention, not a measured volume. Formula and assumptions are in source/measurements.json; the checked 5° radius table is the reproducible source input.\n\n${notes}\n\nThe approximation does not reproduce the observed lightcurve. No terrain, concavities, neck, separate component, or spatial albedo pattern is synthesized. The entire surface uses the standard missing-data grid. The context image is rendered from the same source mesh, simplifier and grid as the eventual surface.\n\n## Source candidates and limits\n\n- **Cassini ISS:** [PDS archive](https://pds-rings.seti.org/cassini/iss/) and the [individual observation page](${measurements.source.url}) supply unresolved photometry. It constrains brightness/elongation; no registered surface photograph is qualified.\n- **Native inversion mesh:** [Denk et al. (2026), section 4.2](https://tilmanndenk.de/wp-content/uploads/2026_SSR_DenkEtAl_IoMinorMoons.pdf) reports calculated convex models with papers in preparation. No native ${name} mesh is asserted by this authored approximation.\n- **Terrain, colors, composition and binarity:** these checked sources do not qualify a mapped lens or components for this body. Integrated colors, where measured, are not painted onto the surface.\n- **Provenance:** source/survey/research.json pins the checked paper/page receipts, exact designation and SAT456 identity. Scientific parameters are extracted with attribution; entire papers/pages are not redistributed under MIT.\n${(body.sourceDiscrepancies??[]).map(t=>'- **Source reconciliation:** '+t+'\n').join('')}\n## Orientation and orbit\n\n${body.displayOrientation.qualification}\n\n${body.displayOrientation.displayPeriodUse}. Display meridian is arbitrary. Reported period **${body.rotation.displayText}** remains separate from a measured current attitude. Zero GM is unmodeled mass, not a measured zero.\n\nJPL ${targetNaif}, Saturn ${iauNumber}, **${designation}**, resolves to **SAT456**${id==='skathi'?' under legacy spelling Skadi in the grouped ephemeris table':''}. Mean elements establish identity and context. B1 orbital fitting and independent vector evidence are prepared separately; no borrowed fit, precision bound, current vector or extrapolation claim is made here. source/validation/orbit-checks.json will own the acquired reference epochs and measured fit residuals when produced.\n`;
 await write(resolve(pkg,'SOURCE.md'),sourceText);
 await write(resolve(pkg,'NOTICE.md'),`# Source credits\n\nScientific constraints: Denk et al. (2018), Denk and Mottola (2019), and Tilmann Denk’s ${name} physical/observation record. Authored parameter extraction, assumed-depth geometry and missing-data presentation: repository MIT license; retain scientific attribution and assumptions. Full research articles are not relicensed or bundled. ESO panorama: CC BY 4.0, ESO/S. Brunier. HYG source metadata: Astronexus, CC BY-SA 4.0. Inter font: SIL Open Font License. See source/stars for license evidence.\n`);
 await write(resolve(pkg,'README.md'),`# ${name}\n\nLightcurve-constrained minimum-elongation illustration through the generic object contract. ${notes} See [SOURCE.md](SOURCE.md) for the distinct physical estimates and display assumptions.\n\nThe radius table, neutral no-data image, title source and shape-derived context image are checked in. The normal acquisition plan restores pinned ESO/font inputs. Runtime installation requires the prepared assets and manifest produced by the shared pipeline.\n\nAfter orbit inputs and the preparation tools are available:\n\n\x60\x60\x60sh\nnode tools/objects/dist/operations.js acquire ${id}\nnode tools/objects/dist/prepare-authored.js ${id} --write\n\x60\x60\x60\n\nThe B1 source-only authoring script is docs/moons/b1-preparation/author-saturn-packages.mts. It copies no prepared scene or other body’s orbital validation.\n`);
 await write(resolve(root,`site/pages/${id}.astro`),replace(git('site/pages/kiviuq.astro').toString('utf8'),id,name));
 await write(resolve(root,`tests/objects/browser/${id}/browser-profile.mjs`),replace(git('tests/objects/browser/kiviuq/browser-profile.mjs').toString('utf8'),id,name));
 const unit=replace(git('tests/objects/unit/kiviuq/source.test.mjs').toString('utf8'),id,name)
  .replaceAll('14721.021353201924',String(a*1000)).replaceAll('6345.267824656003',String(b*1000)).replaceAll('2.32',String(q)).replace(/\b8400\b/g,String(R*1000));
 const extra=`\n\ntest('${name} preserves the source identity and honest rotation/shape interpretation', async () => {\n  const evidence = await read('survey/research.json');\n  const content = await read('content/object.json');\n  const rotation = await read('preparation/rotation.json');\n  assert.equal(evidence.identity.targetNaif, '${targetNaif}');\n  assert.equal(evidence.identity.designation, '${designation}');\n  assert.equal(evidence.identity.solution, 'SAT456');\n  assert.equal(evidence.rotation.tentative, ${body.rotation.tentative});\n  assert.equal(evidence.scale.geometricAlbedoAssumption, 0.06);\n  assert.equal(content.lenses.controls[0].detail, 'Approximate shape');\n  assert.match(content.lenses.controls[0].description, /assumed/);\n  assert.equal(rotation.phase, 'arbitrary-display-phase');\n  assert.equal(rotation.declinationDegrees, ${body.displayOrientation.declinationDegrees});\n  assert.equal(content.panel.facts.find(fact => fact.id === 'rotation').value, ${JSON.stringify(body.rotation.displayText)});\n});\n`;
 await write(resolve(root,`tests/objects/unit/${id}/source.test.mjs`),unit+extra);
 report.push({id,sourceFaces:mesh.indices.length,outputFaces:faces.length,contextBytes:context.length,semiAxesKm:body.shape.derivedDisplaySemiAxesKm});
 console.log(JSON.stringify(report.at(-1)));
}
console.log(JSON.stringify({authored:report.length,preparedArtifacts:0,orbitReceipts:0,sharedFilesChanged:0,inputs:'saturn-inputs.json'}));
