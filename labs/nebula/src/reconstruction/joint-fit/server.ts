import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import type { Plugin } from 'vite';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../../utils/processing-jobs';
import { readJointRequest, jointRecord, type JointRequest } from './model';
import { readJointResult, type JointResult } from './result';
import { validateJointResult } from './prepare';
async function worker(root: string, request: JointRequest, signal: AbortSignal, progress: (message: string) => void) {
  signal.throwIfAborted();
  const require = createRequire(resolve(root, 'packages/engine/package.json'));
  const { build } = createRequire(require.resolve('tsup'))('esbuild');
  const outfile = resolve(root, '.local/nebula-lab/compiled/joint-fit-worker.mjs');
  await build({ entryPoints: [resolve(root, 'labs/nebula/src/reconstruction/joint-fit/worker.ts')], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external' });
  signal.throwIfAborted();
  return new Promise<JointResult>((done, reject) => {
    const child = spawn(process.execPath, [outfile], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
    let buffered = '', errors = '', completed: JointResult | undefined;
    const abort = () => child.kill('SIGKILL'); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
    child.stdout.on('data', (bytes: Buffer) => {
      buffered += bytes.toString(); const lines = buffered.split('\n'); buffered = lines.pop()!;
      for (const line of lines) try { const v: unknown = JSON.parse(line); if (!jointRecord(v)) continue;
        if (v.type === 'complete') completed = readJointResult(v.result); if (v.type === 'progress' && typeof v.message === 'string') progress(v.message);
      } catch { /* A valid completion remains mandatory. */ }
    });
    child.stderr.on('data', (bytes: Buffer) => { errors = (errors + bytes.toString()).slice(-4096); });
    child.once('error', error => { signal.removeEventListener('abort', abort); reject(error); });
    child.once('close', code => { signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(new DOMException('Joint fit cancelled.', 'AbortError'));
      else if (code !== 0 || !completed) reject(new Error(errors || 'Joint worker produced no completion.')); else done(completed);
    });
    child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify(request));
  });
}
export function jointFitPlugin(root: string): Plugin {
  return { name: 'nebula-joint-fit', configureServer(server) {
    let queue = Promise.resolve();
    const jobs = createStarRemovalJobs<JointRequest>(root, { namespace: 'joint-fit', label: 'Joint fit', parseRequest: readJointRequest,
      history: { maxRecords: 128, retainPerImage: 4, preferred: () => true },
      sample(request, signal, progress) { const task = queue.then(() => worker(root, request, signal, message => progress({ stage: 'joint-fit', message, current: 1, total: 1 })));
        queue = task.then(() => {}, () => {}); return task; }, validateResult: async value => { await validateJointResult(root, value); } });
    const handler = starRemovalJobsHandler(jobs, '/__nebula/joint-fit-jobs');
    server.middlewares.use('/__nebula/joint-fit-jobs', (request, response) => { void handler(request, response); });
    server.httpServer?.once('close', () => { void jobs.shutdown(); });
  } };
}
