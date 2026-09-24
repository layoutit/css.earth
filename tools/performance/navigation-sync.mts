import { readdir, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readJsonSource } from '../sources/source-values.mts';
import { requireArray, requireRecord } from '@cssearth/core';
import type { JsonRecord } from './trace-model.mts';
import { recordOf } from './trace-model.mts';

export interface SyncAnchor { phase: 'started' | 'stopped'; traceUs: unknown; recorderMs: unknown; offset: number; pid: unknown }

// Capture sidecars are external JSON. Arithmetic below converts recorded values
// exactly as the JavaScript operators do, via Number().
export async function synchronizeCapture(output: string) {
  const report = requireRecord(await readJsonSource(output + '/report.json'), 'Capture report');
  const frames = requireArray(await readJsonSource(output + '/video-chronological-frames.json'), 'Video frames')
    .map(frame => requireRecord(frame, 'Video frame'));
  const filename = (await readdir(output)).find(f => f.startsWith('cssearth-diagnostics-'));
  const recording = requireRecord(await readJsonSource(`${output}/${filename}`), 'Recorder JSON');
  const recorderEvents = requireArray(recording.events, 'Recorder events');
  const events: JsonRecord[] = [];
  // CDP emits one event per line. Keep the original gzip intact and avoid V8's
  // 512 MiB string ceiling when correlating long, detailed captures.
  for await (const line of createInterface({ input: createReadStream(output + '/trace.json.gz').pipe(createGunzip()), crlfDelay: Infinity })) {
    if (!line.includes('cssEarth:recording:')) continue;
    try {
      const event = recordOf(JSON.parse(line.trim().replace(/,$/, '')));
      if (event && typeof event.name === 'string' && event.name.startsWith('cssEarth:recording:')) events.push(event);
    } catch {}
  }
  const anchors = (['started', 'stopped'] as const).map((phase): SyncAnchor | null => {
    const name = `cssEarth:recording:${phase}`, e = events.find(e => e.name === name && e.ph !== 'E');
    const r = recorderEvents.map(value => requireRecord(value, 'Recorder event')).find(e => e.name === name);
    if (!e || !r) return null;
    return { phase, traceUs: e.ts, recorderMs: r.time, offset: Number(e.ts) - Number(r.time) * 1000, pid: e.pid };
  });
  const [start, stop] = anchors;
  if (!start || !stop) {
    const invalid = { valid: false, reason: 'Missing synchronization anchor', recordingId: recording.id,
      anchors, traceDataLoss: report.traceDataLoss, errors: report.errors };
    await writeFile(output + '/synchronization.json', JSON.stringify(invalid, null, 2));
    return invalid;
  }
  const probe = requireRecord(JSON.parse(execFileSync('/opt/homebrew/bin/ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_entries',
    'frame=pts_time', '-of', 'json', output + '/journey.mp4'], { maxBuffer: 20e6 }).toString()), 'ffprobe output');
  const pts = requireArray(probe.frames, 'ffprobe frames').map(f => Number(requireRecord(f, 'ffprobe frame').pts_time));
  const first = requireRecord(frames[0], 'First video frame');
  const retained = recordOf(report.retained);
  const sync = { video: 'journey.mp4', recordingId: recording.id, anchors,
    videoTimeOriginRecorderMs: first.recorderMs, clockDriftUs: stop.offset - start.offset,
    maxPtsErrorMs: Math.max(...frames.map((f, i) => Math.abs(Number(pts[i]) * 1000 - Number(f.recorderMs) + Number(first.recorderMs)))),
    videoFrames: frames.length, encodedFrames: pts.length, traceDataLoss: report.traceDataLoss, errors: report.errors,
    limitations: ['Recorder and screencast add overhead.', 'Video observations and presentation intervals do not count every physical refresh.',
      report.scenario === 'world-zoom'
        ? 'Sun startup completes before recording; same-document zoom-out and zoom-in inputs are listed in report.json.'
        : 'Cold means first destination visits after Sun startup; warm repeats in the same document with natural camera continuity.'] };
  const valid: unknown = Math.abs(sync.clockDriftUs) < 1000 && sync.maxPtsErrorMs < 2 && pts.length === frames.length && !sync.traceDataLoss &&
    !requireArray(report.errors, 'Capture report errors').length && retained?.world && retained?.input && retained?.document && retained?.cameras === 1;
  const result = Object.assign(sync, { valid });
  await writeFile(output + '/synchronization.json', JSON.stringify(result, null, 2)); return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = process.argv[2];
  if (directory === undefined) throw new TypeError('Provide the capture directory.');
  const sync = await synchronizeCapture(resolve(directory)); console.log(JSON.stringify(sync)); if (!sync.valid) process.exitCode = 1;
}
