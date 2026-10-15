import { spawn, spawnSync } from 'node:child_process';
import { toolchainInstallSignal, reportToolchainProgress } from './progress.js';
import { telescopePythonEnvironment } from '../paths/index.js';

/** Run a pinned toolchain command, retaining only the tail of a failed command's diagnostics. */
export function runToolchainProcess(command: string, args: readonly string[], {
  env = {}, input, maxBuffer = 64 * 1024 * 1024,
}: { env?: NodeJS.ProcessEnv; input?: string; maxBuffer?: number } = {}): string {
  const result = spawnSync(command, args, {
    env: telescopePythonEnvironment(env), encoding: 'utf8', input, maxBuffer,
  });
  // A null status means the process never ran or was killed: say why (ENOENT for a missing binary, the signal otherwise).
  if (result.error) throw new Error(`${command} ${args.join(' ')} could not run: ${result.error.message}`, { cause: result.error });
  if (result.signal) throw new Error(`${command} ${args.join(' ')} was killed by ${result.signal}: ${(result.stderr ?? '').slice(-2000)}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (status ${result.status}): ${(result.stderr ?? '').slice(-2000)}`);
  return result.stdout;
}

/** Await close even after abort: the install lock must outlive the process writing its prefix. */
export async function runToolchainProcessAsync(command: string, args: readonly string[], {
  env = {}, input, maxBuffer = 64 * 1024 * 1024, signal = toolchainInstallSignal(), cwd,
  output, failureMessage, inheritEnvironment = false, captureOutput = true,
}: { env?: NodeJS.ProcessEnv; input?: string; maxBuffer?: number; signal?: AbortSignal; cwd?: string; inheritEnvironment?: boolean; captureOutput?: boolean;
  output?: (text: string, stream: 'stdout' | 'stderr') => void; failureMessage?: (status: number | null, stderr: string) => Error } = {}): Promise<string> {
  signal?.throwIfAborted();
  if (args[0] === 'create' && args.includes('-p')) reportToolchainProgress({ type: 'step', step: 'python', status: 'started' });
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { env: inheritEnvironment ? { ...process.env, ...env } : telescopePythonEnvironment(env), cwd, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let stdout = '', stderr = '', bytes = 0, failure: Error | undefined, killTimer: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal); else child.kill(signal); }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error; }
    };
    const stop = (error: Error) => {
      failure ??= error;
      kill('SIGTERM');
      killTimer ??= setTimeout(() => kill('SIGKILL'), 1000);
    };
    const abort = () => stop(new Error('Toolchain installation aborted.', { cause: signal?.reason }));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const receive = (text: string, stream: 'stdout' | 'stderr') => {
      if (captureOutput) bytes += Buffer.byteLength(text);
      if (bytes > maxBuffer) { stop(new Error(`${command} ${args.join(' ')} could not run: output exceeds maxBuffer`)); return; }
      if (stream === 'stdout' && captureOutput) stdout += text;
      if (stream === 'stderr') stderr = (stderr + text).slice(-4000);
      output?.(text, stream);
    };
    child.stdout.setEncoding('utf8').on('data', text => receive(text, 'stdout'));
    child.stderr.setEncoding('utf8').on('data', text => receive(text, 'stderr'));
    child.on('error', error => { failure ??= failureMessage?.(null, stderr) ?? new Error(`${command} ${args.join(' ')} could not run: ${error.message}`, { cause: error }); });
    child.stdin.on('error', error => { if (!('code' in error && error.code === 'EPIPE')) stop(error); });
    child.on('close', (code, killedBy) => {
      signal?.removeEventListener('abort', abort); if (killTimer) { clearTimeout(killTimer); kill('SIGKILL'); }
      if (failure) reject(failure);
      else if ((killedBy || code !== 0) && failureMessage) reject(failureMessage(code, stderr));
      else if (killedBy) reject(new Error(`${command} ${args.join(' ')} was killed by ${killedBy}: ${stderr.slice(-2000)}`));
      else if (code !== 0) reject(new Error(`${command} ${args.join(' ')} failed (status ${code}): ${stderr.slice(-2000)}`));
      else {
        if (args[0] === 'create' && args.includes('-p')) {
          reportToolchainProgress({ type: 'step', step: 'python', status: 'finished' });
          reportToolchainProgress({ type: 'step', step: 'packages', status: 'started' });
        }
        accept(stdout);
      }
    });
    child.stdin.end(input);
  });
}
