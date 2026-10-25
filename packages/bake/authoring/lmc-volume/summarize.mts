/** Final, plain-English account of the actual saved rungs. Never starts a render or fit. */
import {writeFile,appendFile,readFile,stat} from 'node:fs/promises';
import sharp from 'sharp';
import {json,rec,num,numbers,array,LOCAL,need} from './inputs.mts';
import {writeNotes} from './report.mts';
import {discSurface,exponentialSurface,HEIGHT_DISC} from './model.mts';
import type {Fit} from './render.mts';
const out=`${LOCAL}versions/`,labels=['Stellar disc','Offset bar','Outer warp','Stellar outskirts','Young populations','Dust','Ionized gas'];
const changes=[
  'The baseline uses the published Gaussian disc, the binary distance, and the Choi plane.',
  'The Gaussian bar is added with the Rathore angle and offset. Its direction is digitized from Figure 8 and its absolute center uses the Fourier-center proxy, so the precision is about 0.1 kpc rather than the tabulated scalar-offset error.',
  'The mean-distance warp is added beyond 4.5 kpc. The input is the qualified Oden TAN cache; missing outer coverage is continued as the plane, not claimed to be measured flat.',
  'The outer count profile is continued inward until it meets the Gaussian. The continuation is assumed. It adds only light missing from the Gaussian, and its gain is tied to the old-disc exposure.',
  'Regional VMC age budgets and fixed SMASH blue counts redistribute a young population. Survey-gap striping was corrected at the source-coverage layer. There are no image-fitted local values.',
  'The internal dust fit preferred zero in coarse and refined searches. That erases measured dust, so the candidate was rejected and the preceding model was retained. Those failed attempts precede the final distance-anchor correction; the skipped component was not fitted again. Zero here is not a scientific finding of no LMC dust.',
  'The DeMCELS Hα pilot was rejected by the existing shared FITS reader because EQUINOX is duplicated. The gas component was skipped, and the last retained model was rendered at both rungs.'
];
const rows=[];
for(let version=1;version<=7;version++){
  const dir=`${out}l${version}`,tiny=rec(await json(`${dir}/tiny/result.json`)),small=rec(await json(`${dir}/small/result.json`)),r=rec(small.residuals),f=rec(small.fit);
  if(version===6)need(small.skippedDust===true,'Update the report: dust was not skipped in this run');
  const fit:Fit={gains:numbers(f.gains,5),red:num(f.red),blue:num(f.blue),dust:num(f.dust),loss:num(f.loss),iterations:num(f.iterations)};
  const nullable=(v:unknown)=>v===null?null:num(v);
  const metrics={trainRelativeRms:num(r.trainRelativeRms),heldoutRelativeRms:num(r.heldoutRelativeRms),totalLightDifferencePercent:num(r.totalLightDifferencePercent),annularDifferencePercent:array(r.annularDifferencePercent).map(nullable),channelShareDifferencePercentagePoints:array(r.channelShareDifferencePercentagePoints).map(v=>array(v).map(nullable))};
  const status=version>=6?'The component failed qualification and was skipped. The previous model is retained.':'Both pilot rungs completed. This is not final scientific or visual acceptance.';
  const limitations=[changes[version-1]];
  if(version>=5)limitations.push('The source spectra use BC03, Z=0.008, and a Chabrier initial mass function as a fixed color proxy. This differs from the VMC synthesis and is not a claim to reproduce that library.');
  if(version===5)limitations.push('A broad northern extension is visible, but a clear, continuous northern spiral arm is not reproduced. The selected young bins span 15.8–251 million years; intermediate-age regional contrast is still in the smooth parent. This is a model-coverage limitation, not evidence that the arm is absent. It was not fitted to the photograph.');
  await writeNotes(dir,version,labels[version-1],status,tiny,small,metrics,fit,limitations);
  if(version===1){
    const profile=[0,2,4,6,8].map(r=>`| ${r} | ${discSurface(r).toExponential(3)} | ${exponentialSurface(r).toExponential(3)} | ${(discSurface(r)/exponentialSurface(r)).toFixed(3)} |`).join('\n');
    await appendFile(`${dir}/notes.md`,`\n## Gaussian versus exponential\n\nAt equal total light, the Gaussian has a flatter center and a steeper outer decline than [van der Marel's exponential](https://arxiv.org/abs/astro-ph/0105340). The comparison uses a representative exponential scale length of 1.4 kpc from the published 1.3–1.5 kpc range. The accepted Gaussian was not changed.\n\n| Radius, kpc | Gaussian | Exponential | Ratio |\n| --- | --- | --- | --- |\n${profile}\n`);
  }
  if(version===5){
    const cepheidSigma=Math.PI/Math.sqrt(12)*1.94,proxySigma=Math.hypot(HEIGHT_DISC,Math.cos(25.86*Math.PI/180));
    await appendFile(`${dir}/notes.md`,`\n## Thickness check\n\nThe adopted Gaussian vertical width is ${HEIGHT_DISC.toFixed(3)} kpc. [Ripepi's](https://arxiv.org/html/2203.01780) 1.94 kpc sech² parameter corresponds to a standard deviation of ${cepheidSigma.toFixed(2)} kpc. Adding a representative 1 kpc distance error to the model gives about ${proxySigma.toFixed(2)} kpc normal scatter. This simple comparison is narrower than the Cepheid result; it does not reproduce the paper's full selection, correlated errors, or warp treatment. Shared young/old height remains an unresolved assumption, not a passed thickness measurement.\n`);
  }
  if(version===7)await appendFile(`${dir}/notes.md`,'\nThe file and exact duplicate cards are recorded in [the separate FITS proposal](../../FITS-PROPOSAL.md). No shared package or original header was changed.\n');
  const sheet=await sharp(`${dir}/sheet.png`).metadata();need(sheet.width===768&&sheet.height===670,`Missing or invalid l${version} sheet`);
  for(const [name,rung]of [['tiny',tiny],['small',small]] as const){
    const field=rec(rung.field),metadata=await sharp(`${dir}/${name}/sheet.png`).metadata();need(metadata.width===768&&metadata.height===670,`Missing ${name} sheet`);
    need((await stat(`${dir}/${name}/field.f32`)).size===num(field.bytes),`Truncated l${version} ${name} field`);
  }
  rows.push({version,tinySeconds:num(tiny.seconds),smallSeconds:num(small.seconds),...metrics,status:version>=6?'Skipped':'Pilot built'});
}
const retainedEarth=await readFile(`${out}l5/earth.png`);
for(const version of [6,7])need(retainedEarth.equals(await readFile(`${out}l${version}/earth.png`)),`Skipped l${version} changed the retained Earth image`);
const total=rows.reduce((sum,r)=>sum+r.tinySeconds+r.smallSeconds,0),improvement=100*(1-rows[4].heldoutRelativeRms/rows[0].heldoutRelativeRms);
await writeFile(`${out}REPORT.md`,`# LMC tiny and small model sequence\n\nAll seven comparison sheets are saved. l1–l5 were built; l6 and l7 failed their respective qualification checks and retain l5. No full-resolution fitting, GPU training, slab bake, standalone viewer, publication, or commit ran.\n\n![All versions side by side](all-versions.png)\n\n| Version | Addition | Tiny time | Small time | Held-out relative RMS | Total light difference | Result |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.map((r,i)=>`| [l${r.version}](l${r.version}/sheet.png) | ${labels[i]} | ${r.tinySeconds.toFixed(2)} s | ${r.smallSeconds.toFixed(2)} s | ${r.heldoutRelativeRms.toFixed(4)} | ${r.totalLightDifferencePercent.toFixed(2)}% | ${r.status} |`).join('\n')}\n\nThe saved final rungs total ${total.toFixed(1)} seconds; correction attempts are additional and retained in the run logs. Computation ran locally on the CPU, with the same code at 64-pixel tiny and 256-pixel small resolution. Held-out relative RMS improves by ${improvement.toFixed(1)}% from l1 to l5. The match remains too soft and misses much of the photograph's fine structure. These numbers are appearance residuals, not physical-flux accuracy or bake qualification.\n\n## What changed and what failed\n\n${changes.map((s,i)=>`${i+1}. **l${i+1}:** ${s}`).join('\n')}\n\nThe Gaussian/exponential comparison is in l1's notes. l5 shows a broad northern extension rather than a clearly recovered spiral arm; no arm was fitted to the photograph. Its shared young/old thickness remains uncertain against the Cepheid distribution.\n\nTwo source-handling defects were fixed within the allowed rounds: the photo was driving an unconstrained outskirts gain, and survey gaps were cutting stripes into the population field. A second outskirts correction removed an artificial inner hole. Behavior tests failed before those corrections and pass afterward. The outer continuation, source-gap interpolation, and approximate bar center remain explicit model assumptions.\n\nInternal dust has not been successfully incorporated. The rejected zero-scale fits remain in l6's rung folders. Gas is skipped because the downloaded DeMCELS file repeats the exact EQUINOX card; [the separate proposal](../FITS-PROPOSAL.md) records both cards. The shared FITS package is unchanged.\n\n## Files and verification\n\nEach version has a sheet, individual views, tiny and small results, a sampled three-dimensional diagnostic field, and plain-English notes. Its 40 kpc surroundings image uses an explicitly labeled thirty-fold exposure solely to reveal faint support; the main sheets share one brightness calibration across views.\n\nStrict TypeScript owns the model, source adapters, global calibration, and reference renderer. Version records are under the object's source/preparation directory. Existing input caches and compact registered source images are required; cache-free reproducibility and production delivery have not been qualified. The pre-existing volume-manifest schema is preserved rather than migrated. No real-site acceptance is claimed at this physical-model stage.\n\nStop here for image review. Full-resolution work remains unstarted.\n`);
console.log(JSON.stringify({sentinel:'LMC_IMAGE_REPORT_VERIFIED',versions:rows.length,overview:`${out}all-versions.png`,improvementPercent:improvement}));
