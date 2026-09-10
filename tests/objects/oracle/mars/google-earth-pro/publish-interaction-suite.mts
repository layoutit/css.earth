import assert from 'node:assert/strict';
import { parseSuiteManifest, type SuiteCase } from './interaction-suite-manifest.mts';
import { object, array, finite, text } from './oracle-values.mts';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { json, readNativeRun, readBrowserRun, compareTrajectories, summarizeMotion,
  bindInputReceipts, verifyProvenance, assertRegisteredProjection, compareFrameBoundMotion,
} from './interaction-suite-analysis.mts';

const root=resolve(import.meta.dirname,'../../../../..');
const manifestPath=resolve(process.argv[2]), manifest=parseSuiteManifest(await json(manifestPath)),out=dirname(manifestPath);
const calibrationRoot=resolve(manifest.configuration.evidenceRoot??root,'.local/oracles/google-earth-pro/calibration');
type RepeatResult = Omit<ReturnType<typeof compareTrajectories>, 'rows'> & { repeat: number; provenance: string; qualification: string };
interface InvalidCase { id: string; set: string; status: 'invalid'; errors: string[]; repeats: RepeatResult[] }
type CaseResult = Awaited<ReturnType<typeof measureCase>> | InvalidCase;
const results: CaseResult[] = [];
for (const entry of manifest.cases) {
  try { results.push(await measureCase(entry)); }
  catch (error) { results.push({ id: entry.id, set: entry.set, status: 'invalid', errors: [error instanceof Error ? error.message : String(error)], repeats: [] }); }
}
async function measureCase(entry: SuiteCase) {
  const repeats: RepeatResult[] = [];
    const run=entry.runs[0];
    if(!run?.native||!run.browser||!run.comparison||!run.frameBound)throw Error(run?.error??'Native, natural-clock and frame-bound evidence are required');
    const native=await readNativeRun(run.native), browser=await readBrowserRun(run.browser);
    assertRegisteredProjection(native,browser.report);
    const controlledBrowser=await json(run.frameBound.browser);
    const controlled=compareFrameBoundMotion(native,controlledBrowser);
    const artifactRoot=resolve(out,entry.id);await mkdir(artifactRoot,{recursive:true});
    const provenanceEvidence={natural:await verifyProvenance(run.native,run.browser,calibrationRoot),
      controlled:await verifyProvenance(run.native,run.frameBound.browser,calibrationRoot)};
    const provenance=resolve(artifactRoot,'provenance.json');
    await writeFile(provenance,JSON.stringify(provenanceEvidence,null,2));
    const sourceNativeReport=run.native;
    const nativeReport=resolve(artifactRoot,'native-report.json');
    await copyFile(run.native,nativeReport);
    const browserReport=run.browser;
    const controlledBrowserReport=run.frameBound.browser;
    const nativeSummary=summarizeMotion(native), browserSummary=summarizeMotion(browser);
    const natural=compareTrajectories(native.frames,browser.frames);
    const inputReceipts=bindInputReceipts(native,browser);
    const maximumBrowserInputDelayMilliseconds=Math.max(...inputReceipts.map(e=>e.browserDeliveryDelayMilliseconds));
    const projection={nativeInputFocalLength:native.focalLength,
      browserInputFocalLength:browser.focalLength,browserRenderFocalLength:browser.report.state.trackball.renderFocalLength,
      qualification:'Input rays use the native horizontal field of view. Scene pixels use each object’s prepared projection.'};
    const nativeInstrumentationMilliseconds=native.maximumInstrumentationMilliseconds;
    const visual=parseVisualReport(await json(run.frameBound.comparison)),naturalVisual=await json(run.comparison);
    const video=visual.video;const naturalVideo=text(naturalVisual.video, "natural video");
    const poster=resolve(dirname(run.frameBound.comparison),'triptych/frame_000000.png');
    const finalFrame=resolve(dirname(run.frameBound.comparison),`triptych/frame_${String(visual.rows.length-1).padStart(6,'0')}.png`);
    const pixels={initial:visual.initialMeanAbsoluteRgb,worst:visual.worstMeanAbsoluteRgb,
      final:visual.rows[visual.rows.length - 1].meanAbsoluteRgb,maximumProjectedCenterErrorPixels:visual.maximumProjectedCenterErrorPixels};
    for(const repeatRun of entry.runs.slice(1)){
      if(!repeatRun.native)throw Error('Native repeat is missing');
      const repeat=await readNativeRun(repeatRun.native);
      const proof=await verifyProvenance(repeatRun.native,null,calibrationRoot);
      const path=resolve(artifactRoot,`repeat-${repeatRun.repeat+1}-provenance.json`);
      await writeFile(path,JSON.stringify(proof,null,2));
      const firstPress=(value: Awaited<ReturnType<typeof readNativeRun>>) => {
        const press = value.inputs.find(e=>e.kind==='down');
        assert.ok(press, 'Native repeat needs its first press');
        return press.time;
      };
      const {rows,...spread}=compareTrajectories(native.frames,repeat.frames,
        {referenceOffset:firstPress(native),candidateOffset:firstPress(repeat)});
      repeats.push({repeat:repeatRun.repeat+1,...spread,provenance:path,
        qualification:'Observed native repeat spread with first press aligned; later input times are unchanged'});
    }
  return { id: entry.id, set: entry.set, status: 'measured' as const, errors: [], repeats, native: nativeSummary, browser: browserSummary, provenance, sourceNativeReport, nativeReport, browserReport, controlledBrowserReport, natural, controlled, inputReceipts, maximumBrowserInputDelayMilliseconds, projection, nativeInstrumentationMilliseconds, video, naturalVideo, poster, finalFrame, pixels };
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
function link(path: string){return relative(out,path).split('/').map(encodeURIComponent).join('/')}
function escape(value: string){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')}
function number(value: number | undefined,digits=3){return typeof value === 'number' && Number.isFinite(value)?value.toFixed(digits):'—'}
function name(id: string){return id.replace(/^(training|heldout|regression)-/,'').replaceAll('-',' ')}
function html(r: typeof report){return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Earth interaction comparison</title><link rel="icon" href="data:,"><style>
*{box-sizing:border-box}body{margin:0;background:#10141b;color:#e9edf5;font:16px/1.5 system-ui}main{max-width:1320px;margin:auto;padding:42px 24px}h1{font-size:42px;letter-spacing:-1px;line-height:1.15}h2{font-size:24px;margin:4px 0}p{max-width:1000px;color:#b6c2d4}.tag{color:#7ed8cf;font-size:12px;text-transform:uppercase;letter-spacing:1.4px}.overview{display:flex;gap:40px;margin:28px 0}.overview b{display:block;font-size:32px}.overview span,.metrics span{display:block;color:#a5b4c9;font-size:13px}section{border:1px solid #334052;border-radius:12px;padding:23px;margin:26px 0;background:#171d27}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin:24px 0}.metrics b{font-size:27px}video{display:block;width:100%;background:#000}summary{cursor:pointer;color:#b8d7e9;padding:16px 0}a{color:#89ddd6}.links{display:flex;gap:22px;flex-wrap:wrap}details p{font-size:14px}.invalid{color:#ffab99}nav{position:sticky;top:0;padding:15px 0;background:#10141b;z-index:1;display:flex;gap:10px}button{cursor:pointer;background:transparent;border:1px solid #55627a;border-radius:20px;color:#e9edf5;padding:8px 15px}button[aria-pressed=true]{background:#c9eae6;color:#192c2c}section[hidden]{display:none}footer{font-size:13px;margin-top:40px}@media(max-width:700px){main{padding:25px 12px}h1{font-size:33px}.metrics{grid-template-columns:1fr 1fr}section{padding:15px}.overview{gap:20px}}</style><main>
<div class="tag">cssEarth · Google Earth Pro reference</div><h1>See how the interactions match</h1><p>The same recorded gestures drive both applications. Controlled replay compares matching native frame steps; natural-speed replay separately shows timing differences.</p>
<div class="overview"><div><b>${r.coverage.measured}/${r.coverage.planned}</b><span>Scenarios measured</span></div><div><b>${r.coverage.nativeRepeatComparisons}</b><span>Native repeat comparisons</span></div><div><b>${r.coverage.invalid}</b><span>Invalid comparisons</span></div></div>
<p>${escape(r.qualification)} Videos show native | browser | absolute RGB difference ×4.</p><nav>${['all','training','heldout','regression'].map((s,i)=>`<button data-filter="${s}" aria-pressed="${i===0}">${s==='heldout'?'Held out':s}</button>`).join('')}</nav>
${r.results.map(c=>`<section data-set="${c.set}"><div class="tag">${c.set}</div><h2>${escape(name(c.id))}</h2>${c.status === 'invalid'?`<p class="invalid">INVALID: ${c.errors.map(escape).join('; ')}</p>`:`
<div class="metrics"><div><b>${number(c.controlled.maximumRotationErrorDegrees)}°</b><span>Largest rotation difference</span></div><div><b>${number(c.controlled.finalRotationErrorDegrees)}°</b><span>Final rotation difference</span></div><div><b>${number(c.controlled.maximumRelativeRadiusError*100,2)}%</b><span>Largest apparent size difference</span></div><div><b>${number(c.pixels.maximumProjectedCenterErrorPixels,2)} px</b><span>Largest center difference</span></div></div>
<video controls preload="none" poster="${link(c.poster)}" src="${link(c.video)}"></video><details><summary>Natural-speed replay and evidence</summary><video controls preload="none" src="${link(c.naturalVideo)}"></video><p>Natural-clock endpoint rotation difference: ${number(c.natural.finalRotationErrorDegrees)}°. Largest measured Chrome input delay: ${number(c.maximumBrowserInputDelayMilliseconds,1)} ms. These values retain recorder timing effects.</p><p>Input focal length: native ${number(c.projection.nativeInputFocalLength,2)} px; browser ${number(c.projection.browserInputFocalLength,2)} px. Prepared rendering focal length: ${number(c.projection.browserRenderFocalLength,2)} px.</p>${c.repeats.map(repeat=>`<p>Native repeat ${repeat.repeat}: endpoint spread ${number(repeat.finalRotationErrorDegrees)}°; largest trajectory spread ${number(repeat.maximumRotationErrorDegrees)}°.</p>`).join('')}<p class="links"><a href="${link(c.nativeReport)}">Native capture</a><a href="${link(c.controlledBrowserReport)}">Controlled Chrome capture</a><a href="${link(c.browserReport)}">Natural Chrome capture</a><a href="${link(c.provenance)}">Verified bytes</a><a href="${link(c.finalFrame)}">Final comparison image</a></p></details>`}</section>`).join('')}
${r.validation?`<p>${escape(r.validation.summary)} <a href="${link(r.validation.report)}">Validation record</a></p>`:''}<footer><a href="report.json">All measurements</a> · <a href="suite.json">Run configuration</a><p>${r.limits.map(escape).join('<br>')}</p>Generated ${escape(r.generatedAt)}</footer></main><script>for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{for(const x of document.querySelectorAll('[data-filter]'))x.setAttribute('aria-pressed',String(x===b));for(const s of document.querySelectorAll('section'))s.hidden=b.dataset.filter!=='all'&&s.dataset.set!==b.dataset.filter}</script></html>`}
function markdown(r: typeof report){return `Google Earth interaction comparison\n\n${r.coverage.measured}/${r.coverage.planned} scenarios measured; ${r.coverage.invalid} invalid.\n\n${r.qualification}\n\n[Visual report](${resolve(out,'index.html')})\n\n| Scenario | Maximum rotation difference | Final rotation difference | Maximum size difference |\n| --- | ---: | ---: | ---: |\n${r.results.map(c=>`| ${name(c.id)} | ${number(c.status === 'measured' ? c.controlled.maximumRotationErrorDegrees : undefined)}° | ${number(c.status === 'measured' ? c.controlled.finalRotationErrorDegrees : undefined)}° | ${number(c.status === 'measured' ? c.controlled.maximumRelativeRadiusError*100 : undefined,2)}% |`).join('\n')}\n\n${r.limits.map(l=>'- '+l).join('\n')}\n`}


function parseVisualReport(value: unknown) {
  const entry = object(value, 'visual comparison');
  const rows = array(entry.rows, 'comparison rows').map(value => {
    const row = object(value, 'comparison frame');
    return { meanAbsoluteRgb: finite(row.meanAbsoluteRgb) };
  });
  assert.ok(rows.length, 'Visual comparison requires measured frames');
  return { video: text(entry.video), rows, initialMeanAbsoluteRgb: finite(entry.initialMeanAbsoluteRgb),
    worstMeanAbsoluteRgb: finite(entry.worstMeanAbsoluteRgb), maximumProjectedCenterErrorPixels: finite(entry.maximumProjectedCenterErrorPixels) };
}
