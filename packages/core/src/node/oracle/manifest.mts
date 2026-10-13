import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { workspacePackageDirectories } from '../workspace-packages.mts';
import { requireRecord, requireString } from '../../validate.ts';

/** Workspace owners declare oracle generators and optional setup commands in package metadata. */
export function readOracleSetupManifest(root: string) {
  const oracles: Record<string, string> = {}, setup: Record<string, string> = {};
  const packages = resolve(root, 'packages');
  for (const owner of workspacePackageDirectories(root)) {
    const directory = resolve(packages, owner);
    const metadata = requireRecord(JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8')));
    if (metadata.oracleManifest === undefined) continue;
    const file = resolve(directory, requireString(metadata.oracleManifest));
    if (relative(directory, file).startsWith('..') || isAbsolute(relative(directory, file))) throw new Error('Oracle manifest must belong to its registering package.');
    const manifest = requireRecord(JSON.parse(readFileSync(file, 'utf8')));
    for (const [key, target] of [['oracles', oracles], ['setup', setup]] as const) {
      for (const [name, value] of Object.entries(requireRecord(manifest[key] ?? {}))) {
        const path = requireString(value), destination = resolve(root, path), within = relative(directory, destination);
        if (within.startsWith('..') || isAbsolute(within)) throw new Error(`Oracle generator must belong to its registering package: ${path}`);
        if (target[name] !== undefined) throw new Error(`Duplicate oracle ${key} registration: ${name}`);
        target[name] = path;
      }
    }
  }
  return { oracles, setup };
}
