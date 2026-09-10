import {requireRecord,requireArray,requireString,requireFiniteNumber,hasErrorCode} from '../../source-values.mts';
import {readIntake} from './intake.mts';
const records=(value:unknown)=>requireArray(value).map(item=>requireRecord(item));
// Author new body packages from the pinned SSC intake. Run from repository root.
import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {candidates,upstream,sourceRoot} from './catalog.mts';
import {meshSource} from './mesh-source.mts';
const read=async (p:string|URL)=>requireRecord(JSON.parse(await readFile(p,'utf8')));
const write=async(p:string,o:unknown)=>{await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(o,null,2)+'\n');};
const pin=async(p:string)=>{const b=await readFile(p);return {expectedBytes:b.length,expectedSha256:createHash('sha256').update(b).digest('hex')};};
const intake=await readIntake(),editorial=await read(new URL('./editorial.json',import.meta.url));
if(intake.length!==candidates.length)throw Error('Run acquire-orbits first');
const base='src/planets/comet-209p';
const url=`https://github.com/CelestiaProject/CelestiaContent/blob/${upstream.commit}/data/comets.ssc`;
const credit='Celestia contributors: Grant Hutchison, Chris Laurel, DaveBowman2001 and AstroChara';
const license='GPL-2.0-or-later (Celestia catalog); independent cssEarth preparation code MIT';
const header=(await readFile(new URL('comets.ssc',sourceRoot),'utf8')).split('# Periodic Comets')[0];
for(const c of intake){
 const ed=requireRecord(editorial[c.id]??{}),name=ed.name===undefined?c.name.replaceAll('-','–'):requireString(ed.name),full=c.designation+(c.designation.startsWith('C/')?' ':'/')+name;
 const p=`src/planets/${c.id}`,s=`${p}/source`;
 try{await access(`${p}/object.json`);throw Error(`Refusing to overwrite ${c.id}`);}catch(e){if(!hasErrorCode(e,'ENOENT'))throw e;}
 const clone=async(rel:string)=>requireRecord(JSON.parse((await readFile(`${base}/${rel}`,'utf8')).replaceAll('comet-209p',c.id).replaceAll('LINEAR',name)));
 for(const rel of ['stars/eso0932a.tif','stars/ESO-IMAGE-LICENSE.md','stars/LICENSE.md','presentation/InterVariable.ttf','presentation/minimap.json']){
  await mkdir(dirname(`${s}/${rel}`),{recursive:true});await copyFile(`${base}/source/${rel}`,`${s}/${rel}`);
 }
 await write(`${s}/stars/hyg-v41-field.json`,await clone('source/stars/hyg-v41-field.json'));
 await writeFile(`${s}/reference/celestia.ssc`,header+c.excerpt+'\n');
 await copyFile(new URL('GPL-2.0-or-later.txt',sourceRoot),`${s}/reference/GPL-2.0-or-later.txt`);
 const {obj,model}=await meshSource(c),meshReport=model.nativeExport;
 await mkdir(`${s}/shape`,{recursive:true});
 await writeFile(`${s}/shape/model.obj`,obj);
 await copyFile(new URL(c.mesh,sourceRoot),`${s}/shape/${c.mesh}`);
 await write(`${s}/shape/model.json`,model);
 const config=await clone('source/preparation/terrestrial.json');config.distanceAu=c.distanceAu;const geometry=requireRecord(config.geometry),radialTerrain=requireRecord(geometry.radialTerrain);geometry.radiusKm=model.volumeEquivalentRadiusKm;
 radialTerrain.path='shape/model.obj';radialTerrain.format='wavefront-obj';radialTerrain.grid={metersPerUnit:1,expectedVertices:meshReport.vertices,expectedFaces:meshReport.faces};
 records(requireRecord(config.raster).shapeViews)[0].label='Illustrative nucleus';
 requireRecord(radialTerrain.simplification).maximumErrorMeters=c.radiusKm*50;
 requireRecord(radialTerrain.sourceLighting).maximumDistanceMeters=c.radiusKm*20;
 requireRecord(config.celestial).qualification='Fixed-epoch position from JPL Horizons. Celestia mesh, size estimate and orientation are illustrative; no surface photograph or measured shape is claimed.';
 await write(`${s}/preparation/terrestrial.json`,config);
 const rotation=await clone('source/preparation/rotation.json');rotation.qualification='Fixed illustrative orientation. No spin pole, rotation period or current rotational phase is represented.';await write(`${s}/preparation/rotation.json`,rotation);
 await write(`${s}/preparation/acquisition.json`,await clone('source/preparation/acquisition.json'));
 const content=await clone('source/content/object.json');
 const lenses=requireRecord(content.lenses),lensControl=records(lenses.controls)[0],provenance=requireRecord(content.provenance);
 const diameter=Number((2*c.radiusKm).toPrecision(2));
 const facts=[{id:'diameter',label:'Catalog diameter',value:`≈${diameter} km`},{id:'perihelion',label:'Closest to Sun',value:`${Number(c.perihelionAu.toPrecision(3))} AU`}];
 const introduction=ed.introduction??`${name} follows a distant orbit that stays beyond Saturn at its closest approach to the Sun. Its nucleus is represented here by a size illustration from Celestia’s catalog.`;
 content.panel={introduction,facts,moreFacts:[]};requireRecord(lenses.labels).model='Illustrative nucleus';
 Object.assign(lensControl,{label:'Illustrative nucleus',detail:'Celestia',title:full,description:'Celestia’s mesh at the catalog’s estimated size. The shape is illustrative, and the grid marks missing surface imagery.',facts});
 requireRecord(lensControl.source).url=url;requireRecord(lensControl.source).id='celestia-mesh';
 records(requireRecord(content.settings).controls).forEach(x=>{if(x.name==='shadows'||x.name==='orbit')x.checked=false;});
 content.resources=[{label:'Celestia',role:'surface',description:'Catalog entry and estimated scale',href:url},{label:'JPL Horizons',role:'observations',description:'Position at 3 September 2026',href:'https://ssd.jpl.nasa.gov/horizons/'},...(ed.url?[{label:'About this comet',role:'observations',description:'Observations and history',href:ed.url}]:[]),requireArray(content.resources).at(-1)];
 provenance.editorial={url:ed.url??url,credit:ed.url?'Sources listed in reference/source-record.json':credit};provenance.physical={path:'../shape/model.json',credit};
 await write(`${s}/content/object.json`,content);
 await write(`${s}/reference/source-record.json`,{catalog:{...upstream,entry:c.designation,mesh:c.mesh,radiusKm:c.radiusKm,license:'GPL-2.0-or-later',credit},editorial:ed,
  selected:{identity:'Celestia designation',size:'Catalog Radius, approximate; not a new measurement',position:'Independent JPL heliocentric elements and vectors at JD2461286.5',shape:`Native export of Celestia ${c.mesh}; shared illustrative geometry`,texture:'Shared missing-imagery grid',attitude:'Fixed illustration'},
  candidateSurvey:[{url,disposition:`Celestia references ${c.mesh}, a shared illustrative model. Select the native mesh at catalog scale; no stock texture or invented rotation period.`},{url:'https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/',disposition:'Existing scientifically reconstructed cssEarth comets are preserved. This catalog expansion does not claim a recovered mesh for new entries.'},{url:ed.url??url,disposition:'Coma, tail, spectra and encounter context are useful source material; they do not establish a nucleus surface texture. Additional quantitative shape reconstruction remains a separate source qualification.'}],
  derivedFacts:{diameter:'2 * Celestia Radius (km), rounded to two significant figures; catalog estimate',perihelion:'JPL signed semimajor axis * (1 - eccentricity) / AU, at the shared epoch; osculating closest solar distance, not a predicted next-event date'},
  assumptions:['No albedo, mass, density, pole or placeholder rotation is imported.','The native Celestia procedural mesh is shared and illustrative, not a nucleus terrain measurement.','No tail, coma or historical outburst is rendered.']});
 const manifest=await clone('source/manifest.json');manifest.schema=`css${c.id}-authoritative-sources@1`;const inputs=records(manifest.inputs).slice(0,2);manifest.inputs=inputs;
 inputs.push({id:'celestia-mesh',path:'shape/model.obj',...await pin(`${s}/shape/model.obj`),origin:url,credit,license,licenseEvidence:['reference/celestia.ssc','reference/GPL-2.0-or-later.txt'],acquisition:'Exported from the pinned original Celestia generator; normalized and uniformly scaled.',redistribution:'Preserve GPL terms, upstream credit and the illustrative status of the model.',consumers:['shape']});manifest.generatedIntermediates=[];manifest.documents=[];await write(`${s}/manifest.json`,manifest);
 const nav=await clone('source/preparation/navigation.json');Object.assign(requireRecord(nav.source),{origin:url,credit,license,licenseEvidence:['reference/celestia.ssc','reference/GPL-2.0-or-later.txt'],acquisition:'Reproduced from the native Celestia mesh and missing-imagery grid.'});requireRecord(requireRecord(nav.source).recipe).inputs=['celestia-mesh'];await write(`${s}/preparation/navigation.json`,nav);
 const descriptor=await clone('object.json');const properties=requireRecord(descriptor.properties),page=requireRecord(properties.page);delete properties.catalog;delete properties.worldFrame;delete descriptor.prepared;delete page.metadata;requireRecord(properties.preparation).label=name;requireRecord(requireRecord(properties.recipe).shape).radiusKm=model.volumeEquivalentRadiusKm;await write(`${p}/object.json`,descriptor);
 page.stylesheets=requireArray(page.stylesheets).map(value=>{const path=requireString(value);return path.endsWith('/comet-209p-surfaces.css')||path.endsWith(`/${c.id}-surfaces.css`)?`src/renderers/css/styles/${c.id}-surfaces.css`:path;});
 await write(`${p}/object.json`,descriptor);
 await writeFile(`src/renderers/css/styles/${c.id}-surfaces.css`,(await readFile('src/renderers/css/styles/comet-209p-surfaces.css','utf8')).replaceAll('comet-209p',c.id));
 const profile=`tests/objects/browser/${c.id}/browser-profile.mjs`;await mkdir(dirname(profile),{recursive:true});await writeFile(profile,(await readFile('tests/objects/browser/comet-209p/browser-profile.mjs','utf8')).replaceAll('comet-209p',c.id));
 await writeFile(`${p}/NOTICE.md`,`# Sources and reuse\n\nCelestia catalog: ${credit}. GPL-2.0-or-later; see source/reference/celestia.ssc and source/reference/GPL-2.0-or-later.txt. The catalog excerpt and derived size parameters retain these terms. Independent cssEarth code is MIT. Original Celestia mesh code and exported geometry retain GPL-2.0-or-later; no photographic texture is redistributed.\n\nJPL Horizons: fixed-epoch scientific orbit records. ESO/S. Brunier panorama: CC BY 4.0. HYG and Inter retain their notices beside the pinned sources.\n`);
 await writeFile(`${p}/README.md`,`# ${full}

${introduction}

## Sources

| Source | What the view uses |
| --- | --- |
| [Celestia catalog entry](source/reference/celestia.ssc) | Illustrative CMS mesh and approximate radius, ${c.radiusKm} km. |
| [JPL elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric ICRF position at JD2461286.5 (3 September 2026 TT; Horizons TDB differs by less than 2 ms). |

[Selection and assumptions](source/reference/source-record.json) · [Credits](NOTICE.md).

## Evidence

This scaffold has not qualified the prepared body. Record source comparisons,
preparation results and inspected browser views here, with the tested revision
and links to the original evidence.

## Known problems

The native Celestia mesh is illustrative, not a measured shape. The grid marks
missing surface imagery. Rotation is a fixed illustration. Nearby conics are
an approximation at the scene epoch, not a long-term ephemeris or outgassing model.

## Methods

Shadows and Orbit default off. The catalog’s assumed spin and generic rock
texture are not imported. Preparation uses the shared authored-object pipeline.
See [catalog import and reproduction](../../../tools/objects/celestia-comets/README.md).
`);
 console.log(c.id,name,c.radiusKm);
}
