import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createProcessingJobs } from '../jobs/service.ts';
import { HttpError, jobErrorMessage as message } from '../jobs/protocol.ts';

export function processingJobsHandler(jobs: ReturnType<typeof createProcessingJobs>, prefix: string) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    const reply = (status: number, body: unknown) => {
      if (response.destroyed) return;
      response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify(body));
    };
    try {
      if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new TypeError('Expected a local request.');
      const pathname = (request.url ?? '').split('?')[0];
      const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
      const match = /^\/([^/]+)(\/cancel)?$/.exec(path);
      if (request.method === 'GET' && match && !match[2]) { reply(200, { job: await jobs.get(match[1]) }); return; }
      if (request.method !== 'POST') throw new HttpError(405, 'Use POST to start or cancel a job, or GET for its status.');
      if (!request.headers['content-type']?.startsWith('application/json')) throw new TypeError('Expected a local JSON request.');
      let body = ''; for await (const chunk of request) { body += chunk.toString(); if (body.length > 16384) throw new TypeError('Apply request is too large.'); }
      if (match?.[2]) { reply(200, { job: await jobs.cancel(match[1]) }); return; }
      if (path !== '' && path !== '/') throw new HttpError(404, 'Unknown processing job endpoint.');
      reply(202, { job: await jobs.start(JSON.parse(body)) });
    } catch (error) { reply(error instanceof HttpError ? error.status : error instanceof TypeError || error instanceof SyntaxError ? 400 : 500, { error: message(error) }); }
  };
}
