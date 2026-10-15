import { spawn, type SpawnOptions } from 'node:child_process';

type Spawn = (command: string, args: readonly string[], options: SpawnOptions) => {
  once(event: 'error', listener: (error: Error) => void): unknown;
  unref(): void;
};

/** Hand a URL or file to the desktop without keeping the command alive. */
export function openExternal(target: string, platform = process.platform, launch: Spawn = spawn): void {
  const windows = platform === 'win32';
  const command = windows ? 'cmd.exe' : platform === 'darwin' ? 'open' : 'xdg-open';
  // Expand once from the environment: URL query punctuation never becomes cmd syntax.
  const args = windows ? ['/d', '/v:off', '/s', '/c', 'start', '""', '"%CSSEARTH_TELESCOPE_OPEN_TARGET%"'] : [target];
  const child = launch(command, args, { detached: true, stdio: 'ignore', ...(windows ? {
    windowsHide: true, windowsVerbatimArguments: true,
    env: { ...process.env, CSSEARTH_TELESCOPE_OPEN_TARGET: target.replaceAll('"', '%22') },
  } : {}) });
  child.once('error', error => { process.stderr.write(`Could not open ${target}: ${error.message}\n`); });
  child.unref();
}
