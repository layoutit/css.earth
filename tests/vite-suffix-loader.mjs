// Node loader for the two Vite import suffixes the site build owners use: `?raw` (file text as the default export) and
// `?url` (the file's path as the default export). Registered by `pnpm test:node`, so those owners load under plain node.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SUFFIX = /\?(raw|url)$/u;

export async function resolve(specifier, context, next) {
  const match = SUFFIX.exec(specifier);
  if (!match) {
    // A TypeScript source names its sibling by the emitted `.js`; under plain node the `.ts` beside it is the file.
    if (specifier.startsWith('.') && specifier.endsWith('.js')) {
      try { return await next(specifier, context); }
      catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; return next(specifier.slice(0, -3) + '.ts', context); }
    }
    return next(specifier, context);
  }
  const resolved = await next(specifier.slice(0, -match[0].length), context);
  return { ...resolved, url: `${resolved.url}?${match[1]}`, format: 'module' };
}

export async function load(url, context, next) {
  const match = SUFFIX.exec(url);
  if (!match) return next(url, context);
  const path = fileURLToPath(url.slice(0, -match[0].length));
  const source = match[1] === 'raw' ? await readFile(path, 'utf8') : path;
  return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(source)};` };
}
