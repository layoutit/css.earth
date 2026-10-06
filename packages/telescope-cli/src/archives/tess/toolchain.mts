#!/usr/bin/env node
/** Install and locate the pinned photometry codes of toolchain.json under output/toolchains/tess (ignored by git).
 *
 *   node packages/telescope-cli/src/archives/tess/toolchain.mts install|verify
 *
 * A Python environment with the pinned packages. An installed toolchain keeps the text of its descriptor; `verify` and
 * `toolchainPaths` refuse one built from other pins. */
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { assertInstalledMarker, WORKSPACE, writeInstalledMarker, type ToolchainPins } from '@cssearth/telescope/node';

const FILE = 'packages/telescope-cli/src/archives/tess/toolchain.json', ROOT = resolve(WORKSPACE, 'output/toolchains/tess'), INSTALL = 'node packages/telescope-cli/src/archives/tess/toolchain.mts install';

export async function toolchainPins(): Promise<ToolchainPins> {
  const descriptor = await readFile(resolve(import.meta.dirname, 'toolchain.json'), 'utf8'), entry = requireRecord(JSON.parse(descriptor) as unknown, FILE);
  return { id: requireString(entry.id, 'id'), file: FILE, descriptor, lock: null, entry };
}
function run(command: string, args: readonly string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed in ${cwd} (status ${result.status}).`);
}

export async function installToolchain() {
  const pins = await toolchainPins(), python = resolve(ROOT, 'venv/bin/python');
  await mkdir(ROOT, { recursive: true });
  if (!await access(python).then(() => true, () => false)) run(requireString(pins.entry.python, 'python'), ['-m', 'venv', resolve(ROOT, 'venv')], ROOT);
  run(resolve(ROOT, 'venv/bin/pip'), ['install', '--quiet', '--disable-pip-version-check', ...requireArray(pins.entry.requirements).map(value => requireString(value))], ROOT);
  writeInstalledMarker(ROOT, pins);
  return ROOT;
}

/** The installed interpreter, refusing a missing install or one built from other pins. */
export async function toolchainPaths() {
  const pins = await toolchainPins();
  assertInstalledMarker(ROOT, pins, 'TESS photometry', INSTALL);
  return { python: resolve(ROOT, 'venv/bin/python'), pins };
}

/** Run tools.py with the toolchain's interpreter and return the JSON document it printed. */
export function runTool(python: string, args: readonly string[]): unknown {
  const result = spawnSync(python, [resolve(import.meta.dirname, 'tools.py'), ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (result.status !== 0) throw new Error(`tools.py ${args[0] ?? ''} failed (status ${result.status}): ${result.stderr.trim().split('\n').slice(-3).join(' ')}`);
  return JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2];
  if (command === 'install') console.log(`installed ${await installToolchain()}`);
  else if (command === 'verify') console.log(`verified ${(await toolchainPaths()).python}`);
  else throw new TypeError('Usage: toolchain.mts install|verify');
}
