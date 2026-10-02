import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';

export interface ContainmentPolicy {
  policy: 'lexical' | 'realpath';
  rootPath: 'allow' | 'reject';
  parentSeparator: 'posix' | 'native';
  absoluteOffset: 'allow' | 'reject';
}

function contained(root: string, candidate: string, options: ContainmentPolicy): string | undefined {
  const offset = relative(root, candidate);
  if ((!offset && options.rootPath === 'reject') || offset === '..' ||
      offset.startsWith(`..${options.parentSeparator === 'native' ? sep : '/'}`) ||
      (options.absoluteOffset === 'reject' && isAbsolute(offset))) return undefined;
  return candidate;
}

/** Caller-specific input validation and path rewriting happen before containment. */
export function containedPath(root: string, candidate: string, options: ContainmentPolicy & { policy: 'lexical' }): string | undefined;
export function containedPath(root: string, candidate: string, options: ContainmentPolicy & { policy: 'realpath' }): Promise<string | undefined>;
export function containedPath(root: string, candidate: string, options: ContainmentPolicy): string | undefined | Promise<string | undefined> {
  if (options.policy === 'lexical') return contained(root, candidate, options);
  // Preserve candidate-before-root resolution and propagate filesystem errors unchanged.
  return realpath(candidate).then(async actual => contained(await realpath(root), actual, options));
}
