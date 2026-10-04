/** One retained pymobiledevice3 session for visible Safari and native iPad frames. */
import { MissingSourceInputError } from '@cssearth/core';
import { spawn, type ChildProcess, execFile } from 'node:child_process';
import { mkdir, readdir, realpath, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const exec = promisify(execFile);
async function within<T>(task: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([task, new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

type WorkerReply = { readonly id: number; readonly ok: boolean; readonly error?: string; readonly warning?: string | null; readonly frames?: number };
type PendingReply = { readonly resolve: (reply: WorkerReply) => void; readonly reject: (error: Error) => void; readonly op?: string };

/**
 * Python only owns pymobiledevice3's async service calls. This TypeScript file
 * owns process lifetime, request protocol and captured-file conversion.
 */
const WORKER = String.raw`
import asyncio, contextlib, json, os, sys, time
from pymobiledevice3.remote.native_tunnel import NativeRemotedTunnel
from pymobiledevice3.services.dvt.instruments.dvt_provider import DvtProvider
from pymobiledevice3.services.dvt.instruments.screenshot import Screenshot
from pymobiledevice3.services.webinspector import SAFARI, WebinspectorService
from pymobiledevice3.services.web_protocol.driver import WebDriver

def reply(id, ok, **fields):
    print(json.dumps({"id": id, "ok": ok, **fields}), flush=True)

class Worker:
    def __init__(self, rsd, screen):
        self.rsd = rsd
        self.screen = screen
        self.capture_lock = asyncio.Lock()
        self.frames_task = None
        self.frames = 0
        self.last_stamp = 0
        self.capture_error = None

    async def shot(self, path):
        async with self.capture_lock:
            data = await self.screen.get_screenshot()
            temporary = path + ".tmp"
            with open(temporary, "wb") as file:
                file.write(data)
            os.replace(temporary, path)

    async def start(self, directory):
        if self.frames_task is not None:
            raise RuntimeError("screen recording is already running")
        os.makedirs(directory, exist_ok=True)
        self.frames = 0
        self.capture_error = None
        async def capture():
            while True:
                # Epoch milliseconds keep the TypeScript filmstrip timeline stable.
                stamp = max(time.time_ns() // 1_000_000, self.last_stamp + 1)
                self.last_stamp = stamp
                path = os.path.join(directory, str(stamp) + ".png")
                try:
                    await self.shot(path)
                except Exception as error:
                    self.capture_error = str(error)
                    return
                self.frames += 1
        self.frames_task = asyncio.create_task(capture())

    async def stop(self):
        if self.frames_task is not None:
            self.frames_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.frames_task
            self.frames_task = None
        return self.frames

async def read_command():
    line = await asyncio.get_running_loop().run_in_executor(None, sys.stdin.readline)
    return json.loads(line) if line else None

async def main(url, udid):
    async with NativeRemotedTunnel(serial=udid or None) as rsd:
        inspector = WebinspectorService(rsd)
        await inspector.connect()
        session = None
        try:
            safari = await inspector.open_app(SAFARI)
            session = await inspector.automation_session(safari)
            driver = WebDriver(session)
            await driver.start_session()
            await driver.get(url)
            async with DvtProvider(rsd) as dvt, Screenshot(dvt) as screen:
                worker = Worker(rsd, screen)
                reply(0, True, event="READY")
                while True:
                    command = await read_command()
                    if command is None:
                        break
                    id = command.get("id")
                    try:
                        operation = command["op"]
                        if operation == "START":
                            await worker.start(command["out"])
                            reply(id, True)
                        elif operation == "STOP":
                            frames = await worker.stop()
                            reply(id, True, frames=frames, warning=worker.capture_error)
                        elif operation == "SHOT":
                            await worker.shot(command["file"])
                            reply(id, True)
                        elif operation == "CLOSE":
                            frames = await worker.stop()
                            reply(id, True, frames=frames)
                            break
                        else:
                            raise ValueError("unknown operation: " + str(operation))
                    except Exception as error:
                        reply(id, False, error=f"{type(error).__name__}: {error}")
                await worker.stop()
        finally:
            if session is not None:
                with contextlib.suppress(Exception):
                    await session.stop_session()
            await inspector.close()

try:
    asyncio.run(main(sys.argv[1], sys.argv[2]))
except KeyboardInterrupt:
    pass
except Exception as error:
    import traceback
    print(json.dumps({"id": 0, "ok": False, "error": f"{type(error).__name__}: {error}\n{traceback.format_exc()[-1500:]}"}), flush=True)
    raise
`;

async function workerPython(): Promise<string> {
  const binary = process.env.PYMOBILEDEVICE3 ?? 'pymobiledevice3';
  const executable = binary.includes('/') ? binary : (await exec('which', [binary])).stdout.trim();
  if (!executable) throw new MissingSourceInputError(`${binary} is not installed; set PYMOBILEDEVICE3 to pymobiledevice3's command.`);
  return resolve(await realpath(executable).catch(() => executable), '..', 'python');
}

function workerError(child: ChildProcess, stderr: readonly string[], message: string): Error {
  const detail = stderr.join('').trim().split('\n').at(-1);
  return new Error(`${message}${detail ? `: ${detail}` : ''} (worker ${child.exitCode ?? 'unavailable'}).`);
}

export type IpadDeviceSession = {
  readonly startScreens: (out: string) => Promise<{ readonly stop: () => Promise<number> }>;
  readonly screenshot: (file: string) => Promise<void>;
  readonly close: () => Promise<void>;
};

/**
 * Launch the temporary visible Safari automation page once and retain the same
 * native tunnel for every screenshot. `close()` tears down the Automation
 * browsing context through pymobiledevice3's `stop_session()` finally block.
 */
export async function startIpadDeviceSession(url: string, udid: string | null): Promise<IpadDeviceSession> {
  const python = await workerPython();
  const child = spawn(python, ['-c', WORKER, url, udid ?? ''], {
    env: { ...process.env, PYMOBILEDEVICE3_NATIVE: '1', PYTHONUNBUFFERED: '1' }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stderr: string[] = [];
  const pending = new Map<number, PendingReply>();
  let nextId = 1;
  let output = '';
  let ready: PendingReply | null = null;
  let closed = false;

  const rejectPending = (error: Error) => {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
    ready?.reject(error);
    ready = null;
  };
  child.stderr?.setEncoding('utf8').on('data', chunk => stderr.push(chunk));
  child.stdout?.setEncoding('utf8').on('data', chunk => {
    output += chunk;
    let newline = output.indexOf('\n');
    while (newline >= 0) {
      const line = output.slice(0, newline); output = output.slice(newline + 1);
      try {
        const reply = JSON.parse(line) as WorkerReply & { readonly event?: string };
        if (reply.id === 0 && reply.event === 'READY') { ready?.resolve(reply); ready = null; }
        else {
          const request = pending.get(reply.id);
          if (request) { pending.delete(reply.id); reply.ok ? request.resolve(reply) : request.reject(new Error(`iPad worker ${request.op} failed: ${reply.error || JSON.stringify(reply)}${stderr.length ? `; stderr: ${stderr.join('').trim().slice(-800)}` : ''}`)); }
          else if (!reply.ok) rejectPending(new Error(`iPad worker failed: ${reply.error || JSON.stringify(reply)}`));
        }
      } catch { rejectPending(workerError(child, stderr, `Invalid iPad worker reply ${JSON.stringify(line)}`)); }
      newline = output.indexOf('\n');
    }
  });
  child.once('error', () => rejectPending(workerError(child, stderr, 'Could not start the iPad worker')));
  child.once('exit', () => { if (!closed) rejectPending(workerError(child, stderr, 'iPad worker exited')); });

  const request = (op: 'START' | 'STOP' | 'SHOT' | 'CLOSE', fields: Record<string, string> = {}) => new Promise<WorkerReply>((resolveReply, reject) => {
    if (closed || !child.stdin?.writable) { reject(new Error('The iPad device session is closed.')); return; }
    const id = nextId++; pending.set(id, { resolve: resolveReply, reject, op });
    child.stdin.write(`${JSON.stringify({ id, op, ...fields })}\n`, error => {
      if (error) { pending.delete(id); reject(error); }
    });
  });

  await within(new Promise<WorkerReply>((resolveReply, reject) => {
    ready = { resolve: resolveReply, reject };
  }), 30_000, 'Safari did not become ready within 30 seconds').catch(async error => {
    ready = null;
    closed = true;
    child.kill('SIGINT');
    if (child.exitCode === null) await within(new Promise<void>(done => child.once('exit', () => done())), 5_000, 'iPad worker did not exit').catch(() => child.kill('SIGKILL'));
    throw error;
  });

  let screensStarted = false;
  let screensStopped = false;
  return {
    async startScreens(out) {
      if (screensStarted) throw new Error('This iPad device session already has a screen recording.');
      screensStarted = true;
      const directory = resolve(out, 'screens');
      await mkdir(directory, { recursive: true });
      await request('START', { out: directory });
      return {
        async stop() {
          if (screensStopped) return 0;
          screensStopped = true;
          const stopped = await request('STOP');
          if (stopped.warning) console.error(`iPad native screen sampler stopped early: ${stopped.warning}`);
          const frames = (await readdir(directory)).filter(file => /^\d+\.png$/u.test(file)).sort();
          for (const frame of frames) {
            const png = resolve(directory, frame);
            await sharp(png).resize({ width: 1280, height: 1280, fit: 'inside' }).jpeg({ quality: 75 }).toFile(resolve(directory, frame.replace(/\.png$/u, '.jpg')));
            await rm(png);
          }
          return stopped.frames ?? frames.length;
        },
      };
    },
    async screenshot(file) {
      await mkdir(resolve(file, '..'), { recursive: true });
      await request('SHOT', { file: resolve(file) });
    },
    async close() {
      if (closed) return;
      try { await within(request('CLOSE'), 10_000, 'iPad worker did not close within 10 seconds'); }
      finally {
        closed = true;
        if (child.exitCode === null && !child.killed) child.kill('SIGINT');
        if (child.exitCode === null) await within(new Promise<void>(done => child.once('exit', () => done())), 5_000, 'iPad worker did not exit').catch(() => child.kill('SIGKILL'));
      }
    },
  };
}
