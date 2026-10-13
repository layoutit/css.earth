import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const COMPILED_PAGE_STYLES = 'output/static-page-styles/styles.json';
export const staticPageStylesEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => env.CSSEARTH_STATIC_STYLES === '1';

/** Private build transport: Vite has already processed these strings, including imported CSS and asset URLs. */
export async function readCompiledPageStyles(root: string): Promise<Readonly<Record<string, string>>> {
  const value: unknown = JSON.parse(await readFile(resolve(root, COMPILED_PAGE_STYLES), 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !Object.entries(value).every(([path, css]) => /^(?:src|site)\/.+\.css$/u.test(path) && typeof css === 'string')) {
    throw new TypeError('Invalid compiled page stylesheet transport.');
  }
  return Object.fromEntries(Object.entries(value));
}
