/** A recipe's file name, relative to its source folder: no absolute path, backslash, empty, `.` or `..` part. */
export function validateRelativePath(path: unknown) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) throw new TypeError('Unsafe material-relative path.');
  return path;
}
