import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

export type MissingRoot =
  | { behavior: 'throw'; error?: () => Error }
  | { behavior: 'undefined' }
  | { behavior: 'fallback'; directory: string };
type RequiredRoot = Exclude<MissingRoot, { behavior: 'undefined' }>;
type RootLocation =
  | { strategy: 'ancestor-marker'; startDirectory: string; marker: string }
  | { strategy: 'package-location'; fromUrl: string | URL; packageSpecifier: string; rootOffset: string };

function missingRoot(policy: MissingRoot, error: unknown): string | undefined {
  if (policy.behavior === 'fallback') return policy.directory;
  if (policy.behavior === 'undefined') return undefined;
  throw policy.error ? policy.error() : error;
}

/** Locations are supplied by the caller, never inferred from this helper's module or cwd. */
export function discoverRoot(options: RootLocation & { missing: RequiredRoot }): string;
export function discoverRoot(options: RootLocation & { missing: MissingRoot }): string | undefined;
export function discoverRoot(options: RootLocation & { missing: MissingRoot }): string | undefined {
  if (options.strategy === 'package-location') {
    try {
      return resolve(dirname(createRequire(options.fromUrl).resolve(options.packageSpecifier)), options.rootOffset);
    } catch (error) { return missingRoot(options.missing, error); }
  }
  for (let directory = options.startDirectory; ; directory = dirname(directory)) {
    if (existsSync(resolve(directory, options.marker))) return directory;
    if (dirname(directory) === directory) return missingRoot(options.missing,
      new Error(`No ${options.marker} above ${options.startDirectory}.`));
  }
}

const execFileAsync = promisify(execFile);
/** Git lookup remains asynchronous; callers own caching. Without a `startDirectory` git inherits the process's cwd at call time. */
export function discoverGitRoot(options: { startDirectory?: string; missing: RequiredRoot }): Promise<string>;
export function discoverGitRoot(options: { startDirectory?: string; missing: MissingRoot }): Promise<string | undefined>;
export async function discoverGitRoot(options: { startDirectory?: string; missing: MissingRoot }): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: options.startDirectory });
    return stdout.trim();
  } catch (error) { return missingRoot(options.missing, error); }
}
