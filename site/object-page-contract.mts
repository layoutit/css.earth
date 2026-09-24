import { isRecord } from '@cssearth/core';
const property = (value: unknown, key: string): unknown => isRecord(value) ? value[key] : undefined;
/** Package-owned styles in authored cascade order, shared by Astro and baking. */
export function objectPageStyles(descriptor: unknown): string[] {
  const styles = property(property(property(descriptor, 'properties'), 'page'), 'stylesheets');
  if (!Array.isArray(styles) || !styles.length || new Set(styles).size !== styles.length ||
      !styles.every((path): path is string => typeof path === 'string' && /^src\/[a-zA-Z0-9_./-]+\.css$/u.test(path) && !path.split('/').includes('..'))) {
    throw new TypeError(`${property(descriptor, 'id')}: invalid owned page stylesheets.`);
  }
  return [...styles, 'site/object-shell.css'];
}
