import { readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export async function synchronizeCapture(output) {
  const report = JSON.parse(await readFile(output + '/report.json'));
  const frames = JSON.parse(await readFile(output + '/video-chronological-frames.json'));
  const { readdir } = await import('node:fs/promises');
  const filename = (await readdir(output)).find(f => f.startsWith('cssearth-diagnostics-'));
  const recording = JSON.parse(await readFile(output + '/' + filename));
  const events = [];
  // CDP emits one event per line. Keep the original gzip intact and avoid V8's
  // 512 MiB string ceiling when correlating long, detailed captures.
  for await (const line of createInterface({ input: createReadStream(output + '/trace.json.gz').pipe(createGunzip()), crlfDelay: Infinity })) {
    if (!line.includes('cssEarth:recording:')) continue;
    try { const event = JSON.parse(line.trim().replace(/,$/, '')); if (event.name?.startsWith('cssEarth:recording:')) events.push(event); } catch {}
  }
  const anchors = ['started', 'stopped'].map(phase => {
    const name = `cssEarth:recording:${phase}`, e = events.find(e => e.name === name && e.ph !== 'E'), r = recording.events.find(e => e.name === name);
    if (!e || !r) return null;
    return { phase, traceUs: e.ts, recorderMs: r.time, offset: e.ts - r.time * 1000, pid: e.pid };
  });
  if (anchors.some(anchor => !anchor)) {
    const invalid = { valid: false, reason: 'Missing synchronization anchor', recordingId: recording.id,
      anchors, traceDataLoss: report.traceDataLoss, errors: report.errors };
    await writeFile(output + '/synchronization.json', JSON.stringify(invalid, null, 2));
    return invalid;
  }
  const pts = JSON.parse(execFileSync('/opt/homebrew/bin/ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_entries',
    'frame=pts_time', '-of', 'json', output + '/journey.mp4'], { maxBuffer: 20e6 })).frames.map(f => Number(f.pts_time));
  const sync = { video: 'journey.mp4', recordingId: recording.id, anchors,
    videoTimeOriginRecorderMs: frames[0].recorderMs, clockDriftUs: anchors[1].offset - anchors[0].offset,
    maxPtsErrorMs: Math.max(...frames.map((f, i) => Math.abs(pts[i] * 1000 - f.recorderMs + frames[0].recorderMs))),
    videoFrames: frames.length, encodedFrames: pts.length, traceDataLoss: report.traceDataLoss, errors: report.errors,
    limitations: ['Recorder and screencast add overhead.', 'Video observations and presentation intervals do not count every physical refresh.',
      'Cold means first destination visits after Sun startup; warm repeats in the same document with natural camera continuity.'] };
  sync.valid = Math.abs(sync.clockDriftUs) < 1000 && sync.maxPtsErrorMs < 2 && pts.length === frames.length && !sync.traceDataLoss &&
    !report.errors.length && report.retained?.world && report.retained?.input && report.retained?.document && report.retained?.cameras === 1;
  await writeFile(output + '/synchronization.json', JSON.stringify(sync, null, 2)); return sync;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const sync = await synchronizeCapture(resolve(process.argv[2])); console.log(JSON.stringify(sync)); if (!sync.valid) process.exitCode = 1;
}
