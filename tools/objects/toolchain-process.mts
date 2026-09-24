import { spawnSync } from 'node:child_process';

/** Run a pinned toolchain command, retaining only the tail of a failed command's diagnostics. */
export function runToolchainProcess(command: string, args: readonly string[], {
  env = {}, input, maxBuffer = 64 * 1024 * 1024,
}: { env?: NodeJS.ProcessEnv; input?: string; maxBuffer?: number } = {}): string {
  const result = spawnSync(command, args, {
    env: { ...process.env, ...env }, encoding: 'utf8', input, maxBuffer,
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (status ${result.status}): ${(result.stderr ?? '').slice(-2000)}`);
  return result.stdout;
}
