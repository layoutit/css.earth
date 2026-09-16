import { runProcessingWorker } from '@cssearth/nebula-lab/server/worker';
import type { Plugin } from 'vite';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../jobs/operation-jobs.ts';
import { readJointRequest, jointRecord, type JointRequest } from '../../features/joint-fit/model.ts';
import { readJointResult, type JointResult } from '../../features/joint-fit/result.ts';
import { validateJointResult } from '../workflows/joint-fit/prepare.ts';
async function worker(root: string, request: JointRequest, signal: AbortSignal, progress: (message: string) => void) {
  return runProcessingWorker({ root, request, signal, name: 'joint-fit',
    entry: 'labs/nebula/packages/lab/src/server/workers/joint-fit.ts',
    readResult: readJointResult,
    onProgress(event) { if (typeof event.message === 'string') progress(event.message); },
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
