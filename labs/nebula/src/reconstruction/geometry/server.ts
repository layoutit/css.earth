import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import type { Plugin } from 'vite';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../../utils/processing-jobs.js';
import { readDetectionRequest, readDetectionResult, geometryRecord, type DetectionRequest, type DetectionResult } from './jobs-model.js';
import { validateDetectionResult, type DetectionProgress } from './preparation.js';

export async function runDetectionWorker(root: string, request: DetectionRequest, signal: AbortSignal, progress: (value: DetectionProgress) => void) {
  signal.throwIfAborted();
  const require = createRequire(resolve(root, 'packages/engine/package.json'));
  const { build } = createRequire(require.resolve('tsup'))('esbuild');
  const outfile = resolve(root, '.local/nebula-lab/compiled/detection-worker.mjs');
  await build({ entryPoints: [resolve(root, 'labs/nebula/src/reconstruction/geometry/detection-worker.ts')], outfile,
    bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external' });
  signal.throwIfAborted();
  return new Promise<DetectionResult>((done, reject) => {
    const child = spawn(process.execPath, [outfile], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
    let buffered = '', errors = '', completed: DetectionResult | undefined;
    const abort = () => child.kill('SIGKILL'); signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    child.stdout.on('data', (bytes: Buffer) => {
      buffered += bytes.toString(); const lines = buffered.split('\n'); buffered = lines.pop()!;
      for (const line of lines) try {
        const event: unknown = JSON.parse(line);
        if (!geometryRecord(event)) continue;
        if (event.type === 'complete') completed = readDetectionResult(event.result);
        if (event.type === 'progress' && typeof event.stage === 'string' && typeof event.message === 'string' &&
            typeof event.current === 'number' && Number.isFinite(event.current) && event.current >= 0 &&
            typeof event.total === 'number' && Number.isFinite(event.total) && event.total > 0)
          progress({ stage: event.stage, current: event.current, total: event.total, message: event.message });
      } catch { /* A malformed worker message cannot establish completion. */ }
    });
    child.stderr.on('data', (bytes: Buffer) => { errors = (errors + bytes.toString()).slice(-4096); });
    child.once('error', error => { signal.removeEventListener('abort', abort); reject(error); });
    child.once('close', code => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(new DOMException('Detection cancelled.', 'AbortError'));
      else if (code !== 0 || !completed) reject(new Error(errors || 'Detection produced no completion receipt.'));
      else done(completed);
    });
    child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify(request));
  });
}
export function createDetectionJobs(root: string) {
  let queue = Promise.resolve();
  return createStarRemovalJobs<DetectionRequest>(root, { namespace: 'geometry-detection', label: 'Shape detection', parseRequest: readDetectionRequest,
    history: { maxRecords: 128, retainPerImage: 4, preferred: () => true },
    sample(request, signal, progress) {
      const operation = queue.then(() => runDetectionWorker(root, request, signal, progress));
      queue = operation.then(() => {}, () => {}); return operation;
    }, validateResult: async value => { await validateDetectionResult(root, value); } });
}
export function geometryDetectionPlugin(root: string): Plugin {
  return { name: 'nebula-geometry-detection', configureServer(server) {
    const jobs = createDetectionJobs(root), handler = starRemovalJobsHandler(jobs, '/__nebula/geometry-jobs');
    server.middlewares.use('/__nebula/geometry-jobs', (request, response) => { void handler(request, response); });
    server.httpServer?.once('close', () => { void jobs.shutdown(); });
  } };
}
