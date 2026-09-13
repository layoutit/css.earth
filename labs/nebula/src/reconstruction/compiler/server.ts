import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import type { Plugin } from 'vite';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../../utils/processing-jobs';
import { jointRecord } from '../joint-fit/model';
import { readCompilerRequest, type CompilerRequest } from './model';
import { readCompilerResult, type CompilerResult } from './result';
import { validateCompilerResult } from './compile';
async function worker(root: string, request: CompilerRequest, signal: AbortSignal, progress: (message: string, fraction: number) => void) {
  signal.throwIfAborted(); const require = createRequire(resolve(root, 'packages/engine/package.json'));
  const { build } = createRequire(require.resolve('tsup'))('esbuild'), outfile = resolve(root, '.local/nebula-lab/compiled/compiler-worker.mjs');
  await build({ entryPoints: [resolve(root, 'labs/nebula/src/reconstruction/compiler/worker.ts')], outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external' });
  signal.throwIfAborted();
  return new Promise<CompilerResult>((accept, reject) => {
    const grouped = process.platform !== 'win32', child = spawn(process.execPath, [outfile], { cwd: root, detached: grouped, stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '', errors = '', completed: CompilerResult | undefined;
    const abort = () => { try { if (grouped && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { /* Already terminated. */ } };
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
    child.stdout.on('data', (data: Buffer) => { buffer += data.toString(); const lines = buffer.split('\n'); buffer = lines.pop()!;
      for (const line of lines) try { const value: unknown = JSON.parse(line); if (!jointRecord(value)) continue;
        if (value.type === 'complete') completed = readCompilerResult(value.result);
        if (value.type === 'progress' && typeof value.message === 'string') progress(value.message, typeof value.fraction === 'number' ? value.fraction : 0);
      } catch { /* Completion must parse and validate before publishing. */ }
    });
    child.stderr.on('data', (data: Buffer) => { errors = (errors + data.toString()).slice(-5000); });
    child.once('error', error => { signal.removeEventListener('abort', abort); reject(error); });
    child.once('close', code => { signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(new DOMException('Compiler cancelled.', 'AbortError'));
      else if (code !== 0 || !completed) reject(new Error(errors || 'Compiler produced no complete result.')); else accept(completed); });
    child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify(request));
  });
}
export function compilerPlugin(root: string): Plugin {
  return { name: 'nebula-compiler', configureServer(server) {
    let queue = Promise.resolve();
    const jobs = createStarRemovalJobs<CompilerRequest>(root, { namespace: 'compiler', label: 'Nebula compiler', parseRequest: readCompilerRequest,
      history: { maxRecords: 128, retainPerImage: 4, preferred: () => true },
      sample(request, signal, progress) { const task = queue.then(() => worker(root, request, signal,
        (message, fraction) => progress({ stage: 'compiler', message, current: Math.round(Math.max(0, Math.min(1, fraction)) * 100), total: 100 })));
        queue = task.then(() => {}, () => {}); return task; }, validateResult: async result => { await validateCompilerResult(root, result); } });
    const handler = starRemovalJobsHandler(jobs, '/__nebula/compiler-jobs');
    server.middlewares.use('/__nebula/compiler-jobs', (request, response) => { void handler(request, response); });
    server.httpServer?.once('close', () => { void jobs.shutdown(); });
  } };
}
