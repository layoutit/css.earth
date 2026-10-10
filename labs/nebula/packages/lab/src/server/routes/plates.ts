import { isRecord } from '@cssearth/core';
import { createProcessingJobs } from '@cssearth/nebula-lab/server/jobs';
import { processingJobsHandler } from '@cssearth/nebula-lab/server/job-routes';
import { execFile } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Plugin } from 'vite';
import { configuredPlateObjects, platePublished, readPlateBakeRequest, verifyPlateBank, type PlateBakeRequest } from '../workflows/plates/bake.ts';
import { bakeObject, objectIdOf } from '../workflows/plates/object-bake.ts';
import { progressTail } from '../workflows/plates/progress.ts';
import { configuredLabObjects } from '../workflows/lab-objects.ts';
import { plateStatus, verifyObject } from '../workflows/plates/verify.ts';
import { discardWorkingCopy, editWorkingCopy, readRecipeState, saveWorkingCopy } from '../workflows/plates/working-copy.ts';
import { readPlateBakeReceipt } from '../../features/plates/plates-receipt.ts';
import { platePhotographCorners } from '../workflows/plates/photograph-corners.ts';
import { candidatePictureCorners, candidatePictures } from '../workflows/plates/candidate-pictures.ts';
import { candidateModel, candidateModels, candidateModelTexture } from '../workflows/plates/candidate-models.ts';

/** Plate jobs (one queue, the site's commands), the tracked recipe's edits, and each object's ready-to-ship readout. */
export function platesPlugin(root: string): Plugin {
  return { name: 'nebula-plates', configureServer(server) {
    let queue = Promise.resolve();
    const configured = configuredPlateObjects(root);
    const jobs = createProcessingJobs<PlateBakeRequest>(root, { namespace: 'plates', label: 'Plate bake', schema: 'cssearth-plates-job@2',
      requestKey: request => request.imageId, parseRequest: input => readPlateBakeRequest(input, configured),
      history: { maxRecords: 64, retainPerImage: 4, preferred: () => true },
      sample(request, signal, progress) {
        // The same entry as the CLI's `bake <id> [--draft]`: it also writes the object's progress file.
        const task = queue.then(() => bakeObject(root, objectIdOf(request.object), request.quality, signal,
          (message, fraction) => progress({ stage: 'plates', message, current: Math.round(Math.max(0, Math.min(1, fraction)) * 100), total: 100 })));
        queue = task.then(() => {}, () => {}); return task;
      },
      async validateResult(result) { const receipt = readPlateBakeReceipt(result); await verifyPlateBank(resolve(root, receipt.directory)); } });
    const handler = processingJobsHandler(jobs, '/__nebula/plate-jobs');
    server.middlewares.use('/__nebula/plate-jobs', (request, response) => { void handler(request, response); });
    const reply = (response: ServerResponse, status: number, body: unknown) => {
      response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(body));
    };
    const objectOf = (url: string | undefined) => {
      const object = new URL(url ?? '', 'http://lab').searchParams.get('object');
      if (!object || !configured.includes(object)) throw new TypeError('Name a configured published-plates object.');
      return object;
    };
    const local = (request: IncomingMessage) => { if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new TypeError('Expected a local request.'); };
    server.middlewares.use('/__nebula/plate-status', (request, response) => {
      void (async () => { try { local(request); reply(response, 200, await plateStatus(root, objectOf(request.url))); } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); } })();
    });
    // `verify <id>`: the same checks the CLI runs (bank, inventory, git, working copy, draft).
    server.middlewares.use('/__nebula/plate-verify', (request, response) => {
      void (async () => { try { local(request); reply(response, 200, await verifyObject(root, objectIdOf(objectOf(request.url)))); } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); } })();
    });
    server.middlewares.use('/__nebula/plate-published', (request, response) => {
      void (async () => { try { local(request); reply(response, 200, await platePublished(root, objectOf(request.url))); } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); } })();
    });
    // The photograph the Original control shows, in the bake's own sky frame: its file and its corners' sight lines.
    server.middlewares.use('/__nebula/plate-original', (request, response) => {
      void (async () => {
        try {
          local(request);
          const params = new URL(request.url ?? '', 'http://lab').searchParams, picture = params.get('picture'), object = objectOf(request.url);
          if (picture === 'candidate') {
            // A lab candidate picture (ignored scratch), laid by its own WCS.
            const id = params.get('candidate') ?? '';
            reply(response, 200, await candidatePictureCorners(root, object, id, async () => (await platePhotographCorners(resolve(root, object), 'original')).corners));
            return;
          }
          if (picture !== 'original' && picture !== 'starless') throw new TypeError('Name the picture: original, starless or candidate.');
          reply(response, 200, await platePhotographCorners(resolve(root, object), picture));
        } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); }
      })();
    });
    // The lab's candidate comparison pictures for an object (ignored scratch), listed for the Original control.
    server.middlewares.use('/__nebula/plate-candidates', (request, response) => {
      void (async () => { try { local(request); reply(response, 200, await candidatePictures(root, objectOf(request.url)) ?? { candidates: [] }); } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); } })();
    });
    // The lab's published 3D models for an object (ignored scratch): the list, and one model's places.
    server.middlewares.use('/__nebula/plate-candidate-models', (request, response) => {
      void (async () => { try { local(request); reply(response, 200, await candidateModels(root, objectOf(request.url))); } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); } })();
    });
    server.middlewares.use('/__nebula/plate-candidate-model', (request, response) => {
      void (async () => {
        try { local(request); reply(response, 200, await candidateModel(root, objectOf(request.url), new URL(request.url ?? '', 'http://lab').searchParams.get('id') ?? '')); }
        catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); }
      })();
    });
    server.middlewares.use('/__nebula/plate-candidate-texture', (request, response) => {
      void (async () => {
        try {
          local(request);
          const params = new URL(request.url ?? '', 'http://lab').searchParams, part = params.get('part') === 'png' ? 'png' : 'json';
          const bytes = await candidateModelTexture(root, objectOf(request.url), params.get('id') ?? '', params.get('texture') ?? '', part);
          response.statusCode = 200; response.setHeader('Content-Type', part === 'png' ? 'image/png' : 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(bytes);
        } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); }
      })();
    });
    // Every lab command's progress (CLI or UI), tailed from each object's `.local/lab/progress.jsonl`.
    // Every lab object's file: plates, and the volumes `research`, `model` and `stars` write to as well.
    const tail = progressTail(root, () => configuredLabObjects(root).map(item => item.id));
    server.middlewares.use('/__nebula/lab-progress', (request, response) => {
      void (async () => { try { local(request); reply(response, 200, { jobs: await tail() }); } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); } })();
    });
    // The recipe the lab edits is a working copy (`src/objects/<id>/.local/lab/recipe.json`): edits, Undo and the
    // geometry resets write it; `save` writes its changes into the tracked recipe; `discard` (or `reset`) drops it;
    // `committed` reads the committed recipe without writing. Every answer is the recipe shown and its unsaved changes.
    server.middlewares.use('/__nebula/plate-recipe', (request, response) => {
      void (async () => {
        try {
          local(request);
          if (request.method !== 'POST' || !request.headers['content-type']?.startsWith('application/json')) throw new TypeError('POST a JSON edit.');
          let text = ''; for await (const chunk of request) { text += String(chunk); if (text.length > 65536) throw new TypeError('Edit is too large.'); }
          const body: unknown = JSON.parse(text);
          if (!isRecord(body) || typeof body.object !== 'string' || !configured.includes(body.object)) throw new TypeError('Name a configured published-plates object.');
          const id = objectIdOf(body.object);
          const number = (edit: unknown): edit is { path: string; value: number } => isRecord(edit) && typeof edit.path === 'string' &&
            /^geometry(?:\.[A-Za-z0-9]+)+$/.test(edit.path) && typeof edit.value === 'number';
          if (body.committed === true) {
            const { stdout } = await promisify(execFile)('git', ['show', `HEAD:${body.object}/source/recipe.json`], { cwd: root, maxBuffer: 1 << 24 });
            reply(response, 200, JSON.parse(stdout)); return;
          }
          if (Array.isArray(body.edits)) {
            if (!body.edits.every(number)) throw new TypeError('Each edit names a number under geometry and its new value.');
            await editWorkingCopy(root, id, body.edits as { path: string; value: number }[]);
          } else if (body.save === true) await saveWorkingCopy(root, id);
          else if (body.discard === true || body.reset === true) await discardWorkingCopy(root, id);
          else if (body.read !== true) {
            if (!number(body)) throw new TypeError('An edit names a number under geometry and its new value.');
            await editWorkingCopy(root, id, [{ path: body.path, value: body.value }]);
          }
          reply(response, 200, await readRecipeState(root, id));
        } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); }
      })();
    });
    server.httpServer?.once('close', () => { void jobs.shutdown().catch(() => {}); });
  } };
}
