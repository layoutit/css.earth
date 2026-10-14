/** User outputs belong to the command's working folder; check it before archive work. */
import { access, mkdir, open, rm, stat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { hasErrorCode } from '@cssearth/core';

export class UnwritableDirectoryError extends Error {
  constructor(path: string) {
    super(`Can't write here (${path}). Run from a folder you can write to, or pass --out DIR.`);
  }
}
export const currentDirectory = (): string => process.cwd();
export function runDirectory(target: string): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/gu, '');
  const name = target.toLowerCase().replace(/[^a-z0-9.-]+/gu, '-').replace(/^-|-$/gu, '') || 'unknown-target';
  return resolve(currentDirectory(), 'telescope-runs', `${name}-${stamp}-${randomUUID().slice(0, 8)}`);
}
/** Probe the nearest existing parent without creating a run or changing an explicit destination. */
export async function assertWritableDirectory(destination = currentDirectory()): Promise<void> {
  const requested = resolve(destination);
  let parent = requested;
  try {
    for (;;) {
      try { if (!(await stat(parent)).isDirectory()) throw new Error('Not a directory'); break; }
      catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; const next = dirname(parent); if (next === parent) throw error; parent = next; }
    }
    await access(parent, constants.W_OK);
    const probe = resolve(parent, `.telescope-write-${randomUUID()}`), file = await open(probe, 'wx', 0o600);
    try { await file.close(); } finally { await rm(probe); }
  } catch { throw new UnwritableDirectoryError(requested); }
}
export async function prepareRunDirectory(target: string, explicit?: string): Promise<string> {
  await assertWritableDirectory(explicit);
  const directory = explicit === undefined ? runDirectory(target) : resolve(explicit);
  await mkdir(directory, { recursive: true });
  return directory;
}

/** Inspection belongs to the saved run, or the containing folder of a standalone artifact. */
export async function inspectionDirectory(artifact: string, explicit?: string): Promise<string> {
  const containing = dirname(resolve(artifact));
  let owner = containing;
  for (let directory = containing;; directory = dirname(directory)) {
    if (await Promise.all(['explore.json', 'query.json'].map(name => stat(resolve(directory, name)).then(file => file.isFile()).catch(error => {
      if (hasErrorCode(error, 'ENOENT')) return false; throw error;
    }))).then(records => records.some(Boolean))) { owner = directory; break; }
    if (dirname(directory) === directory) break;
  }
  const realOwner = await realpath(owner), destination = explicit ? await realpath(explicit) : realOwner;
  const part = relative(realOwner, destination);
  if (part === '..' || part.startsWith('../') || isAbsolute(part) || !(await stat(destination)).isDirectory())
    throw new TypeError('outputs --out must name an existing folder inside the artifact’s run.');
  return destination;
}

/** Read a delivered record's target without doing archive work. */
export async function artifactRunName(path: string, fallback: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  const { requireRecord } = await import('@cssearth/core');
  try {
    const value = requireRecord(JSON.parse(await readFile(path, 'utf8')));
    const parameters = value.parameters && typeof value.parameters === 'object' ? requireRecord(value.parameters) : undefined;
    const rawContext = value.context ?? parameters?.sourceContext, context = rawContext && typeof rawContext === 'object' ? requireRecord(rawContext) : undefined;
    const target = value.target ?? context?.target ?? (context?.request && typeof context.request === 'object' ? requireRecord(context.request).target : undefined) ?? parameters?.target ?? value.id;
    if (typeof target === 'string' && target) return target;
    const rawRegion = context?.region;
    if (rawRegion && typeof rawRegion === 'object') {
      const region = requireRecord(rawRegion);
      if (typeof region.raDegrees === 'number' && typeof region.decDegrees === 'number') return `field-${region.raDegrees}-${region.decDegrees}`;
    }
  } catch { /* The operation's owner reports an invalid artifact. */ }
  return fallback;
}
