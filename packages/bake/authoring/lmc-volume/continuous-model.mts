/** l14 retains l13 geometry and adds only population smoothing and an outskirts light control. */
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {LOCAL,json,rec,num,need} from './inputs.mts';
import {loadFrozenL12} from './frozen-l12.mts';
import {makeGaiaDensity} from './gaia-density.mts';
export const L14=LOCAL+'versions/l14/';
export const CONTINUOUS_SETTINGS={smoothingSigmaKpc:.2,youngSigmaKpc:.15,youngRgbFactorBounds:[.25,4],discBarGainBounds:[.5,1.5],outskirtsGainBounds:[.5,4],outskirtsTransitionKpc:[3,5]} as const;
export async function buildContinuousScene(){
 await mkdir(L14,{recursive:true});
 const scene=await loadFrozenL12(),prior=rec(await json(LOCAL+'versions/l13/preservation.json'));
 need(prior.catalogueGeometryMatchesL12===true&&prior.dustGeometryMatchesL12===true&&num(prior.objects)===scene.objects.length,'Cannot establish l13 geometry preservation');
 const population=await makeGaiaDensity(scene.sources,{directory:L14,sigmaKpc:CONTINUOUS_SETTINGS.smoothingSigmaKpc}),owner=scene.owners.find(o=>o.kind==='population');need(owner,'Missing Gaia population');owner.id='Gaia-diffuse-young';owner.aliases=['Gaia DR3 Young 1 + Young 2'];scene.youngOwner=owner.id;scene.youngDensity=population.map;scene.youngTint=[1,1,1];scene.outskirtsGain=1;scene.innerDiscGain=1;scene.barGain=1;scene.separateOutskirts=true;scene.outskirtsTransitionKpc=CONTINUOUS_SETTINGS.outskirtsTransitionKpc;
 scene.metadata={...scene.metadata,geometrySource:'Frozen l13 catalogue objects, old disc, bar, warp, dust and heights.',hybrid:{...rec(scene.metadata.hybrid),youngPopulation:population.metadata},continuousPopulation:{...CONTINUOUS_SETTINGS,smoothingStatus:'Adopted Gaussian sigma, increased from l13 150 pc to 200 pc. It averages associations into a continuous population while retaining kiloparsec arms.',outskirtsDefinition:'The existing old-disc light is partitioned with smoothstep from 3 to 5 kpc. The faint partition plus the existing halo has one global gain. At gain one, their sum is exactly the old l13 profile. This partition is adopted, not a measured edge.',calibration:'Independent global RGB factors for the diffuse Gaia population and one outskirts gain. Existing old-disc and bar gains may rebalance between 0.5 and 1.5. All l13 object luminosities, component color tints, tone curve and dust settings remain fixed.'}};
 await copyFile(LOCAL+'versions/l13/object-shapes.json',L14+'object-shapes.json');
 await writeFile(L14+'preservation.json',JSON.stringify({catalogueGeometryMatchesL13:true,dustGeometryMatchesL13:true,objects:scene.objects.length,dustClouds:scene.dust.length,catalogueOwners:scene.owners.length-1,unchanged:'Positions, finite object shapes, warp, old-disc and bar profiles, dust columns and all population heights.',changes:'Gaia smoothing sigma 200 pc, independent diffuse-population RGB grading, and one outskirts luminosity gain.'},null,2)+'\n');return scene;
}
