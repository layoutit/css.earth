/** Preview child lifecycle: free port, positive readiness, bounded termination. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve, relative, dirname } from 'node:path';
import { readdir, stat, realpath } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
export async function startServer(dist: string, checkout?: string) {
  dist = await realpath(dist);
  if (!checkout) {
    let owner = dirname(dist);
    while (!(await stat(resolve(owner, 'site/server/preview.mts')).catch(() => null))?.isFile()) {
      const parent = dirname(owner);
      if (parent === owner) throw new Error('Distribution has no owning preview checkout; pass --checkout');
      owner = parent;
    }
    checkout = owner;
  }
  checkout = await realpath(checkout);
  if (!(await stat(resolve(dist, 'scenes')).catch(() => null))?.isDirectory())
    throw new Error('Distribution must contain local scenes/; remote asset builds are refused');
  async function readiness(folder: string): Promise<string | null> {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isFile() && entry.name === 'index.html') return '/' + relative(dist, folder).split('\\').join('/') + '/';
      if (entry.isDirectory() && !['_astro', 'scenes'].includes(entry.name)) {
        const found = await readiness(resolve(folder, entry.name)); if (found) return found;
      }
    }
    return null;
  }
  const readyRoute = (await readiness(dist))?.replace(/^\/\//u, '/');
  if (!readyRoute) throw new Error('Distribution has no built HTML page');
  const socket = createServer();
  await new Promise<void>((done, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', done); });
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('No allocated port');
  const port = address.port;
  await new Promise<void>(done => socket.close(() => done()));
  const child = spawn(process.execPath, [resolve(import.meta.dirname, 'server-child.mts'), String(port), dist, checkout], {
    cwd: checkout, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  if (!child.stdout || !child.stderr) { child.kill('SIGTERM'); throw new Error('Preview output pipes unavailable'); }
  let output = '', stopped = false;
  child.stdout.on('data', data => { output += String(data); }); child.stderr.on('data', data => { output += String(data); });
  const closed = new Promise<void>(done => child.once('close', () => done()));
  let launchError: Error | undefined;
  child.on('error', error => { launchError = error; });
  const kill = () => { if (!stopped) child.kill('SIGTERM'); };
  const close = async () => {
    kill();
    const timeout = setTimeout(() => { child.kill('SIGKILL'); }, 3000);
    timeout.unref();
    await closed; clearTimeout(timeout); stopped = true;
    process.removeListener('exit', kill); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
  };
  const interrupt = () => { void close().finally(() => { process.exitCode = 130; }); };
  process.once('exit', kill); process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  const origin = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (launchError || child.exitCode !== null) throw new Error(`Preview exited: ${launchError?.message ?? child.exitCode}\n${output}`);
      const response = await fetch(origin + readyRoute, { signal: AbortSignal.timeout(1000) }).catch(() => null);
      if (response?.ok) return { origin, close, pid: child.pid };
      await delay(50);
    }
    throw new Error(`Preview readiness timeout: ${output}`);
  } catch (error) { await close(); throw error; }
}
