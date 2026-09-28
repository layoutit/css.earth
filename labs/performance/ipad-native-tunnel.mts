import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { isIP } from 'node:net';

/** Instruments needs the Apple developer tunnel to stay owned for its whole recording. */
export async function holdNativeDeviceTunnel(binary: string, udid: string, logPath: string): Promise<() => Promise<void>> {
  const child = spawn(binary, ['remote', 'start-tunnel', '--udid', udid, '--native', '--script-mode'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise<void>(resolve => child.once('close', () => resolve()));
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([exited, new Promise<void>(resolve => { timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000); })]);
      await exited;
    } finally { clearTimeout(timer); }
  };
  try {
    await new Promise<void>((resolve, reject) => {
      let stdout = '';
      const timeout = setTimeout(() => reject(new Error(`Native developer tunnel did not become ready; see ${logPath}`)), 15000);
      const fail = (error: Error) => { clearTimeout(timeout); reject(error); };
      child.once('error', fail);
      child.once('exit', (code, signal) => fail(new Error(`Native developer tunnel exited (${code ?? signal}); see ${logPath}`)));
      child.stderr.on('data', chunk => appendFileSync(logPath, chunk));
      child.stdout.on('data', chunk => {
        appendFileSync(logPath, chunk); stdout += String(chunk);
        const ready = stdout.split('\n').some(line => {
          const [host, port, extra] = line.trim().split(/\s+/u);
          return host !== undefined && isIP(host) !== 0 && port !== undefined && /^\d+$/u.test(port) && Number(port) > 0 && Number(port) <= 65535 && extra === undefined;
        });
        if (ready) { clearTimeout(timeout); resolve(); }
      });
    });
    return stop;
  } catch (error) { await stop(); throw error; }
}
