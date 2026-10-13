import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** Match the top-level packages/* workspace: restored dist-only folders are not packages. */
export function workspacePackageDirectories(root: string): string[] {
  return readdirSync(resolve(root, 'packages'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(resolve(root, 'packages', entry.name, 'package.json')))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b, 'en'));
}
