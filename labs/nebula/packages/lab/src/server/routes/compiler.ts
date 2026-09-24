import { runProcessingWorker } from '@cssearth/nebula-lab/server/worker';
import type { Plugin } from 'vite';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../jobs/operation-jobs.ts';
import { readCompilerRequest, type CompilerRequest } from '../../features/compiler/model.ts';
import { readCompilerResult } from '../../features/compiler/result.ts';
import { validateCompilerResult } from '../workflows/compiler/bank-validation.ts';
async function worker(root: string, request: CompilerRequest, signal: AbortSignal, progress: (message: string, fraction: number) => void) {
  return runProcessingWorker({ root, request, signal, name: 'compiler',
    entry: 'labs/nebula/packages/lab/src/server/workers/compiler.ts',
    readResult: readCompilerResult, terminateGroup: true,
    onProgress(event) { if (typeof event.message === 'string') progress(event.message, typeof event.fraction === 'number' ? event.fraction : 0); },
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
