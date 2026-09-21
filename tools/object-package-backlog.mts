import { isArray } from '../src/platform/is-array.mts';
import { readFile } from 'node:fs/promises';
import { posix, resolve } from 'node:path';

export type ObjectPackageBacklog = {
  schemaVersion: 1;
  baselineCommit: string;
  note: string;
  missingPackageFiles: readonly string[];
};

const backlogPath = 'tools/object-package-backlog.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArray(value);
}

function requireCondition(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function validRelativePath(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && !value.includes('\\')
    && !value.startsWith('/') && posix.normalize(value) === value
    && value !== '..' && !value.startsWith('../');
}

export async function loadObjectPackageBacklog(root = process.cwd()): Promise<ObjectPackageBacklog> {
  const value: unknown = JSON.parse(await readFile(resolve(root, backlogPath), 'utf8'));
  requireCondition(isRecord(value) && value.schemaVersion === 1, 'Invalid object package backlog schema.');
  requireCondition(typeof value.baselineCommit === 'string' && /^[a-f0-9]{40}$/u.test(value.baselineCommit),
    'The object package backlog baseline must be a full source commit.');
  requireCondition(typeof value.note === 'string' && value.note.trim().length > 0, 'The object package backlog needs a non-empty note.');
  requireCondition(isArray(value.missingPackageFiles) && value.missingPackageFiles.every(validRelativePath),
    'missingPackageFiles must contain repository-relative POSIX paths.');
  requireCondition(JSON.stringify(value.missingPackageFiles) === JSON.stringify([...value.missingPackageFiles].sort()),
    'Keep the object package backlog sorted.');
  requireCondition(new Set(value.missingPackageFiles).size === value.missingPackageFiles.length,
    'Duplicate object package backlog entry.');
  return value as ObjectPackageBacklog;
}

export function compareObjectPackageBacklog(baseline: readonly string[], observed: readonly string[]): {
  added: readonly string[];
  resolved: readonly string[];
} {
  const baselineSet = new Set(baseline), observedSet = new Set(observed);
  return {
    added: observed.filter(path => !baselineSet.has(path)).sort(),
    resolved: baseline.filter(path => !observedSet.has(path)).sort(),
  };
}
