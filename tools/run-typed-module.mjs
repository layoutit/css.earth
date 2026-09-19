#!/usr/bin/env node
/** Run a repository .mts entry point only on a Node version that loads TypeScript without a custom loader. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [major, minor] = process.versions.node.split('.').map(Number);
const supported = major === 22 ? minor >= 18 : major >= 24;
if (!supported) {
  console.error(`This command requires Node 22.18.x or Node 24+; the current runtime is Node ${process.versions.node}.`);
  process.exit(1);
}

const entry = process.argv[2];
if (!entry) {
  console.error('Usage: run-typed-module.mjs <entry.mts> [arguments]');
  process.exit(2);
}
const path = resolve(entry);
process.argv.splice(1, 2, path);
await import(pathToFileURL(path).href);
