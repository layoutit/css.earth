#!/usr/bin/env node
/** Run a repository .mts entry point only on a Node version that loads TypeScript without a custom loader. */
import { existsSync, readdirSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const supported = version => { const [major, minor] = version.split('.').map(Number); return major === 22 ? minor >= 18 : major >= 24; };

if (!supported(process.versions.node)) {
  const candidates = [];
  if (process.env.CSSEARTH_NODE) candidates.push(process.env.CSSEARTH_NODE);
  const nvm = process.env.NVM_DIR ?? (process.env.HOME ? resolve(process.env.HOME, '.nvm') : undefined);
  if (nvm && existsSync(resolve(nvm, 'versions/node'))) for (const version of readdirSync(resolve(nvm, 'versions/node')))
    candidates.push(resolve(nvm, 'versions/node', version, 'bin/node'));
  const executable = candidates.filter(path => existsSync(path)).map(path => ({ path, version: spawnSync(path, ['--version'], { encoding: 'utf8' }).stdout.trim().replace(/^v/u, '') }))
    .filter(entry => supported(entry.version)).sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
  if (!executable) {
    console.error(`This command requires Node 22.18.x or Node 24+; the current runtime is Node ${process.versions.node}. Set CSSEARTH_NODE to a compatible Node executable.`);
    process.exit(1);
  }
  const result = spawnSync(executable.path, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, PATH: `${dirname(executable.path)}${delimiter}${process.env.PATH ?? ''}` } });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

const entry = process.argv[2];
if (!entry) {
  console.error('Usage: run-typed-module.mjs <entry.mts> [arguments]');
  process.exit(2);
}
const path = resolve(entry);
process.argv.splice(1, 2, path);
await import(pathToFileURL(path).href);
