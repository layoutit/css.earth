import { isRecord } from '@cssearth/core';
const property = (value: unknown, key: string): unknown => isRecord(value) ? value[key] : undefined;
/** The shell stylesheet's file. */
export const SHELL_STYLE_FILE = 'site/layouts/object-shell.css';
/** The shell stylesheet's identity in `data-object-style`, serialized into every page: it names the file's former place and stays as published. */
export const SHELL_STYLE_ID = 'site/object-shell.css';
/** Package-owned styles in authored cascade order, shared by Astro and baking. */
export function objectPageStyles(descriptor: unknown, { navigation = false } = {}): string[] {
  const styles = property(property(property(descriptor, 'properties'), 'page'), 'stylesheets');
  if (!Array.isArray(styles) || !styles.length || new Set(styles).size !== styles.length ||
      !styles.every((path): path is string => typeof path === 'string' && /^src\/[a-zA-Z0-9_./-]+\.css$/u.test(path) && !path.split('/').includes('..'))) {
    throw new TypeError(`${property(descriptor, 'id')}: invalid owned page stylesheets.`);
  }
  // The initial page installs the shell once; navigation only transports the
  // destination's authored styles into that retained shell.
  return navigation ? styles : [...styles, SHELL_STYLE_FILE];
}
