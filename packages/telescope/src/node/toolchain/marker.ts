/** The marker an installed toolchain keeps: the descriptor and lock texts it was built from. A checkout whose texts differ is
 * asked to reinstall; the texts are compared whole, so no fingerprint of them is kept. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';
import { TOOLCHAINS } from '../paths.js';

export interface ToolchainPins { readonly id: string; readonly file: string; readonly descriptor: string; readonly lock: string | null; readonly entry: Record<string, unknown> }

/** Read a descriptor from `toolchains/` and, when it names one, the requirements lock beside it. */
export function readToolchainPins(id: string, file: string): ToolchainPins {
  const descriptor = readFileSync(resolve(TOOLCHAINS, file), 'utf8');
  const entry = requireRecord(JSON.parse(descriptor) as unknown, file);
  const lock = entry.requirements === undefined ? null : readFileSync(resolve(TOOLCHAINS, requireString(entry.requirements, `${file} requirements`)), 'utf8');
  return { id, file: `packages/telescope/toolchains/${file}`, descriptor, lock, entry };
}

export function writeInstalledMarker(root: string, pins: ToolchainPins): void {
  writeFileSync(resolve(root, 'installed.json'), `${JSON.stringify({ id: pins.id, descriptor: pins.descriptor, lock: pins.lock }, null, 2)}\n`);
}

/** Why `root` is not an install of `pins`, or null when it is one. */
export function installedMarkerIssue(root: string, pins: ToolchainPins): 'missing' | 'other-pins' | null {
  let marker: Record<string, unknown>;
  try { marker = requireRecord(JSON.parse(readFileSync(resolve(root, 'installed.json'), 'utf8')) as unknown, `${root}/installed.json`); }
  catch { return 'missing'; }
  return marker.id === pins.id && marker.descriptor === pins.descriptor && marker.lock === pins.lock ? null : 'other-pins';
}

/** Refuse a toolchain that is not installed from the current pins, naming the command that installs it. */
export function assertInstalledMarker(root: string, pins: ToolchainPins, name: string, install: string): void {
  const issue = installedMarkerIssue(root, pins);
  if (issue === 'missing') throw new Error(`The ${name} toolchain is not installed at ${root}: ${install}`);
  if (issue === 'other-pins') throw new Error(`The ${name} toolchain at ${root} was installed from other pins than ${pins.file}; reinstall it: ${install}`);
}
