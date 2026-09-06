import { writeFile } from 'node:fs/promises';

export async function writeReport(report,output) {
  const rows=[];
  for(const engine of ['css','cesium']){
    const trace=report.traces?.[engine];if(!trace)continue;
    for(const s of trace.samples){
      const record={engine,time:trace.timeOrigin+s.at};
      if(engine==='css')Object.assign(record,{wanted:s.desired.length,pending:s.oracle.pages.filter(p=>!p.ready).length,
        active:s.activeLoads,ready:s.retained.filter(p=>p.ready).length,drawn:s.retained.filter(p=>p.published&&!p.empty).length,
        fallback:s.retained.filter(p=>p.published&&!s.desired.includes(p.key)).length,
        queue:s.oracle.pages.filter(p=>!p.ready).map(p=>({tile:p.key,state:p.loading?'LOADING':'QUEUED',url:p.url})),
        coverage:s.oracle.groups,metadata:s.index.oracleEntries});
      else {
        const wanted=new Set([...s.rendered,...Object.values(s.queues).flat()].flatMap(t=>t.imagery.map(i=>i.wanted)));
        const pending=s.images.filter(i=>wanted.has(i.tile)&&!['READY','FAILED','INVALID'].includes(i.state));
        Object.assign(record,{wanted:wanted.size,pending:pending.length,
        active:s.scheduler.numberOfActiveRequests,ready:s.images.filter(i=>i.state==='READY').length,drawn:new Set(s.draws.flatMap(d=>d.images.map(i=>i.tile))).size,
        fallback:s.rendered.reduce((n,t)=>n+t.imagery.filter(i=>i.fallback).length,0),
        queue:pending.map(i=>({tile:i.tile,state:i.state,request:i.request?.state})),coverage:s.rendered,
        metadata:{terrainQueues:s.queues,requestHeap:s.scheduler.heap,cachedImages:s.images},registration:s.registration});
      }
      rows.push(record);
    }
  }
  const data={complete:report.complete??false,qualification:report.qualification,rows,actions:report.actions,
    checkpoints:report.checkpoints.map(c=>({name:c.name,time:c.at,end:c.end,css:c.css,cesium:c.cesium})),
    events:Object.entries(report.traces??{}).flatMap(([engine,t])=>(t?.events??[]).map(e=>({...e,engine,time:t.timeOrigin+e.at}))),
    requests:Object.entries(report.network??{}).flatMap(([engine,n])=>n.requests.map(r=>({...r,engine}))),fixture:report.fixture,
    errors:report.errors,failure:report.failure,video:report.video};
  await writeFile(new URL('timeline.json',output),JSON.stringify(data));
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Cesium × cssEarth loading oracle</title>
<style>body{background:#101217;color:#e7eaf0;margin:24px;font:15px system-ui}h1{font-size:24px}p{max-width:1000px;color:#b7bfcb}button,input,select{font:inherit}input[type=range]{width:100%}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{background:#191e27;padding:16px;border-radius:8px}img{width:100%;display:block}h2{font-size:18px;margin:0 0 12px}pre{white-space:pre-wrap;max-height:320px;overflow:auto;font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px}td,th{text-align:left;padding:6px;border-bottom:1px solid #303643;word-break:break-all}a{color:#88bfff}small{color:#a0aec2}svg{width:100%;height:120px}#events{max-height:380px;overflow:auto}.metrics{font:15px monospace;line-height:1.7}summary{cursor:pointer}#time{font-variant-numeric:tabular-nums}#controls{position:sticky;top:0;background:#101217;padding:8px 0;z-index:2}</style>
<h1>Cesium × cssEarth · loading oracle</h1><p id="qualification"></p><video id="movie" controls playsinline style="display:none;width:100%;background:black"></video><div id="controls"><button id="play">Play</button> <span id="time"></span><input id="scrub" type="range" min="0" max="10000" value="0"><svg id="chart" viewBox="0 0 1000 120" preserveAspectRatio="none"></svg><small>Pending resources: blue cssEarth · orange Cesium. Counts have different units; inspect tiles and coverage below.</small></div>
<div class="pair"><section class="card"><h2>cssEarth</h2><div id="css-metrics" class="metrics"></div><img id="css-image"><small id="css-caption"></small><details open><summary>Pending pages</summary><pre id="css-queue"></pre></details><details><summary>Coverage, ancestor lineage and metadata queues</summary><pre id="css-coverage"></pre></details></section>
<section class="card"><h2>Cesium 1.145</h2><div id="cesium-metrics" class="metrics"></div><img id="cesium-image"><small id="cesium-caption"></small><details open><summary>Pending imagery</summary><pre id="cesium-queue"></pre></details><details><summary>Terrain tiles, ancestor imagery and queues</summary><pre id="cesium-coverage"></pre></details></section></div>
<h2>Requests pending at this time</h2><div id="requests"></div><h2>Lifecycle events at this time</h2><div id="events"></div><p><a href="report.json">Full trace and provenance</a> · <a href="timeline.json">Timeline data</a></p>
<script type="module">
const data=await(await fetch('./timeline.json')).json(),by=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
by('qualification').textContent=(data.complete?'Capture complete. ':'Capture incomplete. ')+data.qualification;
const start=data.video?.startEpoch??Math.min(...data.rows.map(s=>s.time)),end=data.video?start+data.video.duration*1000:Math.max(...data.rows.map(s=>s.time)),duration=end-start;const movie=by('movie');if(data.video){movie.src=data.video.url+'?sha256='+encodeURIComponent(data.video.sha256??'');movie.style.display='block';}
const samples=Object.fromEntries(['css','cesium'].map(e=>[e,data.rows.filter(r=>r.engine===e)]));
const maximum=Math.max(1,...data.rows.map(r=>r.pending));
const paths=['css','cesium'].map((e,i)=>'<polyline fill="none" stroke="'+['#71baff','#ffa663'][i]+'" stroke-width="2" points="'+samples[e].map(r=>[(r.time-start)/duration*1000,110-r.pending/maximum*100].join(',')).join(' ')+'"/>').join('');
function table(rows,fields){return '<table><thead><tr>'+fields.map(f=>'<th>'+escape(f)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+fields.map(f=>'<td>'+escape(typeof r[f]==='object'?JSON.stringify(r[f]):r[f])+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}
function render(fromMedia=false){const time=start+Number(by('scrub').value)/10000*duration;if(data.video&&!fromMedia&&Math.abs(movie.currentTime-(time-start)/1000)>.08)movie.currentTime=(time-start)/1000;const action=data.actions.filter(a=>a.at<=time).at(-1);by('time').textContent=((time-start)/1000).toFixed(2)+' s · '+(action?.phase??'boot');by('chart').innerHTML=paths+'<line stroke="white" x1="'+(time-start)/duration*1000+'" x2="'+(time-start)/duration*1000+'" y1="0" y2="120"/>';
for(const engine of ['css','cesium']){const s=samples[engine].filter(s=>s.time<=time).at(-1)??samples[engine][0];if(!s)continue;by(engine+'-metrics').textContent='wanted '+s.wanted+' · pending '+s.pending+' · active '+s.active+' / ready '+s.ready+' · drawn '+s.drawn+' · fallback '+s.fallback;by(engine+'-queue').textContent=JSON.stringify(s.queue,null,2);by(engine+'-coverage').textContent=JSON.stringify({coverage:s.coverage,metadata:s.metadata,registration:s.registration},null,2);const c=data.checkpoints.filter(c=>c.time<=time).at(-1)??data.checkpoints[0];if(c){const img=by(engine+'-image');if(!img.src.endsWith('/'+c[engine])){img.style.opacity='0';img.onload=()=>{img.style.opacity='1';};img.src=c[engine];}by(engine+'-caption').textContent=c.name+' · captured '+((c.time-start)/1000).toFixed(2)+' s · '+(c.end-c.time)+' ms capture window. Still image; timeline continues independently.';}}
by('requests').innerHTML=table(data.requests.filter(r=>r.start<=time&&(!r.end||r.end>time)).map(r=>({...r,age:Math.round(time-r.start)+' ms'})),['engine','type','age','status','range','url']);
by('events').innerHTML=table(data.events.filter(e=>e.time<=time&&e.time>time-500).slice(-100).map(e=>({...e,t:((e.time-start)/1000).toFixed(3)})),['t','engine','type','tile','key','state','url']);}
by('scrub').addEventListener('input',()=>render());if(data.video){const syncMedia=()=>{by('scrub').value=movie.currentTime*1000/duration*10000;render(true);};movie.ontimeupdate=syncMedia;movie.onseeked=syncMedia;movie.onplay=()=>by('play').textContent='Pause';movie.onpause=()=>{by('play').textContent='Play';syncMedia();};}let timer;by('play').onclick=()=>{if(data.video){if(movie.paused)movie.play();else movie.pause();return;}if(timer){clearInterval(timer);timer=null;by('play').textContent='Play';return;}by('play').textContent='Pause';timer=setInterval(()=>{by('scrub').value=Math.min(10000,Number(by('scrub').value)+1000000/duration);render();if(Number(by('scrub').value)>=10000){clearInterval(timer);timer=null;by('play').textContent='Play';}},100);};render();
</script></html>`;
  await writeFile(new URL('index.html',output),html);
}
