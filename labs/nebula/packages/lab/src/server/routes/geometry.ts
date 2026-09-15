import { runProcessingWorker } from '../workers/run.ts';
import type { Plugin } from 'vite';
import { createStarRemovalJobs, starRemovalJobsHandler } from '../jobs/operation-jobs.ts';
import { readDetectionRequest, readDetectionResult, geometryRecord, type DetectionRequest, type DetectionResult } from '../../features/geometry/jobs-model.ts';
import { validateDetectionResult, type DetectionProgress } from '../workflows/geometry/preparation.ts';

export async function runDetectionWorker(root: string, request: DetectionRequest, signal: AbortSignal, progress: (value: DetectionProgress) => void) {
  return runProcessingWorker({ root, request, signal, name: 'detection',
    entry: 'labs/nebula/packages/lab/src/server/workers/detection.ts', readResult: readDetectionResult,
    onProgress(event) {
      if (typeof event.stage === 'string' && typeof event.message === 'string' &&
          typeof event.current === 'number' && Number.isFinite(event.current) && event.current >= 0 &&
          typeof event.total === 'number' && Number.isFinite(event.total) && event.total > 0)
        progress({ stage: event.stage, current: event.current, total: event.total, message: event.message });
    },
  });
}

export function createDetectionJobs(root: string) {
  let queue = Promise.resolve();
  return createStarRemovalJobs<DetectionRequest>(root, { namespace: 'geometry-detection', label: 'Shape detection', parseRequest: readDetectionRequest,
    history: { maxRecords: 128, retainPerImage: 4, preferred: request => request.quality !== 'draft' },
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
