import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { json, readNativeRun, readBrowserRun, compareTrajectories, summarizeMotion,
  bindInputReceipts, verifyProvenance, assertRegisteredProjection, compareFrameBoundMotion,
} from './interaction-suite-analysis.mts';

const root=resolve(import.meta.dirname,'../../../../..');
const manifestPath=resolve(process.argv[2]), manifest=await json(manifestPath),out=dirname(manifestPath);
const calibrationRoot=resolve(manifest.configuration.evidenceRoot??root,'.local/oracles/google-earth-pro/calibration');
const results=[];
for(const entry of manifest.cases){
  const result={id:entry.id,set:entry.set,status:'invalid',errors:[],repeats:[]};
  try{
    const run=entry.runs[0];
    if(!run?.native||!run.browser||!run.comparison||!run.frameBound)throw Error(run?.error??'Native, natural-clock and frame-bound evidence are required');
    const native=await readNativeRun(run.native), browser=await readBrowserRun(run.browser);
    assertRegisteredProjection(native,browser.report);
    const controlledBrowser=await json(run.frameBound.browser);
    const controlled=compareFrameBoundMotion(native,controlledBrowser);
    const artifactRoot=resolve(out,entry.id);await mkdir(artifactRoot,{recursive:true});
    const provenance={natural:await verifyProvenance(run.native,run.browser,calibrationRoot),
      controlled:await verifyProvenance(run.native,run.frameBound.browser,calibrationRoot)};
    result.provenance=resolve(artifactRoot,'provenance.json');
    await writeFile(result.provenance,JSON.stringify(provenance,null,2));
    result.sourceNativeReport=run.native;
    result.nativeReport=resolve(artifactRoot,'native-report.json');
    await copyFile(run.native,result.nativeReport);
    result.browserReport=run.browser;
    result.controlledBrowserReport=run.frameBound.browser;
    result.native=summarizeMotion(native);result.browser=summarizeMotion(browser);
    result.natural=compareTrajectories(native.frames,browser.frames);
    result.controlled=controlled;
    result.inputReceipts=bindInputReceipts(native,browser);
    result.maximumBrowserInputDelayMilliseconds=Math.max(...result.inputReceipts.map(e=>e.browserDeliveryDelayMilliseconds));
    result.projection={nativeInputFocalLength:native.focalLength,
      browserInputFocalLength:browser.focalLength,browserRenderFocalLength:browser.report.state.trackball.renderFocalLength,
      qualification:'Input rays use the native horizontal field of view. Scene pixels use each object’s prepared projection.'};
    result.nativeInstrumentationMilliseconds=native.maximumInstrumentationMilliseconds;
    const visual=await json(run.frameBound.comparison),naturalVisual=await json(run.comparison);
    result.video=visual.video;result.naturalVideo=naturalVisual.video;
    result.poster=resolve(dirname(run.frameBound.comparison),'triptych/frame_000000.png');
    result.finalFrame=resolve(dirname(run.frameBound.comparison),`triptych/frame_${String(visual.rows.length-1).padStart(6,'0')}.png`);
    result.pixels={initial:visual.initialMeanAbsoluteRgb,worst:visual.worstMeanAbsoluteRgb,
      final:visual.rows.at(-1).meanAbsoluteRgb,maximumProjectedCenterErrorPixels:visual.maximumProjectedCenterErrorPixels};
    for(const repeatRun of entry.runs.slice(1)){
      if(!repeatRun.native)throw Error('Native repeat is missing');
      const repeat=await readNativeRun(repeatRun.native);
      const proof=await verifyProvenance(repeatRun.native,null,calibrationRoot);
      const path=resolve(artifactRoot,`repeat-${repeatRun.repeat+1}-provenance.json`);
      await writeFile(path,JSON.stringify(proof,null,2));
      const firstPress=value=>value.inputs.find(e=>e.kind==='down').time;
      const {rows,...spread}=compareTrajectories(native.frames,repeat.frames,
        {referenceOffset:firstPress(native),candidateOffset:firstPress(repeat)});
      result.repeats.push({repeat:repeatRun.repeat+1,...spread,provenance:path,
        qualification:'Observed native repeat spread with first press aligned; later input times are unchanged'});
    }
    result.status='measured';
  }catch(error){result.errors.push(error.message)}
  results.push(result);
}
const report={schema:'cssearth-oracle-interaction-report@2',generatedAt:new Date().toISOString(),manifest:manifestPath,
  coverage:{planned:manifest.configuration.cases.length,measured:results.filter(r=>r.status==='measured').length,
    invalid:results.filter(r=>r.status==='invalid').length,nativeRepeatComparisons:results.reduce((n,r)=>n+r.repeats.length,0)},
  qualification:'Measured interaction agreement with verified input receipts, frame identity and texture bytes. Complete parity is not established.',
  limits:['Controlled replay uses native frame intervals and consumed input, without replaying camera poses. It does not prove physical presentation timing.',
    'Natural-clock replay retains measured Chrome delivery delay. Native synchronous pixel readback changes frame cost.',
    'RGB differences include the prepared scene representation. Camera rotation, apparent size and projected center are measured separately.',
    'Mars provides the native calibration surface. Shared behavior on other objects is checked by the application browser suite.',
    'A completed scenario is evidence coverage, not an automatic parity pass. Remaining differences appear in the measurements.'],
  validation:manifest.validation??null,results};
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
await writeFile(resolve(out,'index.html'),html(report));
await writeFile(resolve(out,'RESULT.md'),markdown(report));
console.log(JSON.stringify({coverage:report.coverage,report:resolve(out,'index.html')}));
if(report.coverage.invalid)process.exitCode=1;
function link(path){return relative(out,path).split('/').map(encodeURIComponent).join('/')}
function escape(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')}
function number(value,digits=3){return Number.isFinite(value)?value.toFixed(digits):'—'}
function name(id){return id.replace(/^(training|heldout|regression)-/,'').replaceAll('-',' ')}
function html(r){return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Earth interaction comparison</title><link rel="icon" href="data:,"><style>
*{box-sizing:border-box}body{margin:0;background:#10141b;color:#e9edf5;font:16px/1.5 system-ui}main{max-width:1320px;margin:auto;padding:42px 24px}h1{font-size:42px;letter-spacing:-1px;line-height:1.15}h2{font-size:24px;margin:4px 0}p{max-width:1000px;color:#b6c2d4}.tag{color:#7ed8cf;font-size:12px;text-transform:uppercase;letter-spacing:1.4px}.overview{display:flex;gap:40px;margin:28px 0}.overview b{display:block;font-size:32px}.overview span,.metrics span{display:block;color:#a5b4c9;font-size:13px}section{border:1px solid #334052;border-radius:12px;padding:23px;margin:26px 0;background:#171d27}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin:24px 0}.metrics b{font-size:27px}video{display:block;width:100%;background:#000}summary{cursor:pointer;color:#b8d7e9;padding:16px 0}a{color:#89ddd6}.links{display:flex;gap:22px;flex-wrap:wrap}details p{font-size:14px}.invalid{color:#ffab99}nav{position:sticky;top:0;padding:15px 0;background:#10141b;z-index:1;display:flex;gap:10px}button{cursor:pointer;background:transparent;border:1px solid #55627a;border-radius:20px;color:#e9edf5;padding:8px 15px}button[aria-pressed=true]{background:#c9eae6;color:#192c2c}section[hidden]{display:none}footer{font-size:13px;margin-top:40px}@media(max-width:700px){main{padding:25px 12px}h1{font-size:33px}.metrics{grid-template-columns:1fr 1fr}section{padding:15px}.overview{gap:20px}}</style><main>
<div class="tag">cssEarth · Google Earth Pro reference</div><h1>See how the interactions match</h1><p>The same recorded gestures drive both applications. Controlled replay compares matching native frame steps; natural-speed replay separately shows timing differences.</p>
<div class="overview"><div><b>${r.coverage.measured}/${r.coverage.planned}</b><span>Scenarios measured</span></div><div><b>${r.coverage.nativeRepeatComparisons}</b><span>Native repeat comparisons</span></div><div><b>${r.coverage.invalid}</b><span>Invalid comparisons</span></div></div>
<p>${escape(r.qualification)} Videos show native | browser | absolute RGB difference ×4.</p><nav>${['all','training','heldout','regression'].map((s,i)=>`<button data-filter="${s}" aria-pressed="${i===0}">${s==='heldout'?'Held out':s}</button>`).join('')}</nav>
${r.results.map(c=>`<section data-set="${c.set}"><div class="tag">${c.set}</div><h2>${escape(name(c.id))}</h2>${c.errors.length?`<p class="invalid">INVALID: ${c.errors.map(escape).join('; ')}</p>`:`
<div class="metrics"><div><b>${number(c.controlled.maximumRotationErrorDegrees)}°</b><span>Largest rotation difference</span></div><div><b>${number(c.controlled.finalRotationErrorDegrees)}°</b><span>Final rotation difference</span></div><div><b>${number(c.controlled.maximumRelativeRadiusError*100,2)}%</b><span>Largest apparent size difference</span></div><div><b>${number(c.pixels.maximumProjectedCenterErrorPixels,2)} px</b><span>Largest center difference</span></div></div>
<video controls preload="none" poster="${link(c.poster)}" src="${link(c.video)}"></video><details><summary>Natural-speed replay and evidence</summary><video controls preload="none" src="${link(c.naturalVideo)}"></video><p>Natural-clock endpoint rotation difference: ${number(c.natural.finalRotationErrorDegrees)}°. Largest measured Chrome input delay: ${number(c.maximumBrowserInputDelayMilliseconds,1)} ms. These values retain recorder timing effects.</p><p>Input focal length: native ${number(c.projection.nativeInputFocalLength,2)} px; browser ${number(c.projection.browserInputFocalLength,2)} px. Prepared rendering focal length: ${number(c.projection.browserRenderFocalLength,2)} px.</p>${c.repeats.map(repeat=>`<p>Native repeat ${repeat.repeat}: endpoint spread ${number(repeat.finalRotationErrorDegrees)}°; largest trajectory spread ${number(repeat.maximumRotationErrorDegrees)}°.</p>`).join('')}<p class="links"><a href="${link(c.nativeReport)}">Native capture</a><a href="${link(c.controlledBrowserReport)}">Controlled Chrome capture</a><a href="${link(c.browserReport)}">Natural Chrome capture</a><a href="${link(c.provenance)}">Verified bytes</a><a href="${link(c.finalFrame)}">Final comparison image</a></p></details>`}</section>`).join('')}
${r.validation?`<p>${escape(r.validation.summary)} <a href="${link(r.validation.report)}">Validation record</a></p>`:''}<footer><a href="report.json">All measurements</a> · <a href="suite.json">Run configuration</a><p>${r.limits.map(escape).join('<br>')}</p>Generated ${escape(r.generatedAt)}</footer></main><script>for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{for(const x of document.querySelectorAll('[data-filter]'))x.setAttribute('aria-pressed',String(x===b));for(const s of document.querySelectorAll('section'))s.hidden=b.dataset.filter!=='all'&&s.dataset.set!==b.dataset.filter}</script></html>`}
function markdown(r){return `Google Earth interaction comparison\n\n${r.coverage.measured}/${r.coverage.planned} scenarios measured; ${r.coverage.invalid} invalid.\n\n${r.qualification}\n\n[Visual report](${resolve(out,'index.html')})\n\n| Scenario | Maximum rotation difference | Final rotation difference | Maximum size difference |\n| --- | ---: | ---: | ---: |\n${r.results.map(c=>`| ${name(c.id)} | ${number(c.controlled?.maximumRotationErrorDegrees)}° | ${number(c.controlled?.finalRotationErrorDegrees)}° | ${number(c.controlled?.maximumRelativeRadiusError*100,2)}% |`).join('\n')}\n\n${r.limits.map(l=>'- '+l).join('\n')}\n`}

