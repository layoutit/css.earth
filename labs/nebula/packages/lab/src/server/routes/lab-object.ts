/** The Research, Model and Stars steps' reads, and the buttons that run their CLI commands. A button never runs lab
 * code of its own: it starts `labs/nebula/run.mts research|model|stars <id>`, the same process an agent starts, and
 * the progress strip shows it from the object's `.local/lab/progress.jsonl`. */
import { isRecord } from '@cssearth/core';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { configuredLabObjects, type LabObject } from '../workflows/lab-objects.ts';
import { readResearchRecord, researchPath, MODEL_METHODS, type ModelMethod } from '../workflows/research/research.ts';
import { modelPath, readLabModel } from '../workflows/model/model-output.ts';
import { objectStarPoints } from '../workflows/stars/object-stars.ts';

export type LabCommand = 'research' | 'model' | 'stars';
/** The CLI arguments a button runs: only the three commands, one configured object, a known method. */
export function labRunArguments(value: unknown, objects: readonly LabObject[]): string[] {
  if (!isRecord(value) || !['research', 'model', 'stars'].includes(value.command as string) || typeof value.object !== 'string' || !objects.some(item => item.id === value.object))
    throw new TypeError('Run research, model or stars on a configured lab object.');
  if (value.command !== 'model') { if (value.method !== undefined) throw new TypeError('Only model takes a method.'); return [value.command as string, value.object]; }
  if (!(MODEL_METHODS as readonly unknown[]).includes(value.method)) throw new TypeError(`model needs --method ${MODEL_METHODS.join('|')}.`);
  return ['model', value.object, '--method', value.method as string];
}

export function labObjectPlugin(root: string): Plugin {
  return { name: 'nebula-lab-object', configureServer(server) {
    const objects = () => configuredLabObjects(root);
    const running = new Map<string, number>();
    const reply = (response: ServerResponse, status: number, body: unknown) => {
      response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(body));
    };
    const local = (request: IncomingMessage) => { if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new TypeError('Expected a local request.'); };
    const objectOf = (request: IncomingMessage) => {
      const id = new URL(request.url ?? '', 'http://lab').searchParams.get('object'), found = objects().find(item => item.id === id);
      if (!found) throw new TypeError('Name a configured lab object (?object=<src/objects folder>).');
      return found;
    };
    const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
    const route = (path: string, handle: (request: IncomingMessage) => Promise<unknown>) => server.middlewares.use(path, (request, response) => {
      void (async () => { try { local(request); reply(response, 200, await handle(request)); } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); } })();
    });
    route('/__nebula/research', async request => {
      const object = objectOf(request);
      try { return { record: readResearchRecord(JSON.parse(await readFile(researchPath(root, object), 'utf8'))) }; }
      catch (error) { if (missing(error)) return { missing: `run.mts research ${object.id}` }; throw error; }
    });
    // Each method's last result, so the Model tab offers the methods already run and the one to run.
    route('/__nebula/model', async request => {
      const object = objectOf(request), results: Partial<Record<ModelMethod, unknown>> = {};
      for (const method of MODEL_METHODS) {
        try { results[method] = readLabModel(JSON.parse(await readFile(modelPath(root, object.id, method), 'utf8'))); }
        catch (error) { if (!missing(error)) results[method] = { error: String(error instanceof Error ? error.message : error) }; }
      }
      return { results };
    });
    route('/__nebula/stars', async request => {
      const object = objectOf(request), stars = await objectStarPoints(root, object);
      return stars ? { points: { frame: stars.frame, points: stars.points }, count: stars.count } : { missing: `run.mts stars ${object.id}` };
    });
    server.middlewares.use('/__nebula/lab-run', (request, response) => {
      void (async () => {
        try {
          local(request);
          if (request.method !== 'POST' || !request.headers['content-type']?.startsWith('application/json')) throw new TypeError('POST a JSON command.');
          let text = ''; for await (const chunk of request) { text += String(chunk); if (text.length > 4096) throw new TypeError('Command is too large.'); }
          const args = labRunArguments(JSON.parse(text), objects()), key = args.slice(0, 2).join(' ');
          const previous = running.get(key);
          if (previous) { try { process.kill(previous, 0); reply(response, 409, { error: `${key} is already running.`, pid: previous }); return; } catch { running.delete(key); } }
          // Detached and silent: its progress goes to the object's progress file, which the strip tails.
          const child = spawn(process.execPath, [resolve(root, 'labs/nebula/run.mts'), ...args], { cwd: root, detached: true, stdio: 'ignore' });
          child.unref();
          if (child.pid) { running.set(key, child.pid); child.once('exit', () => { if (running.get(key) === child.pid) running.delete(key); }); }
          reply(response, 202, { started: args, pid: child.pid });
        } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); }
      })();
    });
  } };
}
