import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { checkDeclaredDependencies } from './declared-dependencies.mts';

// Exercise the checkout reader, not a separately supplied list of bundled package names.
test('explicit tsup inlining satisfies declared dev dependencies, including subpaths and declarations', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'bundled-declarations-'));
  const files = ['packages/app/package.json', 'packages/lib/package.json', 'packages/app/tsup.config.ts', 'packages/app/src/read.ts'];
  const write = (path: string, text: string) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), text); };
  const manifest = { name: '@x/app', devDependencies: { '@x/lib': 'workspace:*' } };
  const good = "export default defineConfig({noExternal: [/^@x\\//], dts: {resolve: [/^@x\\//]}});";
  try {
    write(files[0]!, JSON.stringify(manifest)); write(files[1]!, '{"name":"@x/lib"}');
    write(files[3]!, "import { value } from '@x/lib/node'; type T = typeof import('@x/lib');");
    write(files[2]!, good);
    assert.deepEqual(checkDeclaredDependencies(root, files), []);
    for (const config of [
      good.replace('noExternal:', 'unused:'), // Removing the actual build property must fail.
      good.replace('resolve:', 'unused:'), // Bundled JS alone does not satisfy public declarations.
      "export default defineConfig({noExternal: ['@x/other']});",
      "export default defineConfig({noExternal: ['@x/lib'], external: ['@x/lib']});",
      "export default defineConfig({noExternal: ['@x/lib'], external: computeExternal()});",
      "export default defineConfig({noExternal: ['@x/lib'], bundle: false});",
      "export default defineConfig({noExternal: ['@x/lib'], bundle: bundleMode()});",
      "export default defineConfig({noExternal: [/^@x\\//g]});",
      "export default defineConfig({noExternal: ['@x/lib'], dts: {resolve: ['@x/lib'], ...overrides}});",
      "export default defineConfig({noExternal: ['@x/lib'], ...overrides});",
      "const example = {noExternal: ['@x/lib']}; export default defineConfig({});",
    ]) {
      write(files[2]!, config);
      assert.match(checkDeclaredDependencies(root, files)[0]!, /only in devDependencies/u, config);
    }
    for (const noExternal of ["['@x/lib']", '[/^@x\\//]']) {
      write(files[2]!, `export default defineConfig({noExternal: ${noExternal}, dts: false});`);
      assert.deepEqual(checkDeclaredDependencies(root, files), []);
    }
    write(files[2]!, good); write(files[0]!, '{"name":"@x/app"}');
    assert.match(checkDeclaredDependencies(root, files)[0]!, /does not declare/u, 'inlining never exempts undeclared imports');
    write(files[0]!, JSON.stringify(manifest));
    assert.deepEqual(checkDeclaredDependencies(root, files), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
