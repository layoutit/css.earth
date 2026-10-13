/** Read compatible installs from their old homes; installers still write only to USER_ROOT. */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { relative, resolve } from 'node:path';
import { isTelescopeWorkspace, PACKAGE_ROOT, USER_ROOT, WORKSPACE } from '../paths.js';
import { installedMarkerIssue, type ToolchainPins } from './marker.js';

/** Legacy source checkouts are read-only candidates, not workspace admission. */
export function legacyWorkspaceRoots(): string[] {
  const source = resolve(PACKAGE_ROOT, '../..');
  return [...new Set([WORKSPACE, source].filter((root): root is string => root !== undefined && isTelescopeWorkspace(root)))];
}
export interface ToolchainSearch {
  readonly userRoot?: string; readonly home?: string; readonly env?: NodeJS.ProcessEnv; readonly workspaces?: readonly string[];
}
/** One candidate policy for Python, Julia and native archive environments. */
export function installedToolchainCandidates(root: string, pins: ToolchainPins, additional: readonly string[] = [], options: ToolchainSearch = {}): string[] {
  const user = options.userRoot ?? USER_ROOT, env = options.env ?? process.env;
  const part = relative(user, root);
  const candidates = [root, ...additional];
  if (env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME) candidates.push(resolve(env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME, part));
  for (const workspace of options.workspaces ?? legacyWorkspaceRoots()) candidates.push(resolve(workspace, part));
  if (pins.id === 'astroquery') {
    const cache = env.CSS_EARTH_ASTROQUERY_CACHE || resolve(options.home ?? homedir(), '.cache/css-earth/astroquery');
    const caches = [cache];
    if (env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME) caches.unshift(resolve(env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME, 'astroquery'));
    for (const parent of caches) {
      candidates.push(parent);
      for (const name of existsSync(parent) ? readdirSync(parent, { withFileTypes: true }) : [])
        if (name.isDirectory() || name.isSymbolicLink()) candidates.push(resolve(parent, name.name));
    }
  }
  return [...new Set(candidates)];
}
/** Exact descriptor/lock admission; owners retain their interpreter/binary checks. */
export function resolveInstalledToolchain(root: string, pins: ToolchainPins, additional: readonly string[] = [], options: ToolchainSearch = {}, required?: string): string | null {
  return installedToolchainCandidates(root, pins, additional, options).find(candidate =>
    installedMarkerIssue(candidate, pins) === null && (!required || existsSync(resolve(candidate, required)))) ?? null;
}
