/** Write the version-specific l9 report after the two rungs and physical checks. */
import {readFile,writeFile,stat} from 'node:fs/promises';
import sharp from 'sharp';
import {LOCAL,ROOT,json,rec,array,numbers,num,need} from './inputs.mts';
const out=`${LOCAL}versions/l9/`,result=rec(await json(out+'result.json')),meta=rec(await json(out+'field.json')),stats=rec(result.residuals),runs=array(await json(out+'rungs.json')).map(rec),regions=array(await json(out+'regions.json')).map(rec),audit=rec(await json(out+'geometry-audit.json')),integration=rec(await json(out+'integration-check.json')),prior=rec(rec(await json(`${LOCAL}versions/l8/result.json`)).residuals);
need((await stat(out+'integration-check.json')).mtimeMs>=(await stat(out+'field.json')).mtimeMs,'Integration check predates the final field');need((await sharp(out+'sheet.png').metadata()).height===1668,'The final comparison sheet is missing');
const group=(component:string)=>regions.filter(r=>r.component===component),median=(v:number[])=>v.sort((a,b)=>a-b)[Math.floor(v.length/2)],cloudRows=['young','gas'].map((c,i)=>{const a=group(c);return `| ${c==='young'?'Blue knots':'Pink gas regions'} | ${a.length} | ${(100*num(array(meta.cloudFractions)[i])).toFixed(1)}% | ${(1000*median(a.map(v=>num(v.skySigmaKpc)))).toFixed(0)} pc |`;}).join('\n');
const residualRows=[['Calibration-pixel linear RGB RMS','trainRelativeRms'],['Other checkerboard, same-source RMS','heldoutRelativeRms'],['Total light difference, percent','totalLightDifferencePercent']].map(([label,key])=>`| ${label} | ${num(prior[key]).toFixed(4)} | ${num(stats[key]).toFixed(4)} |`).join('\n');
const report=`# l9: finite bright regions and population depths

The compact blue and pink structures now have finite volumes. The bar is a triaxial Gaussian ellipsoid. The photo fades into the accepted old stellar disc over 64 source pixels, rather than 20. The same model and global display settings produce every angle.

![l9 comparison sheet](sheet.png)

## What changed

The l8 spectral split, distance, Choi plane, Oden warp, Rathore placement, Gordon law and Bell dust budget remain in use. The color-grading method remains global per component. No local appearance parameters are optimized.

A fixed watershed identifies compact structures in the blue and gas component images. Their flux, centre and width come directly from those images. Each has a compact quartic depth profile with shrinking cross sections; its line-of-sight RMS depth equals the geometric mean of its two principal on-sky RMS widths. This is the requested isotropy assumption, not a measured individual nebular distance. The region centres lie on the warped mid-plane.

Each region's light is subtracted from the diffuse component before its 3D replacement is added. A conservation guard checks that subtraction. The remaining diffuse blue light is smoothed by 180 pc in the plane, preserving its integral, so unresolved photo noise does not become tall columns. The compact light retains the source pixels. Fixed seed separations of five source pixels for blue knots and eight for pink gas group nearby subpeaks into complexes. These are global segmentation choices, not fitted sizes or a complete catalogue of independently identified clusters or nebulae. Width moments include finite pixel areas.

The 180 pc diffuse smoothing is a processing assumption. It does not come from a published thickness measurement. Each version has its own Earth-calibrated component grade; every camera within that version shares the same grade.

| Converted component | Image regions | Component light in compact volumes | Median one-axis sky RMS width |
| --- | --- | --- | --- |
${cloudRows}

The maximum source-level mismatch between measured sky and assigned depth RMS is ${num(audit.maxDepthRatioError).toExponential(2)}. The maximum centre-to-warp error is ${(1000*num(audit.maxMidplaneErrorKpc)).toExponential(2)} pc. Resampling the working fields introduces a small additional interpolation approximation.

## Depth definitions and disagreements

[Ripepi et al. 2022](https://arxiv.org/html/2203.01780), equation 9 and Table 6, supply the diffuse young-population profile: a sech-squared scale of 1.94 ± 0.02 kpc in residual sky Z. This corresponds to an exponential-tail scale of about 0.97 kpc, not a Gaussian sigma. Conversion to the adopted disc normal gives a sech-squared scale of 1.746 kpc and RMS width of 1.583 kpc. The measured ensemble includes distance errors and non-planar substructure. Applying it to diffuse blue light is an explicit tracer-based depth prior; it is not a measured thickness of newborn knots.

[Kacharov et al. 2024](https://arxiv.org/html/2410.05374), section 5.2, constrain the bar's vertical-to-major axis ratio only from above, at about 0.35. l9 adopts that upper value, giving a vertical Gaussian sigma of 367 pc, while keeping its accepted planar shape and Rathore placement. A precise bar thickness is not measured by this source.

The global vertical bar displacement remains zero. [OGLE Cepheids](https://arxiv.org/html/1602.09141) do not establish a significant displacement. Ripepi's distinct eastern and western bar depths do not imply a single offset for the whole bar. The older [red-clump estimate](https://doi.org/10.1051/0004-6361/200811029) gives a much larger line-of-sight dispersion, 4.0 ± 1.4 kpc. It conflicts with the adopted equilibrium ellipsoid and is recorded rather than silently combined with it.

## Frame and outskirts

A wide smooth overlap replaces the photographic boundary with the paper stellar profile. Non-converged or ambiguous warp-projection branches blend to that same profile instead of duplicating faint photo material. The measured warp itself remains present. The final exterior contains old stars only, as in l8; young light, gas and dust outside the photo are unsupported.

The first l9 pass also extrapolated the boundary blue population. That made the faint exterior too bright and was rejected. Its sheet and residuals are retained in round1/. The final candidate removes that extrapolation. No exterior brightness was painted by region.

## Earth-view source round-trip

| Residual | l8 | l9 |
| --- | --- | --- |
${residualRows}

| l9 annulus | Light difference |
| --- | --- |
${numbers(stats.annularDifferencePercent).map((v,i)=>`| ${['0–1','1–2','2–4','4+'][i]} kpc | ${v.toFixed(2)}% |`).join('\n')}

Channel-share errors in red, green and blue percentage points:

${array(stats.channelShareDifferencePercentagePoints).map((v,i)=>`- ${['Inner 1.5 kpc','1.5–4 kpc','Outer region'][i]}: ${numbers(v).map(n=>n.toFixed(2)).join(', ')}.`).join('\n')}

Both checkerboards contributed source pixels. These residuals measure conversion, projection and grading; they do not validate the inferred depths independently. Earth-view fidelity is worse than l8 after the depth and bar changes. The faint outer profile remains a limitation. This is a model pilot, not a qualified slab bake.

The final face-on view has a softer photographic boundary and the earlier faint projection streaks are reduced. The oblique views still have an unsatisfactory broad blue envelope. At the 16 kpc display scale, the measured compact-region widths still make a narrow bright band edge-on. Finite cloud depths and a three-dimensional bar are present, but this has not yet achieved a balanced outside appearance. The observed Cepheid ensemble spread is not a secure intrinsic thickness for all blue light; that tracer mismatch remains unresolved.

## Survey checks and verification

The l8 [survey checks](../l8/checks.md) still apply to the color classification because the spectral split and its input pixels are unchanged. They are reused with that limited claim. They do not validate the new 3D placement. Bell still supplies the same positive column budget; one fixed global correction compensates for the wider footprint fade. The available RGB data cannot uniquely determine ages, metal-line contributions or dust.

The exact reference integrator was checked on a 48-pixel crop containing the brightest gas region. Reducing its step from 12 to 6 pc changed total light by ${(100*num(integration.totalLightDifference)).toFixed(6)}% and RGB RMS by ${(100*num(integration.relativeRgbRms)).toFixed(4)}%. No grading changed between those integration samples.

| Final rung | Width | Duration |
| --- | --- | --- |
${runs.map(r=>`| ${String(r.rung)} | ${num(r.size)} px | ${num(r.seconds).toFixed(1)} seconds |`).join('\n')}

Thirty-six targeted behavior tests, strict TypeScript and ten deletion checks pass. The deletion checks defend the Cepheid profile and coordinate conversion, finite cloud support, equal sky/depth widths, bar shape, wider blend, Bell normalization, conserved compact light and actual cloud emission through the renderer. All final views were inspected. No GPU training, full-resolution multi-start fit, slabs, shared-package edits, commit or publication occurred.

Photo: NOIRLab/NSF/AURA/P. Horálek (Institute of Physics in Opava), [source](https://noirlab.edu/public/images/iotw2547a/), CC BY 4.0. Outside comparison: ESO, [NGC 4027](https://www.eso.org/public/images/potw1030a/). The comparison has different filters, processing and scale; it is not another measured LMC viewpoint.
`;
await writeFile(out+'notes.md',report);
await sharp({create:{width:3072,height:1668,channels:3,background:'#101216'}}).composite([{input:await readFile(`${LOCAL}versions/l8/sheet.png`),left:0,top:0},{input:await readFile(out+'sheet.png'),left:1536,top:0}]).png().toFile(out+'l8-l9-side-by-side.png');
const source=`${ROOT}src/objects/lmc-volume/source/preparation/l9/`,provenance=rec(await json(source+'provenance.json'));await writeFile(source+'provenance.json',JSON.stringify({...provenance,report:'src/objects/lmc-volume/.local/versions/l9/notes.md',geometryCheck:{...audit,rows:undefined},integration,surveyChecks:'Reused l8 split checks; unchanged input and classification, no claim about depth.',visualQualification:'Finite compact volumes and an ellipsoidal bar are present. A narrow bright band and broad blue envelope still give an unsatisfactory outside appearance. Earth fidelity has regressed; not qualified for baking.'},null,2)+'\n');
console.log(JSON.stringify({sentinel:'L9_REPORT_COMPLETE',stats,regions:regions.length}));
