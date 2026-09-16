/** Historical star-removal API; operation-specific defaults remain at this adapter. */
import { createProcessingJobs } from '@cssearth/nebula-lab/server/jobs';
import { processingJobsHandler } from '@cssearth/nebula-lab/server/job-routes';
import type { RemovalRequest } from '../../features/star-removal/star-removal-types.ts';
export type { ProcessingJob as RemovalJob } from '@cssearth/nebula-lab/server/jobs';
export function createStarRemovalJobs<Request extends { imageId: string; action: string } = RemovalRequest>(
  root: string, options: Omit<Parameters<typeof createProcessingJobs<Request>>[1], 'requestKey'>) {
  const namespace = options.namespace ?? 'star-removal-nox';
  return createProcessingJobs(root, { ...options, namespace,
    requestKey: request => request.imageId,
    parseRequest(input) {
      const request = options.parseRequest(input);
      if (request.action !== 'apply') throw new TypeError('Only explicit Apply requests create durable jobs.');
      return request;
    }, label: options.label ?? 'Star removal',
    schema: namespace === 'star-removal-nox' ? 'cssearth-star-removal-job@1' : `cssearth-${namespace}-job@1` });
}
export function starRemovalJobsHandler(jobs: ReturnType<typeof createStarRemovalJobs>, prefix = '/__nebula/star-removal-jobs') {
  return processingJobsHandler(jobs, prefix);
}
