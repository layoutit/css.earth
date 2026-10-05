/** A loopback HTTP proxy guards native-cache captures without Playwright routing. */
import { createServer, request as httpRequest, type Server } from 'node:http';
import type { Browser, LaunchOptions } from 'playwright';
const guards = new WeakMap<object, { guard: CacheGuard; browser: Browser }>();
export interface CacheGuard {
  readonly origin: string;
  readonly blocked: readonly string[];
  readonly launchOptions: LaunchOptions;
  verify(browser: Browser): Promise<void>;
  close(): Promise<void>;
}
export function loopbackTarget(input: string): URL | null {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' && !url.username && !url.password && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? url : null;
  } catch { return null; }
}
export function requireCacheGuard(value: unknown, browser: Browser | null): CacheGuard {
  if (!value || typeof value !== 'object' || !guards.has(value)) throw new Error('Cache-preserving capture needs a verified loopback proxy');
  // Membership is assigned exclusively to the complete guard below, never external JSON.
  const verified = guards.get(value);
  if (!verified || verified.browser !== browser) throw new Error('Cache guard does not own this browser');
  return verified.guard;
}
/** Validate Chromium's reported effective switches; substring admission could permit a wildcard bypass. */
export function validateProxyArguments(arguments_: readonly string[], origin: string): void {
  const url = loopbackTarget(origin);
  if (!url || url.hostname !== '127.0.0.1' || !url.port) throw new Error('Invalid loopback proxy origin');
  const switches = (name: string) => arguments_.filter(value => value === name || value.startsWith(name + '='));
  const servers = switches('--proxy-server'), bypasses = switches('--proxy-bypass-list');
  const entries = bypasses[0]?.slice('--proxy-bypass-list='.length).split(/[;,]/u).map(value => value.trim());
  if (servers.length !== 1 || ![`--proxy-server=${origin}`, `--proxy-server=127.0.0.1:${url.port}`].includes(servers[0] ?? '')
    || bypasses.length !== 1 || !entries?.length || entries.some(value => value !== '<-loopback>')
    || arguments_.some(value => ['--no-proxy-server', '--proxy-pac-url', '--proxy-auto-detect'].some(name => value === name || value.startsWith(name + '=')))
    || !arguments_.includes('--disable-quic')) throw new Error('Browser was not launched behind the loopback proxy');
}
export async function startCacheGuard(options: { blockServiceWorkers?: boolean } = {}): Promise<CacheGuard> {
  const blocked: string[] = [];
  const server: Server = createServer((incoming, outgoing) => {
    // Native service-worker script fetches carry this browser-owned Fetch destination.
    if (options.blockServiceWorkers && incoming.headers['sec-fetch-dest'] === 'serviceworker') { outgoing.writeHead(403); outgoing.end('Service workers blocked'); return; }
    const url = loopbackTarget(incoming.url ?? '');
    if (!url) { blocked.push(incoming.url ?? ''); outgoing.writeHead(403); outgoing.end('Non-loopback request blocked'); return; }
    const headers = { ...incoming.headers }; delete headers['proxy-connection']; delete headers['proxy-authorization'];
    const forwarded = httpRequest({ hostname: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname.replace(/^\[|\]$/gu, ''),
      port: url.port || 80, path: url.pathname + url.search, method: incoming.method, headers }, response => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers); response.pipe(outgoing);
    });
    forwarded.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end('Loopback proxy upstream failure'); });
    incoming.on('aborted', () => forwarded.destroy()); incoming.pipe(forwarded);
  });
  // HTTPS tunnels and WebSockets are unnecessary for production HTTP captures, and never bypass this guard.
  server.on('connect', (request, socket) => { blocked.push(request.url ?? ''); socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); });
  server.on('upgrade', (request, socket) => { blocked.push(request.url ?? ''); socket.destroy(); });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing proxy address');
  const origin = `http://127.0.0.1:${address.port}`;
  let verified = false;
  const guard: CacheGuard = {
    origin, blocked,
    launchOptions: { proxy: { server: origin, bypass: '<-loopback>' }, args: ['--disable-quic', '--enable-automation'] },
    async verify(browser) {
      if (browser.browserType().name() !== 'chromium') throw new Error('Native-cache guard currently supports Chromium only; WebKit has no exposed native hit evidence');
      const session = await browser.newBrowserCDPSession();
      try {
        const { arguments: arguments_ } = await session.send('Browser.getBrowserCommandLine');
        validateProxyArguments(arguments_, origin);
        verified = true; guards.set(guard, { guard, browser });
      } finally { await session.detach(); }
    },
    async close() { guards.delete(guard); verified = false; server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
  };
  // The flag is used only by the getter to refuse attaching an unverified guard.
  Object.defineProperty(guard, 'verified', { get: () => verified });
  return guard;
}
