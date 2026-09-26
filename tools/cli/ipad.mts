#!/usr/bin/env node
/** Serve this checkout on the LAN and open it in the visible iPad Safari tab. */
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = resolve(process.cwd());
const pause = (ms: number) => new Promise(done => setTimeout(done, ms));
const exited = (child: ChildProcess) => new Promise<number | null>((done, fail) => {
  child.once('error', fail);
  child.once('exit', done);
});

export function options(args: string[]) {
  let route = '/', port = 4210, address: string | null = null, openOnly = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--route') route = args[++i] ?? '';
    else if (arg === '--port') port = Number(args[++i]);
    else if (arg === '--address') address = args[++i] ?? '';
    else if (arg === '--open-only') openOnly = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!route.startsWith('/') || route.startsWith('//')) throw new Error('--route must be a site path such as /jupiter/.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be a TCP port.');
  if (address !== null && !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(address)) throw new Error('--address must be an IPv4 address.');
  return { route, port, address, openOnly };
}

export function lanAddress(interfaces = networkInterfaces()) {
  const address = interfaces.en0?.find(entry => entry.family === 'IPv4' && !entry.internal)?.address;
  if (!address) throw new Error('No IPv4 address on en0. Pass --address <Mac LAN IP>.');
  return address;
}

async function command(binary: string, args: string[], timeout = 15_000) {
  try { return (await exec(binary, args, { timeout, maxBuffer: 2 * 1024 * 1024 })).stdout.trim(); }
  catch (error) {
    const detail = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : String(error);
    throw new Error(`${binary} ${args[0] ?? ''} failed: ${detail || 'no response'}`);
  }
}

async function serverOwner(port: number) {
  let listing: string;
  try { listing = (await exec('lsof', ['-nP', '-F', 'p', `-iTCP:${port}`, '-sTCP:LISTEN'])).stdout; }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 1) return null;
    throw error;
  }
  const lines = listing.split('\n');
  const pid = lines.find(line => /^p\d+$/u.test(line))?.slice(1);
  if (!pid) return null;
  const cwd = (await command('lsof', ['-nP', '-a', '-p', pid, '-d', 'cwd', '-Fn'])).split('\n')
    .find(line => line.startsWith('n'))?.slice(1);
  return { pid, cwd: cwd ? resolve(cwd) : null };
}

async function responds(port: number, route = '/') {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, { signal: AbortSignal.timeout(12_000) });
    await response.body?.cancel();
    return response.ok;
  } catch { return false; }
}

async function prepare() {
  console.log('Preparing the cssEarth dev server…');
  const child = spawn('pnpm', ['dev:prepare'], { cwd: root, stdio: 'inherit' });
  const code = await exited(child);
  if (code !== 0) throw new Error(`dev:prepare failed (${code ?? 'signal'}).`);
}

async function startServer(port: number) {
  await prepare();
  const child = spawn('pnpm', ['exec', 'astro', 'dev', '--host', '0.0.0.0', '--port', String(port)],
    { cwd: root, stdio: 'inherit' });
  let exit: number | null | undefined;
  child.once('exit', code => { exit = code; });
  child.once('error', error => { console.error(`Cannot start Astro: ${error.message}`); exit = 1; });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await responds(port)) return child;
    if (exit !== undefined) throw new Error(`Astro exited before the page responded (${exit ?? 'signal'}).`);
    await pause(500);
  }
  child.kill('SIGTERM');
  throw new Error('Astro did not serve a page within 60 seconds.');
}

async function device() {
  const devices = (await command('idevice_id', ['-l'])).split('\n').filter(Boolean);
  if (devices.length !== 1) throw new Error(`Expected one USB iPad/iPhone, found ${devices.length}.`);
  const paired = await command('idevicepair', ['-u', devices[0]!, 'validate']);
  if (!paired.includes('SUCCESS')) throw new Error('Unlock the iPad and trust this Mac.');
  return devices[0]!;
}

async function inspectorExpression(expression: string) {
  const child = spawn('pymobiledevice3', ['webinspector', 'js-shell', '--native', '--bundle-id', 'com.apple.mobilesafari'],
    { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  child.stdout?.setEncoding('utf8').on('data', chunk => { output += chunk; });
  child.stderr?.setEncoding('utf8').on('data', chunk => { output += chunk; });
  child.stdin?.end(`${expression}\n`);
  const code = await exited(child);
  if (code !== 0 || /(?:ERROR|Traceback|No webviews found)/iu.test(output))
    throw new Error('Safari Web Inspector could not navigate a tab. Unlock the iPad, open Safari, and enable Settings > Apps > Safari > Advanced > Web Inspector.');
}

async function openOnDevice(url: string) {
  await device();
  const before = await command('pymobiledevice3', ['webinspector', 'opened-tabs', '--native']);
  if (!before.includes('<Safari(')) throw new Error('Open Safari on the unlocked iPad and leave a tab visible.');
  // Existing-tab Inspector evaluation works without Safari Remote Automation.
  await inspectorExpression(`location.assign(${JSON.stringify(url)})`);
  for (let attempt = 0; attempt < 20; attempt++) {
    const tabs = await command('pymobiledevice3', ['webinspector', 'opened-tabs', '--native']);
    if (tabs.includes(`URL:${url}>`)) return;
    await pause(500);
  }
  throw new Error(`Safari did not report ${url} after navigation.`);
}

export async function main(args: string[]) {
  if (args.includes('--help')) {
    console.log('Usage: pnpm ipad [--route /jupiter/] [--port 4210] [--address <Mac LAN IPv4>] [--open-only]');
    return;
  }
  const option = options(args), address = option.address ?? lanAddress();
  const url = `http://${address}:${option.port}${option.route}`;
  let owned: ChildProcess | null = null;
  const owner = await serverOwner(option.port);
  if (owner && owner.cwd !== root) throw new Error(`Port ${option.port} belongs to ${owner.cwd ?? 'an unknown checkout'}; choose --port.`);
  if (owner) console.log(`Reusing server from this checkout (PID ${owner.pid}).`);
  if (!owner && !option.openOnly) owned = await startServer(option.port);
  if (!await responds(option.port, option.route)) throw new Error(`No working page at http://127.0.0.1:${option.port}${option.route}. Start the server or check --route.`);
  try { await openOnDevice(url); }
  catch (error) { owned?.kill('SIGTERM'); throw error; }
  console.log(`Opened ${url} in iPad Safari.`);
  if (owned?.exitCode === null) {
    console.log('Server is running. Press Ctrl-C to stop it.');
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => owned?.kill(signal));
    await new Promise<void>(done => owned!.once('exit', () => done()));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2)).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
