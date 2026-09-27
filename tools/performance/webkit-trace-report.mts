/** Standalone, portable rendering of evidence prepared after capture. */
import { isRecord } from '@cssearth/core';
import type { writeNavigationAnalysis } from './webkit-trace-slices.mts';
import { COST_KINDS } from './trace-costs.mts';
import type { TraceLocation } from './trace-model.mts';
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const source = (l: TraceLocation) => {
  const original = isRecord(l.original) ? l.original : null;
  return original ? `${esc(original.source)}:${esc(original.line)}` : `${esc(l.url)}:${esc(l.lineNumber)}:${esc(l.columnNumber)}`;
};
const json = (v: unknown) => `<pre>${esc(JSON.stringify(v, null, 2))}</pre>`;
export function analysisHtml(a: Awaited<ReturnType<typeof writeNavigationAnalysis>>) {
  const link = (id: string, label: unknown) => `<a data-trace="${esc(a.views.find(v => v.id === id)?.path ?? 'trace.devtools.json')}">${esc(label)}</a>`;
  const tasks = a.clues.tasks.map(t => `<article id="${esc(t.id)}"><h3>${link(t.id, `${t.flight ?? 'Recording'} — ${t.durationMs} ms`)} <small>${esc(t.phase)}</small></h3>
    <p>Script ${t.exclusiveMs.script} ms · style ${t.exclusiveMs.style} ms · layout ${t.exclusiveMs.layout} ms · paint ${t.exclusiveMs.paint} ms · composite ${t.exclusiveMs.commit} ms. Source clock ${(t.traceStartUs / 1000).toFixed(3)} ms.</p>
    ${t.nativeSamples.threads.length ? `<p>Native sample weights in this window: ${t.nativeSamples.threads.slice(0, 6).map(n => `${esc(n.process)} / ${esc(n.thread)}: ${n.weightMs} ms`).join(' · ')}. Concurrent samples; not elapsed main-thread time.</p>` : ''}
    <details open><summary>Flight → caller → exact write → WebKit scheduling → rendering</summary>
    <p>${t.chain.operations.length} recorded calls in the pending rendering window. Only calls listed beside a scheduler have a proven synchronous scheduling link.</p>
    <table><tr><th>Rendering pass</th><th>ms</th><th>Call that scheduled it</th></tr>${t.chain.passes.map(p => `<tr><td>${esc(p.name)}${p.inTask ? ' (this task)' : ' (preceding)'}</td><td>${p.durationMs.toFixed(3)}</td><td>${p.triggerLinks.map(l => {
      const o = t.chain.operations.find(o => o.id === l.operationId);
      return o ? `<b>#${o.id} ${esc(o.kind)} ${esc(o.property)}</b> on ${esc(o.target.label)}<br>${esc(JSON.stringify(o.before))} → ${esc(JSON.stringify(o.after))}<br>${o.stack.map(source).slice(0, 6).join('<br>')}` : 'Uninstrumented scheduler; inspect its native stack';
    }).join('<hr>') || 'No mutation-to-paint causal edge exposed by WebKit'}${p.forcedByOperationIds.map(id => { const o=t.chain.operations.find(o => o.id === id); return o ? `<p>Forced synchronously by #${id}: ${esc(o.property)}<br>${o.stack.map(source).slice(0, 4).join('<br>')}</p>` : ''; }).join('')}</td></tr>`).join('')}</table>
    <details><summary>All pending calls, targets, ancestor IDs and full mapped stacks</summary>${json(t.chain)}</details></details>
    <div class="frames">${Object.entries(t.screenshots).map(([label, s]) => s ? `<figure><img loading="lazy" src="${esc(s.file)}"><figcaption>${esc(label)} · ${(s.sourceUs / 1000).toFixed(3)} ms</figcaption></figure>` : '').join('')}</div>
    <p>${t.calls.map(source).filter((v, i, all) => all.indexOf(v) === i).slice(0, 6).join('<br>')}</p>
    <details><summary>Scheduling, source excerpts, render passes, resources and DOM</summary>${json(t)}</details></article>`).join('');
  const patterns = a.clues.repeatedSynchronousRendering.filter(g => g.maxMs > 1000 / 60 || g.count > 1).map(g => `<li><b>${source(g.caller)}</b>: ${g.count} nested ${esc(g.kind)} passes, ${g.totalMs} ms total; worst ${g.maxMs} ms.<br>${[...g.occurrences].sort((a, b) => b.durationMs - a.durationMs).slice(0, 3).map(o => link(a.clues.tasks.find(t => o.sourceUs >= t.startTs && o.sourceUs < t.endTs)?.id ?? o.viewId, `${o.flight ?? 'recording'} / ${o.phase ?? 'outside navigation'} / ${o.durationMs} ms`)).join(' · ')}<details><summary>Evidence and source excerpt</summary>${json(g)}</details></li>`).join('');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Trace evidence · ${esc(a.capture)}</title>
<style>body{font:14px system-ui;background:#16191f;color:#eee;margin:24px}h1{font-size:23px}h2{margin-top:36px}table{border-collapse:collapse;width:100%}th,td{padding:8px;text-align:right;border-bottom:1px solid #343943}td:first-child,th:first-child{text-align:left}a{color:#8ec8ff;cursor:pointer}p,small{color:#bbc2ce}th{position:sticky;top:0;background:#16191f}article{border-top:1px solid #454a52;padding:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:600px;overflow:auto;background:#0c1017;padding:16px}li{margin:14px 0;overflow-wrap:anywhere}.frames{display:flex;gap:12px}figure{margin:0}img{height:220px;max-width:100%;object-fit:contain}summary{cursor:pointer;padding:8px 0}</style>
<h1>Trace evidence</h1><p>${esc(a.capture)}</p>${a.clues.causes.coverage.enabled ? '<p><b>DEBUG CAPTURE — diagnostic hooks add overhead. Use a normal trace for timing comparisons.</b></p>' : ''}<p>${link('full', 'Open full journey')} · <a href="analysis.json">Machine-readable evidence</a></p>
<h2>Repeated synchronous rendering</h2><p>Rendering inside a callback is observed nesting. It does not identify the earlier mutation that dirtied the page.</p><ul>${patterns || '<li>No repeated synchronous rendering recorded.</li>'}</ul>
<h2>Paint around each handoff</h2><table><tr><th>Phase</th><th>Paint passes</th><th>Paint ms</th><th>Largest paint ms</th></tr>${a.clues.paintByPhase.map(p => `<tr><td>${link(p.viewId, p.label)}</td><td>${p.passes}</td><td>${p.exclusiveMs.paint}</td><td>${p.maxPaintMs}</td></tr>`).join('')}</table>
<h2>Scene cleanup and retained DOM</h2><p>${a.clues.releases.length} releases; ${a.clues.releases.filter(r => r.anomaly).length} report remaining owners, images or pending work. Snapshot changes span the recorded interval; they are not per-task mutation logs.</p><details><summary>Scene releases, DOM / orbit / resource snapshots</summary>${json({ releases: a.clues.releases, snapshots: a.clues.domSnapshots })}</details>
<h2>Network context</h2><p>${a.clues.network.requests.length} requests; ${a.clues.network.repeatedUrls.length} repeated URLs; ${a.clues.network.failures.length} failures. Revalidation is not automatically a duplicate-load bug.</p><details><summary>Requests, transfer sizes, initiators and overlap</summary>${json(a.clues.network)}</details>
<h2>Stall evidence</h2><p>Every task over a nominal 16.7 ms, plus the worst task of each flight. Each link opens a ready-made slice with its scheduler and neighboring native frames.</p>${tasks}
<details><summary>All prepared views and exclusive costs</summary><p>${esc(a.interpretation)}</p><table><tr><th>View</th><th>Window ms</th><th>Worst task ms</th>${COST_KINDS.map(k => `<th>${k} ms</th>`).join('')}</tr>${a.views.map(v => `<tr><td>${link(v.id, v.label)}</td><td>${v.durationMs}</td><td>${v.worstTaskMs}</td>${COST_KINDS.map(k => `<td>${v.exclusiveMs[k]}</td>`).join('')}</tr>`).join('')}</table></details>
<h2>Capture hooks and exact scheduling links</h2>${json(a.clues.causes.coverage)}<details><summary>Motion writes, target identities and diagnostic limits</summary>${json(a.clues.causes)}</details>
<h2>Coverage and limits</h2>${json(a.clues.coverage)}<ul>${a.clues.limitations.map(l => `<li>${esc(l)}</li>`).join('')}<li>Source-map annotations describe the supplied build. Bundle/map hashes and verification status are retained below.</li></ul><details><summary>Source-map provenance</summary>${json(a.buildSources)}</details>
<script>for(const a of document.querySelectorAll('[data-trace]')){const trace=new URL(a.dataset.trace,location.href);a.target='_top';a.href='/devtools/trace_app.html?follow=1&loadTimelineFromURL='+encodeURIComponent(trace.pathname)}</script>`;
}
