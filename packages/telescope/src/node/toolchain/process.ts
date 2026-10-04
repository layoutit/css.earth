import { spawnSync } from 'node:child_process';

/** Run a pinned toolchain command, retaining only the tail of a failed command's diagnostics. */
export function runToolchainProcess(command: string, args: readonly string[], {
  env = {}, input, maxBuffer = 64 * 1024 * 1024,
}: { env?: NodeJS.ProcessEnv; input?: string; maxBuffer?: number } = {}): string {
  const result = spawnSync(command, args, {
    env: { ...process.env, ...env }, encoding: 'utf8', input, maxBuffer,
  });
  // A null status means the process never ran or was killed: say why (ENOENT for a missing binary, the signal otherwise).
  if (result.error) throw new Error(`${command} ${args.join(' ')} could not run: ${result.error.message}`, { cause: result.error });
  if (result.signal) throw new Error(`${command} ${args.join(' ')} was killed by ${result.signal}: ${(result.stderr ?? '').slice(-2000)}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (status ${result.status}): ${(result.stderr ?? '').slice(-2000)}`);
  return result.stdout;
}
