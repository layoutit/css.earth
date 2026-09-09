/** Package-owned styles in authored cascade order, shared by Astro and baking. */
export function objectPageStyles(descriptor) {
  const styles = descriptor.properties?.page?.stylesheets;
  if (!Array.isArray(styles) || !styles.length || new Set(styles).size !== styles.length ||
      styles.some(path => typeof path !== 'string' || !/^src\/[a-zA-Z0-9_./-]+\.css$/u.test(path) || path.split('/').includes('..'))) {
    throw new TypeError(`${descriptor.id}: invalid owned page stylesheets.`);
  }
  return [...styles, 'site/planet-shell.css'];
}
