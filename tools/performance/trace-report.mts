import { escapeHtml as esc } from './trace-chart.mts';
import { relative } from 'node:path';
import type { TraceLocation } from './trace-model.mts';
import { present, recordOf } from './trace-model.mts';
import type { CostFrame } from './trace-costs.mts';
import type { RecorderState } from './trace-capture.mts';
import type { InvalidationSummary } from './trace-invalidations.mts';
import type { TraceBrief } from './trace-brief.mts';

const fileOf = (url: unknown) => typeof url === 'string' ? url.split('/').at(-1) : undefined;
function location(f: TraceLocation | undefined) {
  if (!f) return 'No scheduling stack captured';
  const original = recordOf(f.original);
  return original ? `${original.source}:${original.line}:${original.column}`
    : `${f.functionName || '(anonymous)'} · ${fileOf(f.url) ?? 'native'}:${f.lineNumber ?? '?'}:${f.columnNumber ?? '?'}`;
}
/** Recorder resources are copied from the page's diagnostic JSON. */
function resourceSummary(value: unknown) {
  const resources = recordOf(value), images = recordOf(resources?.images);
  return { decodes: resources?.decodes, pending: resources?.pending,
    committed: resources?.committed, allocations: images?.allocations, releases: images?.releases };
}

export function buildDiagnosis(brief: TraceBrief) {
  const nodeSummary = (value: InvalidationSummary | undefined) => value && ({ events: value.events,
    firstStackedInvalidation: value.firstStackedInvalidation ?? null,
    owners: value.owners.slice(0, 5).map(({ owner, events, distinctNodes, reasons }) => ({ owner, events, distinctNodes, reasons })),
    setters: value.setters.slice(0, 3) });
  const recorderSummary = (r: RecorderState | null | undefined) => r && ({ ageMs: r.ageMs, stale: r.stale, relation: r.relation,
    active: r.active, selected: r.selected, overview: r.overview, mountedObjects: r.mountedObjects,
    playback: r.playback, camera: r.camera, worldFrames: r.worldFrames, framePublication: r.framePublication,
    geometry: r.geometry, resources: r.resources && resourceSummary(r.resources) });
  const frameSummary = (f: CostFrame | null) => f && ({ index: f.index, startMs: f.startMs, endMs: f.endMs, intervalMs: f.intervalMs,
    totalMs: f.totalMs, exclusiveMs: f.exclusiveMs, dominant: f.dominant, classification: f.classification,
    recorder: recorderSummary(f.recorder), invalidations: nodeSummary(f.invalidations) });
  const frame = brief.costs.worstBusyFrames[0] ?? null;
  const gap = brief.costs.longestPresentationGaps[0] ?? null;
  const task = brief.busiestTasks.at(0);
  const styles = (task?.renderingPasses ?? []).filter(p => p.name === 'UpdateLayoutTree').sort((a, b) => b.durationMs - a.durationMs);
  const style = styles.at(0);
  const rankedWork = Object.entries(brief.costs.total.exclusiveMs).filter(([, ms]) => ms > 0).sort((a, b) => b[1] - a[1])
    .map(([kind, ms]) => ({ kind, exclusiveMs: ms, msPerSecond: Math.round(ms / (brief.window.durationMs / 1000) * 1000) / 1000 }));
  const nextEvidence: Record<string, unknown>[] = [];
  if (style) nextEvidence.push({ observation: `${style.durationMs} ms style pass in the busiest task; ${style.elements ?? 'unknown'} elements.`,
    firstSchedulingCall: style.triggers[0] ?? null,
    firstQueuedInvalidationWithStack: style.invalidationEvidence?.queued.firstStackedInvalidation ?? null,
    nodeEvidence: style.invalidationEvidence && { queued: nodeSummary(style.invalidationEvidence.queued), duringPass: nodeSummary(style.invalidationEvidence.duringPass) },
    boundary: 'This first call scheduled the flush. It does not prove that the call caused all work in the pass.',
    evidence: 'agent-brief.json: busiestTasks[0].renderingPasses' });
  if (gap && gap.totalMs < Math.min(brief.displayBudgetMs, gap.intervalMs * .25)) nextEvidence.push({
    observation: `Largest interval is ${gap.intervalMs} ms with ${gap.totalMs} ms observed main work.`,
    boundary: 'Investigate compositor, worker, scheduler and recording overhead; this is not evidence of a CPU stall.',
    evidence: 'agent-brief.json: costs.longestPresentationGaps[0]' });
  const missing: string[] = [];
  if (!brief.invalidations.available) missing.push('No detailed node invalidations; affected setters/selectors cannot be reconstructed.');
  if (brief.invalidations.domOwnership === 'unavailable') missing.push('No validated DOM snapshots; backend IDs cannot be assigned to app owners.');
  if (!brief.capture?.alignment?.valid) missing.push('No matched recorder clock; camera, residency and publication state unavailable.');
  if (!brief.buildSources?.some(s => s.verification === 'matches capture manifest')) missing.push('No verified captured bundle bytes; original source attribution is unproven.');
  if (!brief.evidenceCoverage.jsSamples) missing.push('No sampled JS call stacks.');
  if (!brief.evidenceCoverage.styleSchedulingStacks) missing.push('No scheduling-call stacks captured. Node invalidation setters remain separate evidence.');
  if (!brief.buildSources?.some(s => s.sourceMap?.status?.startsWith('provided-build-map'))) missing.push('No original-source maps available; generated locations are retained.');
  return { schema: 'cssearth-trace-diagnosis@1', trace: brief.input, status: brief.capture.status === 'invalid' ? 'INVALID capture' : missing.length ? 'PARTIAL evidence' : 'matched evidence',
    captureErrors: brief.capture.errors ?? [],
    interpretation: 'Observed work and concrete evidence boundaries. Neither timing nor invalidation counts alone prove that work is avoidable.',
    rankedWork, worstBusyFrame: frameSummary(frame), largestPresentationGap: frameSummary(gap),
    busiestTask: task && { atMs: task.atMs, durationMs: task.durationMs, exclusive: task.exclusive, recorder: recorderSummary(task.recorder),
      recentInputs: task.recentInputs, sampledJsSelf: task.sampledJsSelf },
    nextEvidence, missing, comparisons: brief.comparisons ?? [],
    artifacts: { chart: 'performance.svg', detail: 'agent-brief.json', rawFrames: 'frame-times.svg', fullAnalysis: 'analysis.json' } };
}
export type TraceDiagnosis = ReturnType<typeof buildDiagnosis>;

export function renderReport(brief: TraceBrief, diagnosis: TraceDiagnosis, chart: string, output: string) {
  const table = (headers: readonly string[], rows: readonly (readonly unknown[])[]) => `<div class="scroll"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(c => `<td>${esc(c ?? 'unavailable')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const styleRows = brief.busiestTasks.flatMap(t => (t.renderingPasses ?? []).filter(p => p.name === 'UpdateLayoutTree').map(p => [
    p.atMs, p.durationMs, p.elements, location(p.triggers[0]?.stack[0]),
    location(p.invalidationEvidence?.queued.firstStackedInvalidation?.stack[0]),
    p.invalidationEvidence?.duringPass.owners.slice(0, 3).map(g => `${g.owner}: ${g.events} events / ${g.distinctNodes} nodes`).join('; ') || 'No captured node evidence',
  ]));
  const worst = brief.costs.worstBusyFrames;
  const video = brief.capture.video;
  const videoLinks = video ? worst.slice(0, 3).map(f => {
    const seconds = Math.max(0, (brief.window.startTs + f.startMs * 1000 - video.traceOriginUs) / 1e6 - .2);
    return `<a href="${esc(relative(output, video.file).split('/').map(encodeURIComponent).join('/') + '#t=' + seconds.toFixed(3))}">Busy interval at +${f.startMs} ms</a>`;
  }).join(' · ') : 'No matched video available.';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>cssEarth performance · ${esc(brief.averageSeries.label)}</title>
<style>body{max-width:1140px;margin:32px auto;padding:0 24px;background:#0c1220;color:#e2eaf6;font:15px/1.55 system-ui}h1{font-size:25px}h2{margin-top:32px;font-size:19px}p{max-width:100ch}.muted{color:#a5b4ca}a{color:#85c8ff}svg{width:100%;height:auto}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;padding:9px;border-bottom:1px solid #29344a}th{color:#b5c6dd}details{margin:16px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.stats{display:flex;gap:14px;flex-wrap:wrap}.stats div{padding:14px 20px;background:#182136;border-radius:7px}.stats strong{display:block;font-size:24px}</style>
<h1>${esc(brief.averageSeries.label)}</h1><p>${esc(diagnosis.status)} · ${esc(brief.capture.status)} · ${esc(present(brief.input.sha256, 'input SHA-256').slice(0, 12))}</p>
${diagnosis.captureErrors.length ? `<p>Capture validation failed: ${esc(diagnosis.captureErrors.join('; '))}</p>` : ''}
<div class="stats"><div><strong>${esc(brief.presentation.p95Ms ?? '—')} ms</strong>raw interval p95</div><div><strong>${esc(worst[0]?.totalMs ?? '—')} ms</strong>worst interval main work</div><div><strong>${esc(brief.presentation.maxMs ?? '—')} ms</strong>largest raw interval</div></div>
${chart}<p class="muted">Arithmetic mean of intervals ending in the previous 500 ms, sampled every 100 ms. Missing observations break the line. Raw hitches are retained below and in <a href="frame-times.svg">the unaveraged timeline</a>. Elapsed-time alignment does not align different gestures.</p>
${brief.comparisons.map(c => `<p><b>${esc(c.trace)}:</b> ${esc(c.comparability)}${c.reasons.length ? ' · ' + esc(c.reasons.join('; ')) : ''}</p>`).join('')}
<h2>Where main-thread time went</h2><p class="muted">Exclusive costs avoid counting forced styles twice inside JavaScript. These describe observed work, not a claim that it can all be removed.</p>
${table(['Work', 'Total ms', 'ms / recorded second'], diagnosis.rankedWork.map(r => [r.kind, r.exclusiveMs, r.msPerSecond]))}
<h2>Worst busy intervals</h2>${table(['At ms', 'Presentation ms', 'Main work ms', 'Dominant work', 'Interpretation'], worst.map(f => [f.startMs, f.intervalMs, f.totalMs, f.dominant, f.classification]))}
<p>${videoLinks}</p>
<h2>First style scheduling call and affected nodes</h2><p class="muted">A scheduling origin is not exclusive attribution. The first queued invalidation with a captured stack is shown separately. Node events during a style pass can represent propagation. Counts are not milliseconds.</p>${table(['At ms', 'Style ms', 'Elements', 'First scheduling location', 'First queued node stack', 'During-pass node ownership'], styleRows.slice(0, 16))}
<h2>Recorded phases</h2>${table(['Phase', 'Duration ms', 'Main ms', 'Script ms', 'Style ms', 'Layers ms'], brief.costs.phases.map(p => [p.name, p.durationMs, p.totalMs, p.exclusiveMs.script, p.exclusiveMs.style, p.exclusiveMs.layers]))}
<h2>What remains unknown</h2><ul>${[...diagnosis.missing, ...brief.evidenceGaps].map(s => `<li>${esc(s)}</li>`).join('')}</ul>
<p><a href="diagnosis.json">Compact diagnosis</a> · <a href="agent-brief.json">Detailed evidence</a> · <a href="performance-chart.json">Reusable chart series</a> · <a href="analysis.json">Full FrameSleuth analysis</a></p>
<details><summary>Recorder state and evidence for the worst work</summary><pre>${esc(JSON.stringify(diagnosis, null, 2))}</pre></details></html>`;
}
