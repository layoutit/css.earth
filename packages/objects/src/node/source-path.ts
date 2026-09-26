import { posix, win32 } from 'node:path';

/** A normalized source-tree-relative path on both POSIX and Windows. */
export function safeRelativePath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.includes('\0') &&
    !posix.isAbsolute(value) && !win32.isAbsolute(value) &&
    posix.normalize(value) === value && value !== '.' && !value.startsWith('../');
}
