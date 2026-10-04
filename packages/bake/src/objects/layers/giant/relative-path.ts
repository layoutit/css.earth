import { readNonemptyText } from '@cssearth/core';

/** Source-relative material paths reject separators and dot segments rather than normalizing them. */
const MATERIAL_RELATIVE_PATH_POLICY = { absolutePrefix: '/', forbiddenSeparator: '\\', forbiddenSegments: ['', '.', '..'] };
const unsafePath = (): never => { throw new TypeError('Unsafe material-relative path.'); };

/** A recipe's file name, relative to its source folder: no absolute path, backslash, empty, `.` or `..` part. */
export function validateRelativePath(input: unknown) {
  const path = readNonemptyText(input, 'material-relative path', unsafePath);
  if (path.startsWith(MATERIAL_RELATIVE_PATH_POLICY.absolutePrefix) || path.includes(MATERIAL_RELATIVE_PATH_POLICY.forbiddenSeparator) ||
      path.split('/').some(part => MATERIAL_RELATIVE_PATH_POLICY.forbiddenSegments.includes(part))) unsafePath();
  return path;
}
