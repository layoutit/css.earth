#!/usr/bin/env node
/**
 * Release gate: cold loads on the connected iPad with a slow world summary.
 *
 * Safari on a slow connection once ran a module before a dependency it shared with another import, and the page never
 * started; headless WebKit and Chromium did not reproduce it. This serves a running production preview through a proxy
 * that holds the world summary back, cold-loads each page in the visible Safari tab, one after another, and exits 1 if
 * any load does not reach `data-ready="true"`.
 *
 *   node labs/performance/ipad-slow-start.mts [--target 4216] [--port 4218] [--delay 1200] [--rounds 2] /earth/ /itokawa/
 */
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { promisify } from 'node:util';
import { lanAddress } from './ipad.mts';

const exec = promisify(execFile);
const args = process.argv.slice(2);
const pages = args.filter((arg, index) => arg.startsWith('/') && !args[index - 1]?.startsWith('--'));
const number = (flag: string, fallback: number) => {
  const value = Number(args[args.indexOf(flag) + 1]);
  return args.includes(flag) && Number.isFinite(value) ? value : fallback;
};
const target = number('--target', 4216), port = number('--port', 4218), delay = number('--delay', 1200), rounds = number('--rounds', 2);
if (pages.length === 0) throw new TypeError('Pass the site paths to load, such as /earth/ /itokawa/.');

const proxy = http.createServer((request, response) => {
  const forward = () => {
    const upstream = http.request({ host: '127.0.0.1', port: target, path: request.url, method: request.method, headers: request.headers }, answer => {
      response.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(response);
    });
    upstream.on('error', () => { response.writeHead(502); response.end(); });
    request.pipe(upstream);
  };
  if (/\/world(?:\.[\w-]+)?\.json(?:\?|$)/u.test(request.url ?? '')) setTimeout(forward, delay); else forward();
});
await new Promise<void>(listening => proxy.listen(port, '0.0.0.0', listening));

const ready = `(async () => {
  const deadline = Date.now() + 60000;
  while (document.documentElement.dataset.ready !== 'true') {
    if (document.documentElement.dataset.ready === 'error') throw new Error('The scene failed to start.');
    if (Date.now() >= deadline) throw new Error('The scene was not ready within 60 s.');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return { action: 'ready', at: location.pathname };
})()`;
await mkdir('output/performance', { recursive: true });
const steps = 'output/performance/slow-start-steps.json';
await writeFile(steps, JSON.stringify([{ script: ready }]));

const origin = `http://${lanAddress()}:${port}`;
const capture = (name: string, rest: string[]) => exec(process.execPath, ['labs/performance/ios-capture.mts', '--device', '--name', name, ...rest],
  { maxBuffer: 16 * 1024 * 1024 });
let failed = 0, loads = 0;
try {
  // The cold load reloads the visible tab, so the tab is first put on this origin.
  await capture('slow-start-open', ['--open', `${origin}${pages[0]}`, '--seconds', '1']).catch(() => {});
  for (let round = 0; round < rounds; round++) for (const page of pages) {
    loads++;
    try {
      await capture('slow-start', ['--cold-load', '--open', `${origin}${page}`, '--steps', steps]);
      console.log(`started  ${page}`);
    } catch (error) {
      failed++;
      const text = error instanceof Error ? error.message : String(error);
      console.log(`FAILED   ${page}\n${text.split('\n').filter(Boolean).slice(-3).join('\n').slice(0, 3000)}`);
    }
  }
} finally {
  proxy.close();
}
console.log(`${loads - failed} of ${loads} cold loads started with the world summary held back ${delay} ms.`);
process.exit(failed === 0 ? 0 : 1);
