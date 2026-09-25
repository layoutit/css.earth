import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const source = fileURLToPath(new URL('.', import.meta.url));

async function sources(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await sources(path));
    else if (/\.ts$/u.test(entry.name) && !/\.test\.ts$/u.test(entry.name)) found.push(path);
  }
  return found;
}
const specifiers = (text: string) => [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/gu)].map(match => match[1]!);

it('the main volume entry stays host-neutral: only volume/node imports Node built-ins, sharp or Buffer, and nothing imports volume/node', async () => {
  const offenders: string[] = [];
  for (const path of await sources(join(source, 'volume'))) {
    const name = relative(source, path).replaceAll('\\', '/'), text = await readFile(path, 'utf8');
    if (name.startsWith('volume/node/')) continue;
    for (const specifier of specifiers(text)) {
      if (specifier.startsWith('node:') || /^(?:react(?:-dom)?(?:\/|$)|sharp$|vite$|@layoutit\/polycss$)/u.test(specifier) ||
          /(^|\/)node(\/|\.ts$|$)/u.test(specifier)) offenders.push(`${name} -> ${specifier}`);
    }
    if (/\bBuffer\b/u.test(text)) offenders.push(`${name} -> Buffer`);
  }
  expect(offenders).toEqual([]);
});

it('topics do not import each other sideways, the application, or another package\'s sources', async () => {
  const offenders: string[] = [];
  for (const path of await sources(source)) {
    const name = relative(source, path).replaceAll('\\', '/'), topic = name.split('/')[0]!, text = await readFile(path, 'utf8');
    for (const specifier of specifiers(text)) {
      if (specifier.startsWith('@cssearth/bake')) offenders.push(`${name} -> ${specifier}`);
      if (!specifier.startsWith('.')) continue;
      const target = relative(source, join(path, '..', specifier)).replaceAll('\\', '/');
      if (target.startsWith('..') || target.split('/')[0] !== topic) offenders.push(`${name} -> ${specifier}`);
    }
  }
  expect(offenders).toEqual([]);
});
