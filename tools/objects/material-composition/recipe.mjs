/** Shared address and numeric checks run before raster allocation or writes. */
export function validateMaterialRecipe(config, schema) {
  if (config?.schema !== schema) throw new TypeError('Unsupported material capability recipe.');
  if (!/^[a-z][a-z0-9-]*$/.test(config.namespace)) throw new TypeError('Invalid material namespace.');
  if (typeof config.publicPrefix !== 'string' || !/^\/[a-z0-9/-]+\/$/.test(config.publicPrefix) || config.publicPrefix.includes('..')) throw new TypeError('Invalid material public prefix.');
  for (const filename of Object.values(config.files ?? {})) validateRelativePath(filename);
  const finite = value => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Material parameters must be finite.');
    if (value && typeof value === 'object') Object.values(value).forEach(finite);
  };
  finite(config.parameters);
  if (!Array.isArray(config.sourcePins) || !config.sourcePins.length) throw new TypeError('Material inputs require source pins.');
  return config;
}

export function validateRelativePath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) throw new TypeError('Unsafe material-relative path.');
  return path;
}
