/** Short l10 report, exact preservation checks, and the requested comparison sheets. */
import {readFile,writeFile,stat} from 'node:fs/promises';
import sharp from 'sharp';
import {LOCAL,ROOT,json,rec,num,array,numbers,need} from './inputs.mts';
import {finishSheet} from './depth-run.mts';
const out=`${LOCAL}versions/l10/`,old=`${LOCAL}versions/l9/`,result=rec(await json(out+'result.json')),meta=rec(await json(out+'field.json')),m=rec(result.residuals),b8=rec(rec(await json(`${LOCAL}versions/l8/result.json`)).residuals),b9=rec(rec(await json(old+'result.json')).residuals),runs=array(await json(out+'rungs.json')).map(rec);
need((await stat(out+'integration-check.json')).mtimeMs>=(await stat(out+'field.json')).mtimeMs,'The final field has not been checked');
const names=[...Array.from({length:5},(_,k)=>`field-${k}.f32le`),...Array.from({length:2},(_,k)=>Array.from({length:3},(_,c)=>`cloud-${k}-${c}.f32le`)).flat()];
for(const name of names)need((await readFile(out+name)).equals(await readFile(old+name)),`l10 changed ${name}`);
need(JSON.stringify(await json(out+'regions.json'))===JSON.stringify(await json(old+'regions.json')),'l10 changed knot geometry');
need(meta.barNormalization===rec(await json(old+'field.json')).barNormalization,'l10 changed the bar');
need(JSON.stringify(result.grade)===JSON.stringify(rec(await json(old+'result.json')).grade),'l10 changed the l9 grade');
await writeFile(out+'preservation.json',JSON.stringify({unchangedFields:names,knotsUnchanged:true,barUnchanged:true,gradeUnchanged:true,onlyModelChange:'Adopted Gaussian layer sigmas: young and diffuse gas 150 pc; dust 250 pc.'},null,2)+'\n');
await finishSheet(out,10);need((await sharp(out+'sheet.png').metadata()).height===1668,'Incomplete sheet');
await sharp({create:{width:4608,height:1668,channels:3,background:'#101216'}}).composite(await Promise.all([8,9,10].map(async(v,i)=>({input:await readFile(`${LOCAL}versions/l${v}/sheet.png`),left:i*1536,top:0})))).png().toFile(out+'l8-l9-l10-side-by-side.png');
const row=(label:string,key:string,digits=4)=>`| ${label} | ${[b8,b9,m].map(r=>num(r[key]).toFixed(digits)).join(' | ')} |`;
const annuli=[b8,b9,m].map(r=>numbers(r.annularDifferencePercent));
const notes=`# l10: adopted disc widths

Only the vertical Gaussian sigmas changed: diffuse young stars and gas are 150 pc, and dust is 250 pc. These are adopted values, fixed by the owner. The old disc remains 410 pc. The l9 knots, bar ellipsoid, soft frame, component maps, dust columns and RGB grade are unchanged; all 11 saved fields match l9 byte for byte.

![l10 sheet](sheet.png)

| Source round-trip at 512 pixels | l8 | l9 | l10 |
| --- | --- | --- | --- |
${row('Calibration-pixel relative RGB RMS','trainRelativeRms')}
${row('Other checkerboard relative RGB RMS','heldoutRelativeRms')}
${row('Total light difference, %','totalLightDifferencePercent',2)}
${[0,1,2,3].map((k)=>`| Annulus ${['0–1','1–2','2–4','4+'][k]} kpc, % | ${annuli.map(a=>a[k].toFixed(2)).join(' | ')} |`).join('\n')}

The photo supplied both checkerboards; these are conversion residuals, not independent validation. Tiny took ${num(runs[0].seconds).toFixed(1)} seconds; 512 pixels took ${num(runs[1].seconds).toFixed(1)} seconds. The fixed grade is identical across l9 and l10 and across cameras.

Remaining issue: the 2–4 kpc annulus is ${Math.abs(annuli[2][2]).toFixed(2)}% too faint, and outer channel shares differ by up to ${Math.max(...numbers(array(m.channelShareDifferencePercentagePoints)[2]).map(Math.abs)).toFixed(2)} percentage points.
`;
await writeFile(out+'notes.md',notes);
const recipePath=`${ROOT}src/objects/lmc-volume/source/preparation/l10/recipe.json`,recipe=rec(await json(recipePath));await writeFile(recipePath,JSON.stringify({...recipe,generator:'packages/bake/authoring/lmc-volume/depth-run.mts',generatorArguments:['--version=10']},null,2)+'\n');
const path=`${ROOT}src/objects/lmc-volume/source/preparation/l10/provenance.json`,provenance=rec(await json(path));await writeFile(path,JSON.stringify({...provenance,report:'src/objects/lmc-volume/.local/versions/l10/notes.md',preservation:{fieldCount:names.length,knotsUnchanged:true,barUnchanged:true,gradeUnchanged:true},geometryCheck:{...rec(await json(out+'geometry-audit.json')),rows:undefined},integrationCheck:rec(await json(out+'integration-check.json'))},null,2)+'\n');
console.log(JSON.stringify({sentinel:'L10_REPORT_COMPLETE',residuals:m,fieldsPreserved:names.length}));
