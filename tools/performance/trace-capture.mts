import { sha256 } from '@cssearth/core/node';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { hasErrorCode, requireString } from '@cssearth/core';
import type { JsonRecord, TraceEvent, TraceSelection } from './trace-model.mts';
import { arrayOf, errorMessage, isFiniteNumber, isInstantPhase, recordOf } from './trace-model.mts';
import type { DomSnapshot } from './trace-invalidations.mts';


const detail = (e: TraceEvent): unknown => {
  const value = recordOf(e.args?.data)?.detail ?? e.args?.detail;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
};

export interface RecorderAnchor { phase: 'started' | 'stopped'; traceUs: number; recorderMs: number; offsetUs: number }
export type RecorderAlignment =
  | { valid: false; reason: string; recordingId?: unknown; anchors?: (RecorderAnchor | null)[]; driftUs?: undefined }
  | { valid: boolean; recordingId: unknown; anchors: RecorderAnchor[]; driftUs: number; reason: string };

/** Recorder JSON is external: every field is checked as it is read. */
export function alignRecorder(events: readonly TraceEvent[], recording: unknown, pid: number): RecorderAlignment {
  if (!recording) return { valid: false, reason: 'Recorder JSON unavailable' };
  const record = recordOf(recording) ?? {}, recorderEvents = arrayOf(record.events) ?? [];
  const [start, stop] = (['started', 'stopped'] as const).map(phase => {
    const name = `cssEarth:recording:${phase}`;
    const candidates = events.filter(e => e.pid === pid && isInstantPhase(e.ph) &&
      e.name === name && recordOf(detail(e))?.recordingId === record.id);
    const samples = recorderEvents.flatMap(value => {
      const e = recordOf(value);
      return e && e.name === name && recordOf(e.detail)?.recordingId === record.id ? [e] : [];
    });
    const time = samples[0]?.time;
    if (candidates.length !== 1 || samples.length !== 1 || !isFiniteNumber(time)) return null;
    return { phase, traceUs: candidates[0].ts, recorderMs: time,
      offsetUs: candidates[0].ts - time * 1000 };
  });
  if (!start || !stop) return { valid: false, reason: 'Missing, duplicate or mismatched recorder anchors', recordingId: record.id, anchors: [start, stop] };
  const anchors = [start, stop];
  const driftUs = stop.offsetUs - start.offsetUs;
  const valid = anchors.every(a => Number.isFinite(a.traceUs)) && stop.traceUs > start.traceUs && stop.recorderMs > start.recorderMs && Math.abs(driftUs) < 1000;
  return { valid, recordingId: record.id, anchors, driftUs,
    reason: valid ? 'Trace and recorder IDs and both clock anchors match' : 'Recorder order or clock drift is invalid' };
}

export interface CaptureReceipt { file: string; bytes: number; sha256: string }
export interface CaptureVideo { file: string; traceOriginUs: number; alignment: string }
export interface CaptureProtocol {
  browser: unknown; viewport: unknown; dpr: unknown; scenario: unknown; route: unknown; settings: unknown;
  invalidationTracking: unknown; recorder: true; screencast: boolean; inputs: Record<string, unknown>[];
}
export interface MatchedCaptureSummary {
  available: true; directory: string; status: 'invalid' | 'matched capture'; errors: unknown[];
  alignment: RecorderAlignment; traceCompleteness: string; protocol: CaptureProtocol;
  diagnosticOverrides: { cssSha256: string } | null; retained: unknown; artifacts: CaptureReceipt[]; video: CaptureVideo | null;
}
export interface TraceOnlySummary {
  available: false; status: 'trace-only'; traceCompleteness: string;
  directory?: undefined; errors?: undefined; alignment?: undefined; protocol?: undefined; diagnosticOverrides?: undefined; video?: undefined;
}
export type CaptureSummary = MatchedCaptureSummary | TraceOnlySummary;
export interface RecorderState {
  ageMs: number; stale: boolean; relation: string; sampleTimeMs: number;
  active: unknown; selected: unknown; overview: unknown; mountedObjects: unknown; lifecycle: unknown; playback: unknown;
  worldFrames: unknown; framePublication: unknown; camera: { distanceKilometers: unknown; levelOfDetail: unknown } | null;
  resources: unknown; geometry: unknown; worldPoints: unknown;
}
export interface CaptureEvidence {
  summary: CaptureSummary; snapshots: DomSnapshot[];
  /** The capture's loadedFiles manifest, checked per file by the source inspection. */
  expectedSources: unknown;
  stateAt(traceUs: number): RecorderState | null;
  servedDirectory?: string | null;
}

export async function readCapture(input: string, events: readonly TraceEvent[], selection: TraceSelection, explicitDirectory?: string): Promise<CaptureEvidence> {
  const directory = resolve(explicitDirectory ?? dirname(input)), receipts: CaptureReceipt[] = [];
  async function read(name: string): Promise<unknown> {
    try {
      const file = resolve(directory, name), bytes = await readFile(file);
      const value: unknown = JSON.parse(bytes.toString());
      receipts.push({ file, bytes: bytes.length, sha256: sha256(bytes) }); return value;
    } catch (e) { if (hasErrorCode(e, 'ENOENT')) return null; throw Error(`Cannot read capture ${name}: ${errorMessage(e)}`); }
  }
  const report = recordOf(await read('report.json'));
  if (!report?.loadedFiles || !Array.isArray(report.milestones)) {
    if (explicitDirectory) throw Error('Capture directory has no cssEarth capture report.json.');
    return { summary: { available: false, status: 'trace-only', traceCompleteness: 'unknown; complete JSON is not proof of a complete recording' }, snapshots: [], expectedSources: {}, stateAt: () => null };
  }
  const ids = new Set(events.filter(e => e.pid === selection.rendererPid && e.name === 'cssEarth:recording:started').map(e => recordOf(detail(e))?.recordingId).filter(Boolean));
  const files = (await readdir(directory)).filter(f => /^cssearth-diagnostics-.*\.json$/.test(f));
  let recording: unknown = null;
  for (const name of files) if (ids.has(name.slice('cssearth-diagnostics-'.length, -5))) {
    if (recording) throw Error('Multiple matching recorders in capture directory.');
    recording = await read(name);
  }
  const alignment = alignRecorder(events, recording, selection.rendererPid);
  const recorded: JsonRecord = recordOf(recording) ?? {};
  const receipt = await read('synchronization.json');
  // A present receipt of the wrong JSON type has none of the fields checked below.
  const sync: JsonRecord | null = receipt ? recordOf(receipt) ?? {} : null;
  const errors: unknown[] = [...(arrayOf(report.errors) ?? [])];
  if (!alignment.valid) errors.push(alignment.reason);
  if (report.traceDataLoss === true) errors.push('Chrome reported trace buffer data loss');
  if (sync && (!sync.valid || sync.recordingId !== recorded.id)) errors.push('Capture synchronization receipt is invalid or belongs to another recording');
  const syncAnchors = sync?.anchors;
  if (alignment.valid && syncAnchors && alignment.anchors.some(a => !(arrayOf(syncAnchors) ?? []).some(value => {
    const s = recordOf(value) ?? {};
    return s.phase === a.phase && Math.abs(Number(s.traceUs) - a.traceUs) < 1 && Math.abs(Number(s.recorderMs) - a.recorderMs) < .001;
  })))
    errors.push('Synchronization receipt clock anchors differ from trace and recorder');
  const matched = alignment.valid && !errors.length;
  const summary: MatchedCaptureSummary = { available: true, directory, status: errors.length ? 'invalid' : 'matched capture', errors,
    alignment, traceCompleteness: report.traceDataLoss === false ? 'Chrome reported no data loss' : report.traceDataLoss === true ? 'Chrome reported data loss' : 'unknown',
    protocol: { browser: report.browser ?? null, viewport: report.viewport ?? null, dpr: report.dpr ?? null,
      scenario: report.scenario ?? null, route: report.route ?? null, settings: report.settings ?? null,
      invalidationTracking: report.invalidationTracking ?? null, recorder: true, screencast: report.videoEnabled !== false,
      inputs: (arrayOf(report.inputs) ?? []).map(value => {
        const { type, phase, deltaY, packets, intervalMs, id, pass, wheelPackets, from, to, steps } = recordOf(value) ?? {};
        return { type, phase, deltaY, packets, intervalMs, id, pass, wheelPackets, from, to, steps };
      }) },
    diagnosticOverrides: report.probeCss ? { cssSha256: sha256(Buffer.from(requireString(report.probeCss, 'Capture probeCss'))) } : null,
    retained: report.retained ?? null, artifacts: receipts, video: null };
  const snapshots: DomSnapshot[] = [];
  if (matched && report.domSnapshot) for (const name of ['dom-before.json', 'dom-after.json']) {
    const snapshot = await read(name); if (snapshot) snapshots.push({ name, snapshot });
  }
  const videoOrigin = sync?.videoTimeOriginRecorderMs;
  if (matched && alignment.valid && sync?.valid && isFiniteNumber(videoOrigin)) {
    const file = resolve(directory, 'journey.mp4');
    if (await stat(file).then(s => s.isFile()).catch(() => false)) summary.video = {
      file, traceOriginUs: alignment.anchors[0].offsetUs + videoOrigin * 1000,
      alignment: 'capture clock metadata; video pixels are not decoded by this processor',
    };
  }
  const samples = alignment.valid ? (arrayOf(recorded.samples) ?? []).flatMap(value => {
    const sample = recordOf(value);
    return sample && isFiniteNumber(sample.time) ? [{ time: sample.time, state: sample.state }] : [];
  }).sort((a, b) => a.time - b.time) : [];
  const stateAt = (traceUs: number): RecorderState | null => {
    if (!matched || !alignment.valid || traceUs < alignment.anchors[0].traceUs || traceUs > alignment.anchors[1].traceUs) return null;
    const time = (traceUs - alignment.anchors[0].offsetUs) / 1000;
    let lo = 0, hi = samples.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (samples[mid].time <= time) lo = mid + 1; else hi = mid; }
    const sample = samples[lo - 1]; if (!sample) return null;
    const state = recordOf(sample.state) ?? {}, ageMs = Math.round((time - sample.time) * 1000) / 1000;
    const publication = state.framePublication, view = state.view;
    return { ageMs, stale: ageMs > Math.max(500, Number(recordOf(recorded.metadata)?.sampleIntervalMs ?? 100) * 2),
      relation: 'latest preceding recorder sample, not exact frame state', sampleTimeMs: sample.time,
      active: state.active, selected: state.selected, overview: state.overview, mountedObjects: state.mountedObjects,
      lifecycle: state.lifecycle, playback: state.playback, worldFrames: state.worldFrames,
      framePublication: publication && { requestedRevision: recordOf(publication)?.requestedRevision,
        presentedRevision: recordOf(publication)?.presentedRevision },
      camera: view ? { distanceKilometers: recordOf(view)?.distanceKilometers, levelOfDetail: recordOf(view)?.levelOfDetail } : null,
      resources: state.resources ?? null, geometry: state.geometry ?? null, worldPoints: state.worldPoints ?? null };
  };
  const served = resolve(directory, 'served');
  return { summary, snapshots, stateAt, expectedSources: matched ? report.loadedFiles : {},
    servedDirectory: matched && await stat(served).then(s => s.isDirectory()).catch(() => false) ? served : null };
}

export interface ComparisonMetric { name: string; before: number | null; after: number | null; change: number | null }
export interface CaptureComparison { trace: unknown; sha256: unknown; comparability: string; reasons: string[]; metrics: ComparisonMetric[] }

/** Either brief may come from an earlier agent-brief.json, so both are read as external JSON. */
export function compareCaptures(before: unknown, after: unknown): CaptureComparison {
  const older = recordOf(before) ?? {}, newer = recordOf(after) ?? {};
  const olderCapture = recordOf(older.capture), newerCapture = recordOf(newer.capture);
  const reasons: string[] = [], a = recordOf(olderCapture?.protocol), b = recordOf(newerCapture?.protocol);
  if (!a || !b) reasons.push('At least one trace has no matched capture protocol; manual journeys may differ.');
  else for (const key of ['browser', 'viewport', 'dpr', 'scenario', 'route', 'settings', 'invalidationTracking', 'recorder', 'screencast', 'inputs']) {
    if (a[key] == null || b[key] == null || JSON.stringify(a[key]) !== JSON.stringify(b[key])) reasons.push(`${key} differs or is unavailable`);
  }
  if (olderCapture?.status === 'invalid' || newerCapture?.status === 'invalid') reasons.push('One capture failed integrity validation.');
  if (olderCapture?.diagnosticOverrides || newerCapture?.diagnosticOverrides) reasons.push('Diagnostic CSS was injected; this is an experiment, not a served candidate.');
  const rows: ComparisonMetric[] = [];
  const add = (name: string, x: unknown, y: unknown) => rows.push({ name, before: isFiniteNumber(x) ? Math.round(x * 1000) / 1000 : null, after: isFiniteNumber(y) ? Math.round(y * 1000) / 1000 : null,
    change: isFiniteNumber(x) && isFiniteNumber(y) ? Math.round((y - x) * 1000) / 1000 : null });
  for (const key of ['p50Ms', 'p95Ms', 'p99Ms', 'maxMs']) add(key, recordOf(older.presentation)?.[key], recordOf(newer.presentation)?.[key]);
  // Division coerces operands exactly as Number() does.
  const rate = (brief: JsonRecord, kind: string) => Number(recordOf(recordOf(recordOf(brief.costs)?.total)?.exclusiveMs)?.[kind]) /
    (Number(recordOf(brief.window)?.durationMs) / 1000);
  for (const kind of ['script', 'style', 'layout', 'paint', 'layers', 'gc']) add(`${kind} ms/s`, rate(older, kind), rate(newer, kind));
  const olderSeries = recordOf(older.averageSeries), newerSeries = recordOf(newer.averageSeries), olderInput = recordOf(older.input);
  if (olderSeries?.source !== newerSeries?.source) reasons.push('Presentation signal source differs (for example actual presentation versus DrawFrame fallback).');
  return { trace: olderSeries?.label ?? olderInput?.name ?? 'baseline', sha256: olderInput?.sha256 ?? null,
    comparability: reasons.length ? 'descriptive only' : 'same recorded protocol; not statistical proof', reasons, metrics: rows };
}
