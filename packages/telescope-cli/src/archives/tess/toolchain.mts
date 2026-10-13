#!/usr/bin/env node
/** Install and locate the pinned photometry codes of toolchain.json under output/toolchains/tess (ignored by git).
 *
 *   node packages/telescope-cli/src/archives/tess/toolchain.mts install|verify
 *
 * A Python environment with the pinned packages. An installed toolchain keeps the text of its descriptor; `verify` and
 * `toolchainPaths` refuse one built from other pins. */
import { resolveInstalledToolchain, ensureToolchainPython, assertManagedPythonPlatform, telescopePythonEnvironment, assertInstalledMarker, type ToolchainPins, USER_ROOT } from '@cssearth/telescope-core/node';
import { packagePath } from '../../paths.mts';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const FILE = 'packages/telescope-cli/src/archives/tess/toolchain.json';
export const TESS_ROOT = resolve(USER_ROOT, 'output/toolchains/tess');
const INSTALL = 'node packages/telescope-cli/src/archives/tess/toolchain.mts install';

export async function toolchainPins(): Promise<ToolchainPins> {
  const descriptor = await readFile(packagePath(FILE), 'utf8'), entry = requireRecord(JSON.parse(descriptor) as unknown, FILE);
  return { id: requireString(entry.id, 'id'), file: FILE, descriptor, lock: null, entry };
}
function run(command: string, args: readonly string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: telescopePythonEnvironment() });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed in ${cwd} (status ${result.status}).`);
}

export async function installToolchain() {
  assertManagedPythonPlatform();
  return ensureToolchainPython(resolve(TESS_ROOT, 'venv'), toolchainPins, async pins => {
    run(resolve(TESS_ROOT, 'venv/bin/pip'), ['install', '--quiet', '--disable-pip-version-check', ...requireArray(pins.entry.requirements).map(value => requireString(value))], TESS_ROOT);
  });
}

/** The installed interpreter, refusing a missing install or one built from other pins. */
export async function toolchainPaths() {
  const pins = await toolchainPins();
  const root = resolveInstalledToolchain(TESS_ROOT, pins) ?? TESS_ROOT;
  assertInstalledMarker(root, pins, 'TESS photometry', INSTALL);
  return { python: resolve(root, 'venv/bin/python'), pins };
}

/** Run tools.py with the toolchain's interpreter and return the JSON document it printed. */
export function runTool(python: string, args: readonly string[]): unknown {
  const result = spawnSync(python, [packagePath('src/archives/tess/tools.py'), ...args], { encoding: 'utf8', maxBuffer: 1 << 28, env: telescopePythonEnvironment() });
  if (result.status !== 0) throw new Error(`tools.py ${args[0] ?? ''} failed (status ${result.status}): ${result.stderr.trim().split('\n').slice(-3).join(' ')}`);
  return JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2];
  if (command === 'install') console.log(`installed ${await installToolchain()}`);
  else if (command === 'verify') console.log(`verified ${(await toolchainPaths()).python}`);
  else throw new TypeError('Usage: toolchain.mts install|verify');
}
