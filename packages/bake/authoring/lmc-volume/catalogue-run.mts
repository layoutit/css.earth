/** l11: catalogue geometry first; only object luminosities and global grades see the photo. */
import {mkdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {LOCAL,ROOT,ARCHIVE,json,rec,array,num,need,loadSources} from './inputs.mts';
import {L11,catalogueRows} from './catalogue-data.mts';
import {checkMcels} from './catalogue-check.mts';
import {buildCatalogueScene,type CatalogueScene} from './catalogue-scene.mts';
import {normalizeCatalogueDust,projectCatalogue,catalogueBasis} from './catalogue-render.mts';
import {calibrateObjects} from './catalogue-calibrate.mts';
import {loadObservation} from './observation.mts';
import {earthCamera,outsideCamera} from './render.mts';
import {targetOf,metrics,imageBytes} from './report.mts';
import {sourceTarget,gradedPrediction,readGrade,componentSettings,type Grade} from './grade.mts';
import {saveGradedSheet,normalized} from './grade-report.mts';
import {buildHybridScene} from './hybrid-model.mts';
import {buildGaiaScene} from './frozen-l12.mts';
import {outerLightControl} from './gaia-control.mts';
import {recordGaiaVersion} from './gaia-record.mts';
import {balanceGaiaGrade} from './gaia-balance.mts';
import {rayPlane} from './geometry.mts';
import {buildContinuousScene} from './continuous-model.mts';
import {calibrateContinuous} from './continuous-calibrate.mts';
import {recordContinuousVersion} from './continuous-record.mts';
const VERSION=process.argv.includes('--version=14')?14:process.argv.includes('--version=13')?13:process.argv.includes('--version=12')?12:11,OUT=`${LOCAL}versions/l${VERSION}/`;
const writeJson=async(path:string,value:unknown)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
export async function finishSheet(dir:string,version:number=VERSION,overrideLines?:string[]){
 const lines=overrideLines??(version===14?['Gaia population: 200 pc smoothing.','Young height remains 150 pc.','One diffuse RGB grade for the galaxy.','Outskirts gain: 0.5 to 4 times l13.','Outskirts transition: 3 to 5 kpc.','Disc / bar gains: 0.5 to 1.5.','Catalogue luminosities stay at l13.','Objects, warp, bar and dust: l13.','Clumps keep their finite 3D depths.','30 Dor keeps its shells and filaments.','SMASH is an independent check.','Individual depths remain adopted.']:version>=12?['Shapes stay inside catalogue footprints.','Photo / H-alpha: scalar object shapes.','Each clump is a finite isotropic volume.','Object depth RMS equals sky RMS.','30 Dor retains its shells and filaments.',version>=13?'Diffuse young: Gaia DR3 members.':'Diffuse young: SMASH star counts.',version>=13?'Luri Young 1 + Young 2 selection.':'Survey gaps use normalized smoothing.','Young layer: 150 pc on the warp.',version>=13?'Objects, old disc, bar and dust: l13.':'Old disc, bar and dust remain l11.','Object brightness and global grading.',version>=13?'SMASH is an independent check only.':'No galaxy-wide photographic layer.','Individual depths remain adopted.']:['Catalogue objects in a smooth galaxy.','Clusters and associations: finite balls.','HII regions: clouds and hollow shells.','30 Dor: bowl, bubbles and filaments.','Kim supershell candidates: finite rims.','NANTEN / MAGMA clouds attenuate.','Old disc: 410 pc Gaussian sigma.','Diffuse young / gas: 150 pc.','Dust: 250 pc. Bar sigma: 367 pc.','Object depths are adopted, not measured.','Only object brightness sees Horálek.','No photograph is stored in the volume.']);
 const legend=Buffer.from(`<svg width="512" height="604" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101216"/><g fill="#e7e9ed" font-family="Arial" font-size="17"><text x="18" y="35" font-size="24">l${version}: finite catalogue structures</text>${lines.map((s,i)=>`<text x="18" y="${78+i*40}">${s}</text>`).join('')}<text x="18" y="580" font-size="14">NGC 4027: ESO. Different filters and scale.</text></g></svg>`);
 await sharp({create:{width:1536,height:1668,channels:3,background:'#101216'}}).composite([{input:await readFile(dir+'sheet.png'),left:0,top:0},{input:await readFile(dir+'outside-comparison.png'),left:0,top:1064},{input:legend,left:1024,top:1064}]).png().toFile(dir+'sheet-complete.png');
 await copyFile(dir+'sheet-complete.png',dir+'sheet.png');
}
async function records(scene:CatalogueScene,runs:unknown[],fit:unknown){
 if(VERSION===14){await recordContinuousVersion(scene,runs,fit);return;}
 if(VERSION===13){await recordGaiaVersion(scene,runs,fit);return;}
 const base=`${ROOT}src/objects/lmc-volume/source/preparation/`,dir=base+`l${VERSION}/`;await mkdir(dir,{recursive:true});
 const cluster=`${ARCHIVE}dataset-model/detail-clusters/`,products=[
  ...[3,4,5].map(n=>({path:cluster+`Bica2008-table${n}.dat`,product:'CDS J/MNRAS/389/678',url:`https://cdsarc.cds.unistra.fr/ftp/J/MNRAS/389/678/table${n}.dat`})),
  {path:L11+'inputs/Bica2008-table6.dat',product:'CDS J/MNRAS/389/678',url:'https://cdsarc.cds.unistra.fr/ftp/J/MNRAS/389/678/table6.dat'},
  {path:cluster+'Glatt2010-lmc.dat',product:'CDS J/A+A/517/A50',url:'https://cdsarc.cds.unistra.fr/ftp/J/A+A/517/A50/lmc.dat'},
  ...[1,2].map(n=>({path:cluster+`Popescu2012-table${n}.dat`,product:'CDS J/ApJ/751/122; alternate photometry check',url:`https://cdsarc.cds.unistra.fr/ftp/J/ApJ/751/122/table${n}.dat`})),
  {path:L11+'inputs/DEM1976-j2000.tsv',product:'CDS VII/232/lmc, computed J2000 columns',url:'https://vizier.cfa.harvard.edu/viz-bin/asu-tsv?-source=VII/232/lmc&-out=DEM,m_DEM,Name,_RAJ2000,_DEJ2000,Maj,Min,Int,Comm&-out.max=unlimited'},
  ...[1,3].map(n=>({path:L11+`inputs/NANTEN2008-table${n}.dat`,product:'CDS J/ApJS/178/56',url:`https://cdsarc.cds.unistra.fr/ftp/J/ApJS/178/56/table${n}.dat`})),
  {path:L11+'inputs/MAGMA2011-table4.dat',product:'CDS J/ApJS/197/16, islands catalogue',url:'https://cdsarc.cds.unistra.fr/ftp/J/ApJS/197/16/table4.dat'},
  {path:L11+'inputs/Pellegrini2012-lmc.dat',product:'CDS J/ApJ/755/40, erratum-corrected MCELS',url:'https://cdsarc.cds.unistra.fr/ftp/J/ApJ/755/40/table5.dat'},
 ];
 if(VERSION===12)for(const name of ['full-grid','full-occupancy'])products.push({path:ARCHIVE+`dataset-model/detail-stars/source/${name}.csv`,product:'SMASH DR2 blue counts or independent occupancy; exact SQL in the adjacent request.json',url:'https://datalab.noirlab.edu/query/query'});
 const inputProducts=await Promise.all(products.map(async p=>({...p,path:p.path.slice(ROOT.length),bytes:(await stat(p.path)).size,acquisitionRoute:'Public CDS table download or VizieR TSV coordinate conversion. Preserved as published; schema validated by the LMC loader.'})));
 const inherited=new Set(['Pietrzynski2019','Kacharov2024','Rathore2025','Choi2018','Oden2026','Nidever2019','BC03','Bell2022',...(VERSION===12?['SMASH']:[])]);
 const references=[
  ['Bica2008','https://cdsarc.cds.unistra.fr/ftp/J/MNRAS/389/678/','Cluster, association, nebula and HI-shell identities, sky positions, apparent diameters and position angles.'],
  ['DEM1976','https://cdsarc.cds.unistra.fr/ftp/VII/232/','HII-region census; CDS-computed J2000 coordinates. Henize aliases retained.'],
  ['Glatt2010','https://cdsarc.cds.unistra.fr/ftp/J/A+A/517/A50/','Qualified cluster ages and integrated photometry. Missing ages remain flagged.'],
  ['DeMCELS_DR1','https://datalab.noirlab.edu/data/demcels','H-alpha-derived shell, knot and ridge geometry only. No raster appearance in the model.'],
  ['Pellegrini2012','https://cdsarc.cds.unistra.fr/ftp/J/ApJ/755/40/','Independent MCELS identity and position check using the erratum-corrected CDS table.'],
  ['Kim1999','https://doi.org/10.1086/301116','HI supershell candidate geometry via Bica table 6.'],
  ['Book2008','https://arxiv.org/abs/0710.5253','Physical-shell checks. Reject Kim SGS9,10,18; couple SGS12 and13.'],
  ['Fukui2008','https://cdsarc.cds.unistra.fr/ftp/J/ApJS/178/56/','NANTEN whole-LMC molecular cloud positions, sizes and mass.'],
  ['Wong2011','https://cdsarc.cds.unistra.fr/ftp/J/ApJS/197/16/','MAGMA targeted CO islands refine NANTEN parents, with parent mass conserved.'],
  ['Wong2013_erratum','https://doi.org/10.1088/0067-0049/208/1/13','Velocity-width correction, no change to spatial geometry used here.'],
  ['ChuKennicutt1994','https://doi.org/10.1086/174017','30 Dor hierarchical shells; central shell diameter about 30 pc.'],
  ['30Dor2023','https://academic.oup.com/mnras/article/520/4/5600/7043465','Observed 40–60 pc hemispherical bowl; adopt 50 pc. Bowl orientation and individual filament depths are assumptions.'],
  ['StaveleySmith2003','https://academic.oup.com/mnras/article/339/1/87/1048788','3.8e8 Msun HI disc mass at 50 kpc sets atomic/molecular dust-mixture prior.'],
 ];
 await Promise.all([
 writeJson(dir+'recipe.json',{schema:VERSION===12?'lmc-object-morphology-volume@1':'lmc-catalogue-volume@1',generator:'packages/bake/authoring/lmc-volume/catalogue-run.mts',generatorArguments:VERSION===12?['--version=12']:[],acceptedByOwner:false,geometry:scene.metadata,photoRole:VERSION===12?'Scalar shapes within individual catalogue footprints, object luminosities and component colors. No global photographic layer.':'Per-catalogue-object luminosity and per-component color calibration only; no pixel transfer.',smoothGeometryFrom:'l1–l3, with l10 adopted thicknesses',replayStages:['catalogue-ha.mts','catalogue-run.mts','record-manifest.mts']}),
 writeJson(dir+'fit.json',fit),writeJson(dir+'lineage.json',{inputProducts,hybridSources:VERSION===12?{objectShapes:'src/objects/lmc-volume/.local/versions/l12/object-shapes.json',populationMap:'src/objects/lmc-volume/.local/versions/l12/young-density.json',photoObservation:rec(scene.metadata.hybrid).photoObservation}:null,haAcquisition:{product:'DeMCELS DR1 continuum-subtracted H-alpha',route:'https://datalab.noirlab.edu/sia/demcels_dr1',workingRoot:'src/objects/lmc-volume/.local/versions/l11/inputs/ha/',sourceUrls:'SIA XML beside each FITS cutout; reused cutouts are recorded in versions/inputs/gas/index.json',generator:'packages/bake/authoring/lmc-volume/catalogue-ha.mts',qualifiedGeometry:'src/objects/lmc-volume/.local/versions/l11/ha-geometry.json'},references:[...array(rec(await json(base+'l3/lineage.json')).references).filter(v=>inherited.has(String(rec(v).id))).map(v=>rec(v).id==='Bell2022'?{...rec(v),role:'Global mean internal optical-depth budget. No Bell map supplies spatial appearance.'}:VERSION===12&&rec(v).id==='SMASH'?{...rec(v),role:'Blue-candidate counts and independent occupancy; normalized gap interpolation, warped 150 pc diffuse population. No photo structure in this component.'}:v),...references.map(([id,url,role])=>({id,url,role}))],discovery:'src/objects/lmc-volume/.local/versions/l11/discovery.md'}),
 copyFile(base+'l10/frame.json',dir+'frame.json'),writeJson(dir+'field.json',{generator:`packages/bake/authoring/lmc-volume/${VERSION===12?'hybrid-model':'catalogue-scene'}.mts`,workingGeometry:`src/objects/lmc-volume/.local/versions/l${VERSION}/structure.json`,...scene.metadata}),
 writeJson(dir+'provenance.json',{status:`Unaccepted l${VERSION} catalogue-structure prototype`,rungs:runs,sheet:`src/objects/lmc-volume/.local/versions/l${VERSION}/sheet.png`,fullFit:false,slabs:false,depthCaveat:scene.metadata.depthStatus})]);
}
function fitRecord(grade:Grade,owners:number,diagnostics:unknown){if(VERSION===14)return{grade,globalControls:diagnostics,objectBrightness:'src/objects/lmc-volume/.local/versions/l14/object-brightness.json',geometryOptimized:false,pixelParameters:0,catalogueObjectParameters:0,fixedCatalogueObjects:owners-1,populationRgbParameters:3,outskirtsGainParameters:1,existingDiscBarGainsRefitted:2};return{grade,components:{...componentSettings(grade),dust:{gain:grade.dustStrength,rgbTint:grade.dustTint,meaning:'Bell supplies one column normalization. NANTEN/MAGMA clouds and the smooth paper disc supply spatial attenuation.'}},objectBrightness:`src/objects/lmc-volume/.local/versions/l${VERSION}/object-brightness.json`,geometryOptimized:false,pixelParameters:0,catalogueObjectParameters:owners-(VERSION>=12?1:0),populationGainParameters:VERSION>=12?1:0,diagnostics};}
export async function main(){
 need(!process.argv.includes('--balance-check')||(VERSION===13&&process.argv.includes('--tiny-only')),'The rejected global-balance experiment is tiny-only.');
 await mkdir(OUT,{recursive:true});const began=performance.now(),scene=VERSION===14?await buildContinuousScene():VERSION===13?await buildGaiaScene():await buildCatalogueScene(await loadSources(512,20));if(VERSION<13){normalizeCatalogueDust(scene);const check=await checkMcels((await catalogueRows()).rows);scene.metadata.mcelsCheck={rows:check.rows,identityMatches:check.identityMatches,centresWithinCatalogueFootprint:check.centresWithinCatalogueFootprint};if(VERSION===12)await buildHybridScene(scene,await loadObservation(8));}
 await writeJson(OUT+'structure.json',{objects:scene.objects,dust:scene.dust,owners:scene.owners,metadata:scene.metadata});
 if(process.argv.includes('--records-only')){const result=rec(await json(OUT+'result.json'));await records(scene,array(await json(OUT+'rungs.json')),fitRecord(readGrade(result.grade),scene.owners.length,result.diagnostics));console.log(JSON.stringify({sentinel:`L${VERSION}_RECORDS_REFRESHED`,rendersOrFitsStarted:false}));return;}
 const geometry=JSON.stringify([scene.objects,scene.dust]),youngSnapshot=scene.youngDensity?.values.slice(),runs=[];let grade=readGrade(rec(await json(LOCAL+`versions/l${VERSION===14?13:VERSION===13?12:VERSION===12?11:10}/result.json`)).grade),amplitudes:Float64Array|undefined;
 for(const rung of ['tiny','small'] as const){
  const started=performance.now(),tiny=rung==='tiny',size=tiny?64:512,step=tiny?.12:.06,dir=tiny?OUT+'tiny/':OUT;await mkdir(dir,{recursive:true});
  const o=await loadObservation(tiny?1:8),camera=earthCamera(o.width,o.height,o.rayAt,o.pixelOf),target=sourceTarget(targetOf(o),o.metadata.normalization.commonFactor);
  console.log(JSON.stringify({sentinel:`L${VERSION}_PROJECTING_EARTH`,rung,objects:scene.objects.length,owners:scene.owners.length}));
  const projection=projectCatalogue(scene,camera,step);if(VERSION===13)await outerLightControl(scene,projection,camera,o,step,tiny);const previous=VERSION===14?rec(await json(LOCAL+`versions/l13/${tiny?'tiny/':''}result.json`)):null,priorAmplitudes=VERSION===14?Float64Array.from(array(await json(LOCAL+`versions/l13/${tiny?'tiny/':''}object-brightness.json`)).map((v,i)=>{const r=rec(v);need(r.id===scene.owners[i].id,'l13 owner order changed');return num(r.amplitude);})):null;const fit=VERSION===14&&previous&&priorAmplitudes?calibrateContinuous(projection,scene,target,readGrade(previous.grade),priorAmplitudes,o):calibrateObjects(projection,scene,target,grade,amplitudes);
  if(VERSION===13&&process.argv.includes('--balance-check')){const groups=new Uint8Array(o.width*o.height);for(let y=0;y<o.height;y++)for(let x=0;x<o.width;x++){const p=rayPlane(o.rayAt(x+.5,y+.5)),r=Math.hypot(p[0],p[1]);groups[y*o.width+x]=r<1?0:r<2?1:r<4?2:3;}const before=metrics(normalized(fit.prediction,o),targetOf(o),o),polish=balanceGaiaGrade(catalogueBasis(projection,scene,fit.amplitudes),fit.grade,target,groups),after=metrics(normalized(polish.prediction,o),targetOf(o),o),saved=rec(rec(await json(LOCAL+`versions/l12/${tiny?'tiny/':''}result.json`)).residuals),accepted=after.trainRelativeRms<=num(saved.trainRelativeRms)&&after.heldoutRelativeRms<=num(saved.heldoutRelativeRms)&&after.totalLightDifferencePercent>=-5&&after.totalLightDifferencePercent<=2&&typeof after.annularDifferencePercent[3]==='number'&&typeof before.annularDifferencePercent[3]==='number'&&Math.abs(after.annularDifferencePercent[3])<Math.abs(before.annularDifferencePercent[3]);await writeJson(dir+'global-balance.json',{accepted,beforeResiduals:before,candidateResiduals:after,candidateGrade:polish.grade,diagnostics:polish.diagnostics});if(accepted){fit.grade=polish.grade;fit.prediction=polish.prediction;}fit.diagnostics.globalBalance={accepted,...polish.diagnostics};}
  grade=fit.grade;amplitudes=fit.amplitudes;
  need(JSON.stringify([scene.objects,scene.dust])===geometry,'Calibration changed 3D geometry');
  if(youngSnapshot&&scene.youngDensity)need(Buffer.from(youngSnapshot.buffer).equals(Buffer.from(scene.youngDensity.values.buffer)),'Calibration changed the measured population map');
  const residuals=metrics(normalized(fit.prediction,o),targetOf(o),o);need(Number.isFinite(residuals.trainRelativeRms)&&residuals.trainRelativeRms<2,'Invalid catalogue pilot; do not scale');
  console.log(JSON.stringify({sentinel:`L${VERSION}_EARTH_READY`,rung,residuals,diagnostics:fit.diagnostics}));
  const views=[];for(const angle of [0,45,90]){const p=projectCatalogue(scene,outsideCamera(angle,size),step);views.push(gradedPrediction(catalogueBasis(p,scene,amplitudes),grade));if(VERSION>=12&&!tiny&&angle===0){const owner=scene.owners.findIndex(o=>o.id===scene.youngOwner),only={...p,smooth:{...p.smooth,planes:p.smooth.planes.map(v=>new Float64Array(v.length))},objects:[p.objects[owner]]},rgb=imageBytes(normalized(gradedPrediction(catalogueBasis(only,scene,amplitudes),grade),o),o,false);await sharp(rgb,{raw:{width:size,height:size,channels:3}}).png().toFile(dir+'diffuse-young-face.png');}console.log(JSON.stringify({sentinel:`L${VERSION}_OUTSIDE_READY`,rung,angle}));}
  await saveGradedSheet(dir,VERSION,o,fit.prediction,views,grade,VERSION===14?'Gaia population: 200 pc smoothing. One independent outskirts gain.':VERSION===13?'Frozen l12 objects; Gaia DR3 diffuse light in the same 150 pc layer.':VERSION===12?'Object-local shapes and SMASH diffuse light; adopted finite depths.':'Catalogue-object gains only; no pixel appearance parameters.');if(!tiny)await finishSheet(dir);
  const result={rung,size,stepKpc:step,seconds:(performance.now()-started)/1000,grade,residuals,diagnostics:fit.diagnostics,projection:projection.metadata,meaning:'Both checkerboards are appearance-calibration residuals. They are not held-out validation or a test of unknown individual depths.'};
  await writeJson(dir+'result.json',result);await writeJson(dir+'object-brightness.json',scene.owners.map((owner,i)=>({...owner,amplitude:amplitudes![i]})));runs.push(result);await writeJson(OUT+'rungs.json',runs);
  need((await sharp(dir+'sheet.png').metadata()).width===3*size,'Missing end-to-end sheet');console.log(JSON.stringify({sentinel:`L${VERSION}_RUNG_COMPLETE`,rung,seconds:result.seconds}));
  if(!tiny)await records(scene,runs,fitRecord(grade,scene.owners.length,fit.diagnostics));
  if(process.argv.includes('--tiny-only'))break;
 }
 console.log(JSON.stringify({sentinel:`L${VERSION}_ALL_REQUESTED_RUNGS_COMPLETE`,seconds:(performance.now()-began)/1000}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
