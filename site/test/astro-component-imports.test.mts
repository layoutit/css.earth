import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Only Astro resolves a component's frontmatter, so a wrong relative path there
// is invisible to every node test and fails the whole page at request time.
const directories = ['site/components', 'atlas/src/components'];
const specifier = /^\s*import\s[^'"]*['"](\.[^'"]+)['"]/gmu;

test('every relative import in an Astro component frontmatter resolves to a file', async () => {
  let checked = 0;
  for (const directory of directories) {
    for (const name of await readdir(resolve(directory))) {
      if (!name.endsWith('.astro')) continue;
      const path = resolve(directory, name);
      const source = await readFile(path, 'utf8');
      const frontmatter = source.startsWith('---') ? source.slice(3, source.indexOf('\n---', 3)) : '';
      for (const [, target] of frontmatter.matchAll(specifier)) {
        checked++;
        // Type-only specifiers may drop the extension; the path itself still has to exist.
        // A specifier may drop the extension, carry a Vite query, or name the built
        // .js of a TypeScript source; the directory and base name still have to exist.
        const base = resolve(dirname(path), target!.split('?')[0]!);
        const candidates = [base, ...['.ts', '.mts', '.d.ts', '.d.mts'].map(extension => base + extension),
          ...['.js', '.mjs'].flatMap(built => base.endsWith(built)
            ? ['.ts', '.mts'].map(source => base.slice(0, -built.length) + source) : [])];
        const found = candidates.some(candidate => existsSync(candidate));
        assert.ok(found, `${directory}/${name} imports ${target}, which is not a file`);
      }
    }
  }
  assert.ok(checked > 100, `expected the component frontmatter to be read, saw ${checked} imports`);
});
