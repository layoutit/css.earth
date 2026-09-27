import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { loadTrace } from '../../performance/load-trace.mts';
import { occupiedMs } from '../../performance/trace-brief.mts';
import { arrayOf, hasDuration, isTraceEvent, isFiniteNumber, present, recordOf } from '../../performance/trace-model.mts';

const directory='output/playwright/native-drag/perf-final';
const rec=(value:unknown)=>present(recordOf(value),'record');
const num=(value:unknown)=>{assert.ok(isFiniteNumber(value));return value;};
const comparison=rec(JSON.parse(await readFile(`${directory}/comparison.json`,'utf8')));
interface Phase { durationMs:number;mainTaskMs:number;styleMs:number;layoutMs:number;layoutPasses:number;paintMs:number;stylePasses:number }
const results:{mode:string;trial:number;drag:Phase;idle:Phase;presentationP95Ms:number;droppedMarkers:number;meanPixelDifference:number;materialRowsRequested:number;sha256:string}[]=[];
for(const item of present(arrayOf(comparison.results),'runs')){
 const run=rec(item);assert.ok(typeof run.mode==='string');const trial=num(run.trial),name=`${run.mode}-${trial}`;
 const brief=rec(JSON.parse(await readFile(`${directory}/${name}-analysis/agent-brief.json`,'utf8'))),selection=rec(brief.selection);
 const trace=await loadTrace(`${directory}/${name}.json.gz`);assert.equal(trace.sha256,rec(run.trace).sha256);
 const events=trace.events.filter(isTraceEvent);
 const measure=(phase:'drag'|'idle')=>{
  const marker=(edge:string)=>present(events.find(event=>event.name==='clock_sync'&&event.args?.sync_id===`${name}:${phase}-${edge}`),'phase marker').ts;
  const start=marker('start'),end=marker('end');
  const main=events.filter(event=>event.pid===selection.rendererPid&&event.tid===selection.rendererMainTid&&event.ph==='X')
   .filter(hasDuration).filter(event=>event.ts<end&&event.ts+event.dur>start);
  const time=(name:string)=>occupiedMs(main.filter(event=>event.name===name),start,end);
  return {durationMs:(end-start)/1000,mainTaskMs:time('RunTask'),styleMs:time('UpdateLayoutTree'),layoutMs:time('Layout'),
   layoutPasses:main.filter(event=>event.name==='Layout').length,paintMs:time('Paint'),stylePasses:main.filter(event=>event.name==='UpdateLayoutTree').length};
 };
 results.push({mode:run.mode,trial,drag:measure('drag'),idle:measure('idle'),
  presentationP95Ms:num(rec(brief.presentation).p95Ms),droppedMarkers:num(rec(brief.pipeline).dropOrSmoothnessMarkers),
  meanPixelDifference:num(run.meanPixelDifference),materialRowsRequested:num(run.materialRowsRequested),sha256:trace.sha256});
}
const summary=['native','js','solar'].map(mode=>{
 const runs=results.filter(run=>run.mode===mode);assert.equal(runs.length,3);
 const median=(values:number[])=>[...values].sort((a,b)=>a-b)[1];
 const phase=(phase:'drag'|'idle')=>Object.fromEntries(Object.keys(runs[0][phase]).map(key=>[key,median(runs.map(run=>num(rec(run[phase])[key])))]));
 return {mode,drag:phase('drag'),idle:phase('idle'),presentationP95Ms:median(runs.map(run=>run.presentationP95Ms)),
  totalDroppedMarkers:runs.reduce((n,run)=>n+run.droppedMarkers,0)};
});
await writeFile(`${directory}/summary.json`,JSON.stringify({browser:comparison.browser,scope:comparison.scope,htmlSha256:comparison.htmlSha256,summary,results},null,2));
const labels:Record<string,string>={native:'Native resize + CSS camera near Saturn',js:'JS pointer input + same CSS camera near Saturn',solar:'Native resize + CSS camera at Solar System scale'};
const rows=summary.map(run=>`| ${labels[run.mode]} | ${run.drag.mainTaskMs.toFixed(1)} | ${run.drag.styleMs.toFixed(1)} | ${run.drag.layoutMs.toFixed(1)} | ${run.drag.layoutPasses} | ${run.idle.styleMs.toFixed(1)} |`);
await writeFile(`${directory}/RESULTS.md`,`# Native CSS camera: input and expression cost

${String(comparison.scope)}

Chrome ${String(comparison.browser)}, 1280×900, DPR 1. Three interleaved trials per mode, the same integer pointer path, warm-up and 972 prepared Saturn nodes. The native cases disable JavaScript and block scripts with CSP. The JS case enables only the small pointer fixture. All scene publication remains CSS.

Values are medians in milliseconds. Drag spans approximately 3.8 seconds; idle spans 1.5 seconds. Main task time unions main-thread RunTask intervals within explicit drag markers; nested style/layout slices are not added to that total.

| Mode | Main task ms | Style ms | Layout ms | Layout passes | Idle style ms |
|---|---:|---:|---:|---:|---:|
${rows.join('\n')}

The browser loaded six prepared material rows along this path, rather than eagerly loading the whole 16-row bank. Matching endpoints and screenshots pass the declared mean-channel error below 0.1/255. The captured HTML, input fixture and trace hashes are retained beside this report. Presentation statistics in summary.json count browser presentation events, which may include repeated camera poses; they are not measurements of unique camera updates.

This does not compare the CSS camera with the application's complete JS renderer. The earlier sensor-only comparison on that renderer is [separate evidence](../../native-resize/saturn-transparent/RESULTS.md).

[Per-trial measurements](summary.json) · [Input and visual checks](comparison.json) · [Native trace report](native-1-analysis/report.html) · [JS-input trace report](js-1-analysis/report.html)
`);
console.log(JSON.stringify(summary,null,2));
