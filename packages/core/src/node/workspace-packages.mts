import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/** Match the top-level packages/* workspace: restored dist-only folders are not packages. */
export function workspacePackageDirectories(root: string, { requireManifest = true }: { requireManifest?: boolean } = {}): string[] {
  return readdirSync(resolve(root, 'packages'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && (!requireManifest || hasPackageManifest(resolve(root, 'packages', entry.name))))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b, 'en'));
}

/** A restored directory (even one named package.json) is not a package manifest. */
function hasPackageManifest(directory: string): boolean {
  return statSync(resolve(directory, 'package.json'), { throwIfNoEntry: false })?.isFile() === true;
}
