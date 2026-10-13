import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/** CI owns its bootstrap reader: classification checks out these scripts, not core's oracle reader. */
export function workspacePackageDirectories(root: string, { requireManifest = true }: { requireManifest?: boolean } = {}): string[] {
  return readdirSync(resolve(root, 'packages'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && (!requireManifest
      || statSync(resolve(root, 'packages', entry.name, 'package.json'), { throwIfNoEntry: false })?.isFile() === true))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b, 'en'));
}
