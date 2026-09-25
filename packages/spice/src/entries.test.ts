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

it('the main entry stays browser-safe: only node/ imports Node built-ins or uses Buffer, and nothing imports node/', async () => {
  const offenders: string[] = [];
  for (const path of await sources(source)) {
    const name = relative(source, path).replaceAll('\\', '/'), text = await readFile(path, 'utf8');
    if (name.startsWith('node/')) continue;
    const specifiers = [...text.matchAll(/from\s+['"]([^'"]+)['"]/gu)].map(match => match[1]!);
    for (const specifier of specifiers) if (specifier.startsWith('node:') || /(^|\/)node(\/|$)/u.test(specifier)) offenders.push(`${name} -> ${specifier}`);
    if (/\bBuffer\b/u.test(text)) offenders.push(`${name} -> Buffer`);
  }
  expect(offenders).toEqual([]);
});
