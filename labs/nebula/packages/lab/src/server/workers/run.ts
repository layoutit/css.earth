/** Node worker transport. Domain adapters validate progress and completion payloads. */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { buildLabModule as build } from '../../cli/build.ts';

export interface WorkerOptions<Result> {
  root: string;
  entry: string;
  name: string;
  request: unknown;
  signal: AbortSignal;
  readResult: (value: unknown) => Result;
  /** Compatibility with historical workers whose complete payload is the event itself. */
  completionPayload?: 'event' | 'result';
  onProgress: (event: Record<string, unknown>) => void;
  terminateGroup?: boolean;
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export async function runProcessingWorker<Result>(options: WorkerOptions<Result>): Promise<Result> {
  const { root, signal, name } = options;
  if (!/^[a-z0-9-]+$/.test(name)) throw new TypeError('Invalid worker name.');
  signal.throwIfAborted();
  const outfile = resolve(root, `.local/nebula-lab/compiled/${name}-worker.mjs`);
  await build({ entryPoints: [resolve(root, options.entry)], outfile, bundle: true,
    platform: 'node', format: 'esm', target: 'node22', packages: 'external' });
  signal.throwIfAborted();
  return new Promise<Result>((accept, reject) => {
    const grouped = options.terminateGroup === true && process.platform !== 'win32';
    const child = spawn(process.execPath, [outfile], { cwd: root, detached: grouped,
      stdio: ['pipe', 'pipe', 'pipe'] });
    let buffered = '', errors = '', completion: { result: Result } | undefined;
    const abort = () => {
      try {
        if (grouped && child.pid) process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch { /* An already terminated worker has no remaining work to cancel. */ }
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    child.stdout.on('data', (bytes: Buffer) => {
      buffered += bytes.toString();
      const lines = buffered.split('\n'); buffered = lines.pop()!;
      for (const line of lines) {
        try {
          const event: unknown = JSON.parse(line);
          if (!record(event)) continue;
          if (event.type === 'complete') completion = {
            result: options.readResult(options.completionPayload === 'event' ? event : event.result),
          };
          if (event.type === 'progress') options.onProgress(event);
        } catch { /* Invalid output never establishes successful completion. */ }
      }
    });
    child.stderr.on('data', (bytes: Buffer) => { errors = (errors + bytes.toString()).slice(-5000); });
    child.once('error', error => { signal.removeEventListener('abort', abort); reject(error); });
    child.once('close', code => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(new DOMException(`${name} cancelled.`, 'AbortError'));
      else if (code !== 0 || !completion) reject(new Error(errors || `${name} produced no valid completion receipt.`));
      else accept(completion.result);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(options.request));
  });
}
