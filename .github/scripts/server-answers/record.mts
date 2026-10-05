/** Record a build through a supervised real preview and imported deployment bundles. */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { catalogue, requestsForTarget } from './requests.mts';
import { canonicalHtml, object, normalisations, recordAnswer, serialise, storedAnswer, type Target } from './model.mts';
import { readDeploymentConfig } from './deployment-config.mts';
export function assertNoFallback(log: string): void { if (log.includes('page-handler-fallback')) throw new Error(`Worker fallback rejected: ${log.slice(-2000)}`); }
export async function record(target: Target, dist: string, out: string): Promise<void> {
  if (resolve(dist) !== resolve('dist')) throw new Error('The real search-data reader uses cwd/dist; run from the build checkout with --dist dist.');
  await mkdir(out, { recursive: true });
  if ((await readdir(out)).length) throw new Error('Output directory must be empty');
  const child = spawn(process.execPath, [resolve(import.meta.dirname, 'host.mts'), target, resolve(dist)], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let log = '';
  if (!child.stderr) throw new Error('Missing child diagnostic pipe');
  child.stderr.on('data', chunk => { log += String(chunk); });
  child.stdout?.on('data', chunk => { log += String(chunk); });
  const stop = () => { child.kill('SIGTERM'); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  const rejectFallback = () => assertNoFallback(log);
  try {
    const ready = await new Promise<Record<string, unknown>>((accept, reject) => {
      const timeout = setTimeout(() => { child.kill(); reject(new Error(`Host readiness timed out: ${log.slice(-2000)}`)); }, 180_000);
      child.on('message', (message: unknown) => {
        const value = object(message);
        if (value.ready === true) { clearTimeout(timeout); accept(value); }
      });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Host exited ${code}: ${log.slice(-2000)}`)); });
      child.once('error', reject);
    });
    if (typeof ready.origin !== 'string') throw new Error('Invalid host readiness');
    const send = (value: unknown) => new Promise<Record<string, unknown>>((accept, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error('Probe timed out')); }, 60_000);
      const done = (message: unknown) => { clearTimeout(timer); const result = object(message); if (result.fallback === true) { reject(new Error('Worker fallback rejected by child diagnostic')); return; } if (result.error) reject(new Error(String(result.error))); else accept(result); };
      child.once('message', done);
      child.send(serialise(value));
    });
    const ask = async (path: string, method: string, headers: Record<string, string>, body?: string) => {
      const value = await send({ path, method, headers, body });
      if (typeof value.status !== 'number' || typeof value.bytes !== 'string' || !Array.isArray(value.headers)) throw new Error('Invalid host answer');
      const returned = new Headers();
      for (const pair of value.headers) {
        if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(item => typeof item === 'string')) throw new Error('Invalid host header');
        returned.append(pair[0], pair[1]);
      }
      return new Response([204, 205, 304].includes(value.status) ? null : Buffer.from(value.bytes, 'base64'), { status: value.status, headers: returned });
    };
    await send({ command: 'warmup' });
    rejectFallback();
    const all = await catalogue(dist);
    const requests = requestsForTarget(all, target);
    for (const request of requests) {
      const headers: Record<string, string> = { 'Accept-Encoding': 'identity', ...request.headers };
      if (request.conditional) {
        const initial = await ask(request.path, 'GET', { 'Accept-Encoding': 'identity' });
        const value = initial.headers.get(request.conditional === 'etag' ? 'etag' : 'last-modified');
        if (!value) throw new Error(`Missing validator for ${request.id}`);
        headers[request.conditional === 'etag' ? 'If-None-Match' : 'If-Modified-Since'] = value;
      }
      const response = await ask(request.path, request.method ?? 'GET', headers, request.body);
      rejectFallback();
      const url = new URL(request.path, 'https://answers.invalid');
      const pageId = url.pathname === '/.netlify/functions/search' ? url.searchParams.get('object') : url.pathname.split('/').filter(Boolean)[0];
      const file = pageId ? `${pageId}/index.html` : url.search ? 'earth/index.html' : 'index.html';
      const html = response.headers.get('content-type')?.includes('text/html') ? await readFile(resolve(dist, file), 'utf8').catch(() => undefined) : undefined;
      const answer = await recordAnswer(request.id, response, ready.origin, html !== undefined ? { html, file, request } : undefined);
      await writeFile(resolve(out, `${request.id}.json`), serialise(storedAnswer(answer)));
    }
    const rawClosure = object((await send({ command: 'closure' })).functions);
    const config = await readDeploymentConfig(process.cwd(), resolve(dist));
    const closureReply = await send({ command: 'closure' });
    await writeFile(resolve(out, 'closure.json'), serialise({ functions: rawClosure, included: closureReply.included ?? config.included, includedByFunction: closureReply.includedByFunction }));
    await writeFile(resolve(out, 'index.json'), serialise({ schema: 2, target, requests: requests.map(request => request.id), catalogue: requests.map(request => ({ ...request, path: canonicalHtml(request.path) })), config: config.facts, normalisations }));
    rejectFallback();
    console.log(`Recorded ${requests.length} ${target} answers in ${out}`);
  } finally {
    process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
    child.kill('SIGTERM');
    if (child.exitCode === null && child.signalCode === null) await new Promise<void>(accept => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); accept(); }, 5000);
      child.once('exit', () => { clearTimeout(timer); accept(); });
    });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { target: { type: 'string' }, dist: { type: 'string' }, out: { type: 'string' } } });
    if (!['preview', 'netlify', 'cloudflare'].includes(values.target ?? '') || !values.dist || !values.out) throw new Error('Usage: record.mts --target preview|netlify|cloudflare --dist dist --out <empty dir>');
    const target = values.target;
    if (target !== 'preview' && target !== 'netlify' && target !== 'cloudflare') throw new Error('Invalid target');
    await record(target, values.dist, values.out);
  } catch (error) { console.error(String(error)); process.exitCode = 2; }
}
