// Collect Chromium page and worker V8 evidence before each navigation; never mutate the comparison build.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve, relative, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const checkoutRoot = fileURLToPath(new URL('../../../', import.meta.url));
import { parseArgs } from 'node:util';
import { chromium, type Request } from 'playwright';
import { parseFunctions, writeRaw } from './raw.mts';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return Object.fromEntries(Object.entries(value));
}
function string(value: unknown): string { if (typeof value !== 'string') throw new Error('Expected string'); return value; }
function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('Expected array'); return value; }
async function freePort(): Promise<number> {
  const server = createServer(); await new Promise<void>((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No TCP port');
  const port = address.port; await new Promise<void>((ok, fail) => server.close(error => error ? fail(error) : ok())); return port;
}
async function ready(url: string, child: ChildProcess): Promise<unknown> {
  let launchError: Error | undefined; child.once('error', error => { launchError = error; });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error(`Child exited ${child.exitCode} before ${url}`);
    try { const response = await fetch(url); if (response.ok) return await response.json().catch(() => null); } catch { /* startup */ }
    await new Promise(ok => setTimeout(ok, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopChild(child: ChildProcess | undefined): Promise<void> {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((ok, fail) => {
    let forced = false;
    const timer = setTimeout(() => { forced = true; child.kill('SIGKILL'); }, 5000);
    child.once('exit', () => { clearTimeout(timer); if (forced) fail(new Error('Child required forced termination')); else ok(); });
    child.kill('SIGTERM');
  });
}

// Playwright CDPSession has no sessionId envelope argument. This small protocol transport
// supplies flattened target sessions, including workers paused before their first instruction.
class FlatCDP {
  socket: WebSocket;
  next = 0;
  pending = new Map<number, { ok: (value: Record<string, unknown>) => void; fail: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  onEvent: (method: string, params: Record<string, unknown>, session: string) => void = () => {};
  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener('message', event => {
      try {
        const message = object(JSON.parse(string(event.data)));
        if (typeof message.id === 'number') {
          const pending = this.pending.get(message.id); if (!pending) return;
          this.pending.delete(message.id); clearTimeout(pending.timer);
          if (message.error) pending.fail(new Error(JSON.stringify(message.error))); else pending.ok(object(message.result ?? {}));
        } else this.onEvent(string(message.method), object(message.params ?? {}), typeof message.sessionId === 'string' ? message.sessionId : '');
      } catch (error) { this.failAll(new Error(`Invalid CDP message: ${String(error)}`)); }
    });
    socket.addEventListener('close', () => this.failAll(new Error('CDP socket closed')));
  }
  failAll(error: Error) { for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.fail(error); } this.pending.clear(); }
  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Record<string, unknown>> {
    const id = ++this.next;
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => { this.pending.delete(id); fail(new Error(`CDP timeout: ${method}`)); }, 15_000);
      this.pending.set(id, { ok, fail, timer }); this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}
interface Target { session: string; type: string; url: string; sources: Map<string, Promise<string>>; ready: Promise<void>; snapshots: number }
interface Script { url: string; source: string; map?: string; mapBase?: string; context: string; functions: ReturnType<typeof parseFunctions> }
export async function collectBrowser(value: unknown) {
  const input = object(value);
  const options = { root: string(input.root), dist: string(input.dist), out: string(input.out),
    urls: array(input.urls).map(string), serverCommand: array(input.serverCommand).map(string), waitMs: input.waitMs };
  if (![options.root, options.dist, options.out].every(path => path.trim().length > 0)) throw new Error('Nonempty root, dist and out paths required');
  if (!options.urls.length || options.urls.some(url => !url.trim())) throw new Error('Nonempty URL list required');
  for (const url of options.urls) if (!['http:', 'https:'].includes(new URL(url, 'http://127.0.0.1').protocol)) throw new Error('Only HTTP URLs supported');
  if (!options.serverCommand.length || !options.serverCommand[0]?.trim()) throw new Error('Nonempty server executable required');
  if (typeof options.waitMs !== 'number' || !Number.isFinite(options.waitMs) || options.waitMs < 0 || options.waitMs > 60_000) throw new Error('Invalid waitMs');
  const started = Date.now(), root = resolve(options.root), out = resolve(root, options.out), dist = resolve(root, options.dist);
  await mkdir(out, { recursive: true });
  const tmp = resolve(out, 'tmp'); await mkdir(tmp, { recursive: true });
  const profile = await mkdtemp(join(tmp, 'profile-'));
  const serverPort = await freePort(), debugPort = await freePort();
  if (!options.serverCommand.length) throw new Error('--server-command must be a nonempty JSON string array');
  const command = options.serverCommand.map(value => value.replaceAll('{port}', String(serverPort)).replaceAll('{dist}', dist));
  const server = spawn(command[0]!, command.slice(1), { cwd: root, env: { ...process.env, TMPDIR: tmp }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browserChild: ChildProcess | undefined;
  let cdp: FlatCDP | undefined;
  const issues: string[] = [], scripts: Script[] = [], navigation: string[] = [], targets = new Map<string, Target>(), jobs = new Set<Promise<void>>();
  let log = ''; server.stdout?.on('data', data => { log += String(data); }); server.stderr?.on('data', data => { log += String(data); });
  try {
    await ready(`http://127.0.0.1:${serverPort}/`, server);
    browserChild = spawn(chromium.executablePath(), ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-breakpad', '--disable-crash-reporter', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { env: { ...process.env, TMPDIR: tmp }, stdio: 'ignore' });
    const endpoint = object(await ready(`http://127.0.0.1:${debugPort}/json/version`, browserChild));
    const socket = new WebSocket(string(endpoint.webSocketDebuggerUrl));
    await new Promise<void>((ok, fail) => { socket.addEventListener('open', () => ok(), { once: true }); socket.addEventListener('error', () => fail(new Error('CDP connection failed')), { once: true }); });
    const protocol = new FlatCDP(socket); cdp = protocol;
    function track(job: Promise<void>) { jobs.add(job); void job.finally(() => jobs.delete(job)).catch(() => {}); }
    async function drainReady() {
      const deadline = Date.now() + 30_000;
      while (jobs.size) {
        if (Date.now() > deadline) throw new Error('Attached targets did not become ready within 30 seconds');
        await Promise.all([...jobs]);
      }
    }
    protocol.onEvent = (method, params, session) => {
      if (method === 'Target.attachedToTarget') {
        const targetInfo = object(params.targetInfo), id = string(params.sessionId), type = string(targetInfo.type);
        const target: Target = { session: id, type, url: string(targetInfo.url), sources: new Map(), ready: Promise.resolve(), snapshots: 0 }; targets.set(id, target);
        target.ready = (async () => {
          if (type === 'page' || type === 'worker' || type === 'shared_worker' || type === 'service_worker' || type === 'iframe') {
            await protocol.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, id);
            await protocol.send('Profiler.enable', {}, id);
            await protocol.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true }, id);
            await protocol.send('Debugger.enable', {}, id);
            await protocol.send('Debugger.setSkipAllPauses', { skip: true }, id);
          }
          await protocol.send('Runtime.runIfWaitingForDebugger', {}, id);
        })().catch(error => { issues.push(`Attach ${type} ${target.url}: ${String(error)}`); }); track(target.ready);
      } else if (method === 'Debugger.scriptParsed') {
        const target = targets.get(session); if (!target) return;
        const scriptId = string(params.scriptId);
        const source = protocol.send('Debugger.getScriptSource', { scriptId }, session).then(result => string(result.scriptSource));
        target.sources.set(scriptId, source); void source.catch(error => { issues.push(`Script source ${scriptId}: ${String(error)}`); });
      } else if (method === 'Target.detachedFromTarget') {
        const id = string(params.sessionId), target = targets.get(id);
        if (target && target.sources.size && target.snapshots === 0) issues.push(`Target detached before coverage snapshot: ${target.type} ${target.url}`);
        else if (target && target.type.includes('worker')) issues.push(`Worker detached after ${target.snapshots} snapshots; post-snapshot delta unavailable: ${target.url}`);
        targets.delete(id);
      }
    };
    await protocol.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    const context = browser.contexts()[0]; if (!context) throw new Error('No Chromium context');
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    let lastActivity = Date.now();
    const pendingRequests = new Set<unknown>();
    page.on('request', request => { pendingRequests.add(request); lastActivity = Date.now(); });
    const finished = (request: Request) => { pendingRequests.delete(request); lastActivity = Date.now(); };
    page.on('requestfinished', finished); page.on('requestfailed', finished);
    const workerNavigations = new Set<number>();
    let currentNavigation = 0;
    page.on('worker', () => { workerNavigations.add(currentNavigation); lastActivity = Date.now(); });
    await page.addInitScript(() => {
      Reflect.set(window, '__coverageMotion', { active: false, changedAt: Date.now() });
      document.addEventListener('objectmotionchange', event => {
        const detail: unknown = Reflect.get(event, 'detail');
        if (detail && typeof detail === 'object') Reflect.set(window, '__coverageMotion', {
          active: Reflect.get(detail, 'active') === true || Reflect.get(detail, 'coasting') === true,
          changedAt: Date.now(),
        });
      }, { capture: true });
    });
    page.on('pageerror', error => { issues.push(`Page error at ${page.url()}: ${error.message}`); });
    await drainReady();
    let sequence = 0;
    async function snapshot(label: string) {
      const seen = new Set<string>();
      while (true) {
        await drainReady();
        const batch = [...targets.values()].filter(target => !seen.has(target.session));
        if (!batch.length) break;
        await Promise.all(batch.map(async target => {
        seen.add(target.session);
        await target.ready;
        if (!['page', 'worker', 'shared_worker', 'service_worker', 'iframe'].includes(target.type)) return;
        try {
          const result = await protocol.send('Profiler.takePreciseCoverage', {}, target.session); target.snapshots++;
          for (const value of array(result.result)) {
            const entry = object(value), url = string(entry.url), scriptId = string(entry.scriptId);
            const sourcePromise = target.sources.get(scriptId);
            if (!sourcePromise) { issues.push(`Missing source: ${target.type} ${url || scriptId} at ${label}`); continue; }
            const source = await sourcePromise, scriptNumber = ++sequence, filename = `scripts/${scriptNumber}.js`;
            await mkdir(join(out, 'scripts'), { recursive: true }); await writeFile(join(out, filename), source);
            const record: Script = { url, source: filename, context: `${target.type}:${label}`, functions: parseFunctions(entry.functions) };
            if (url) {
              try {
                const pathname = decodeURIComponent(new URL(url).pathname), bundle = resolve(dist, `.${pathname}`);
                if (relative(dist, bundle).startsWith(`..${sep}`)) throw new Error('Bundle path escapes dist');
                const map = await readFile(`${bundle}.map`, 'utf8'); // Opaque transport: the shared converter validates source-map fields.
                record.map = `scripts/${scriptNumber}.map`; record.mapBase = bundle; await writeFile(join(out, record.map), map);
              } catch (error) { issues.push(`No source map: ${url} (${String(error)})`); }
            } else issues.push(`Anonymous script retained: ${target.type} ${scriptId} at ${label}`);
            scripts.push(record);
          }
        } catch (error) { issues.push(`Coverage ${target.type} ${target.url} at ${label}: ${String(error)}`); }
        }));
      }
    }
    for (const [index, address] of options.urls.entries()) {
      await snapshot(`before-navigation-${index + 1}`);
      currentNavigation = index + 1;
      const url = new URL(address, `http://127.0.0.1:${serverPort}`).href;
      const response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
      if (!response || !response.ok()) throw new Error(`Navigation failed: ${url} (${response?.status()})`);
      navigation.push(url);
      await page.waitForFunction(() => {
        const diagnostics: unknown = Reflect.get(window, '__cssEarth');
        return document.documentElement.dataset.ready === 'true' &&
          (!diagnostics || (typeof diagnostics === 'object' && Reflect.get(diagnostics, 'ready') === true));
      }, null, { timeout: 60_000 });
      const quietDeadline = Date.now() + 30_000;
      while (true) {
        const motion = await page.evaluate(() => {
          const value: unknown = Reflect.get(window, '__coverageMotion');
          return value && typeof value === 'object' ? { active: Reflect.get(value, 'active') === true, changedAt: Number(Reflect.get(value, 'changedAt')) } : { active: false, changedAt: 0 };
        });
        if (!motion.active && pendingRequests.size === 0 && Date.now() - Math.max(lastActivity, motion.changedAt) >= options.waitMs) break;
        if (Date.now() > quietDeadline) throw new Error(`Page did not reach request/motion quiet period: ${url}`);
        await page.waitForTimeout(100);
      }
      await snapshot(`navigation-${index + 1}`);
    }
    await snapshot('final');
    writeRaw(out, { version: 1, kind: 'browser', root, costMs: Date.now() - started, scripts, issues });
    await writeFile(join(out, 'collection.json'), JSON.stringify({ navigation, navigationSteps: navigation.map((url, index) => ({ url, step: index + 1, workersExpected: workerNavigations.has(index + 1), scripts: scripts.filter(script => script.context.endsWith(`:navigation-${index + 1}`)).length })), workers: scripts.filter(script => script.context.startsWith('worker:')).map(script => ({ url: script.url, map: script.map, context: script.context, positiveRanges: script.functions.flatMap(fn => fn.ranges).filter(range => range.count > 0).length })), scripts: scripts.length, costMs: Date.now() - started }, null, 2));
    await browser.close();
    return { scripts: scripts.length, navigations: navigation.length, workers: scripts.filter(script => script.context.startsWith('worker:')).length, issues: issues.length, costMs: Date.now() - started };
  } finally {
    cdp?.socket.close();
    try {
      const stopped = await Promise.allSettled([stopChild(browserChild), stopChild(server)]);
      // Every stop waits for exit, including forced exits. Delete only this run's output-local profile.
      await rm(profile, { recursive: true, force: true });
      for (const result of stopped) if (result.status === 'rejected') throw result.reason;
    } finally { await writeFile(join(out, 'server.log'), log); }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { root: { type: 'string', default: checkoutRoot }, dist: { type: 'string' }, out: { type: 'string' }, urls: { type: 'string' }, 'server-command': { type: 'string' }, 'wait-ms': { type: 'string', default: '750' } } });
  const waitMs = Number(values['wait-ms']); if (!Number.isFinite(waitMs) || waitMs < 0 || waitMs > 60_000) throw new Error('Invalid --wait-ms');
  const urls = array(JSON.parse(string(values.urls))).map(string); if (!urls.length) throw new Error('Empty --urls');
  console.log(JSON.stringify(await collectBrowser({ root: string(values.root), dist: string(values.dist), out: string(values.out), urls, serverCommand: array(JSON.parse(string(values['server-command']))).map(string), waitMs })));
}
