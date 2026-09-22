import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { checkNebulaInboundBoundaries } from './inbound-boundaries.mts';

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'nebula-inbound-'));
  const write = (path: string, source: string) => { const file = resolve(root, path); mkdirSync(resolve(file, '..'), { recursive: true }); writeFileSync(file, source); };
  const owners = { 'volume-core': '@cssearth/volume-core', 'volume-bake': '@cssearth/volume-bake', lab: '@cssearth/nebula-lab', reconstruction: '@cssearth/nebula-reconstruction', 'volume-viewer': '@cssearth/volume-viewer' };
  write('package.json', JSON.stringify({ type: 'module', devDependencies: Object.fromEntries(Object.values(owners).map(name => [name, 'workspace:*'])) }));
  for (const [owner, name] of Object.entries(owners)) {
    write(`labs/nebula/packages/${owner}/package.json`, JSON.stringify({ name, exports: { './public': './src/public.ts' } }));
    write(`labs/nebula/packages/${owner}/src/public.ts`, 'export const value = 1; export type Contract = number;');
  }
  return { root, write, check: () => checkNebulaInboundBoundaries(root), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('normal runtime and preparation reject all public research imports, including erased types and reexports', () => {
  const f = fixture();
  try {
    for (const path of ['site/runtime.mts', 'src/runtime.ts', 'packages/engine/src/runtime.ts', 'tools/nebula/application/prepare.ts']) {
      for (const name of ['nebula-lab', 'nebula-reconstruction', 'volume-viewer']) {
        for (const source of [
          `import '@cssearth/${name}/public';`, `export * from '@cssearth/${name}/public';`,
          `export type { Contract } from '@cssearth/${name}/public';`, `import type { Contract } from '@cssearth/${name}/public';`,
          `type T = import('@cssearth/${name}/public').Contract;`, `import('@cssearth/${name}/public');`,
          `require('@cssearth/${name}/public');`, `const load = require; load('@cssearth/${name}/public');`, `import owner = require('@cssearth/${name}/public');`,
          `const owner = '@cssearth/${name}/public'; import(owner);`,
          `import('@cssearth/' + '${name}/public');`,
          `import { createRequire as factory } from 'node:module'; const load = factory(import.meta.url); load('@cssearth/${name}/public');`,
        ]) {
          f.write(path, source); assert.ok(f.check().some(error => error.includes('closure forbids')), `${path}: ${source}`);
        }
      }
      f.write(path, 'export {};');
    }
  } finally { f.cleanup(); }
});

test('preparation accepts public core/bake while runtime accepts only explicitly erased core imports', () => {
  const f = fixture();
  try {
    f.write('tools/prepare.mts', "import {value} from '@cssearth/volume-bake/public'; export {value as core} from '@cssearth/volume-core/public';");
    for (const source of ["import type {Contract} from '@cssearth/volume-core/public';", "import {type Contract} from '@cssearth/volume-core/public';",
      "export type {Contract} from '@cssearth/volume-core/public';", "export {type Contract} from '@cssearth/volume-core/public';",
      "type T = import('@cssearth/volume-core/public').Contract;"]) {
      f.write('site/runtime.mts', source); assert.deepEqual(f.check(), [], source);
    }
    for (const source of ["import '@cssearth/volume-core/public';", "import {value,type Contract} from '@cssearth/volume-core/public';",
      "export * from '@cssearth/volume-core/public';", "import type {Contract} from '@cssearth/volume-bake/public';"]) {
      f.write('site/runtime.mts', source); assert.ok(f.check().some(error => error.includes('runtime closure forbids')), source);
    }
    f.write('site/runtime.mts', 'export {};');
    f.write('tools/prepare.mts', "import '@cssearth/volume-bake/src/private';");
    assert.ok(f.check().some(error => error.includes('non-public nebula import')));
  } finally { f.cleanup(); }
});

test('relative, absolute, URL, traversal and tsconfig aliases cannot enter the lab source tree', () => {
  const f = fixture();
  try {
    for (const source of [
      "export * from '../labs/nebula/packages/volume-core/src/public.ts';",
      "import '../src/../labs/nebula/packages/lab/src/private.ts';",
      "import('/labs/nebula/packages/reconstruction/src/public.ts');",
      `import('${resolve(f.root, 'labs/nebula/packages/volume-viewer/src/public.ts')}');`,
      `import('file://${resolve(f.root, 'labs/nebula/packages/volume-viewer/src/public.ts')}');`,
      "import(new URL('../labs/nebula/packages/lab/src/public.ts', import.meta.url).href);",
    ]) {
      f.write('tools/prepare.mts', source); assert.ok(f.check().some(error => error.includes('direct path into labs/nebula')), source);
    }
    f.write('tsconfig.base.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@research/*': ['labs/nebula/packages/lab/src/*'], '@cssearth/volume-core/*': ['labs/nebula/packages/lab/src/*'] } } }));
    f.write('tsconfig.json', JSON.stringify({ extends: './tsconfig.base.json' }));
    for (const path of ['public', 'not-yet-created']) {
      f.write('tools/prepare.mts', `import '@research/${path}';`); assert.ok(f.check().some(error => error.includes('direct path into labs/nebula')));
    }
    f.write('tools/prepare.mts', "import '@cssearth/volume-core/public';");
    assert.ok(f.check().some(error => error.includes('package alias escapes')));
  } finally { f.cleanup(); }
});

test('test exceptions and preparation wrappers cannot be used as inbound runtime bypasses', () => {
  const f = fixture();
  try {
    f.write('src/check.test.ts', "import '@cssearth/volume-viewer/public';");
    assert.deepEqual(f.check(), []);
    f.write('site/runtime.mts', "export * from '../src/check.test.ts';");
    assert.ok(f.check().some(error => error.includes('runtime closure forbids') && error.includes('via src/check.test.ts')));
    f.write('src/check.test.ts', 'export {};');
    f.write('tools/prepare.mts', "export * from '@cssearth/volume-bake/public';");
    f.write('site/runtime.mts', "import '../tools/prepare.mts';");
    assert.ok(f.check().some(error => error.includes('runtime closure forbids') && error.includes('via tools/prepare.mts')));
    f.write('site/runtime.mts', 'export {};');
    f.write('src/check.test.ts', "import '../labs/nebula/packages/volume-viewer/src/public.ts';");
    assert.ok(f.check().some(error => error.includes('direct path into labs/nebula')), 'tests must use public exports too');
  } finally { f.cleanup(); }
});

test('root research dependencies remain development-only and computed policy stays scoped', () => {
  const f = fixture();
  try {
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      f.write('package.json', JSON.stringify({ [field]: { '@cssearth/nebula-lab': 'workspace:*', '@cssearth/nebula-reconstruction': 'workspace:*', '@cssearth/volume-viewer': 'workspace:*' } }));
      assert.equal(f.check().filter(error => error.includes('must remain a devDependency')).length, 3);
    }
    f.write('package.json', JSON.stringify({ dependencies: { '@cssearth/volume-core': 'workspace:*', '@cssearth/volume-bake': 'workspace:*' } }));
    f.write('site/plugin.mts', 'export const load = (plugin: string) => import(plugin);');
    assert.deepEqual(f.check(), []);
    f.write('tools/nebula/application/load.ts', 'export const load = (plugin: string) => import(plugin);');
    assert.ok(f.check().some(error => error.includes('unchecked computed nebula')));
    f.write('tools/nebula/application/load.ts', 'export {};');
    f.write('site/plugin.mts', "const prefix = '@cssearth/nebula-lab/'; export const load = (name: string) => import(prefix + name);");
    assert.ok(f.check().some(error => error.includes('unchecked computed nebula')));
  } finally { f.cleanup(); }
});

test('Astro frontmatter and script imports obey the same inbound policy', () => {
  const f = fixture();
  try {
    for (const source of ["---\nimport '@cssearth/nebula-lab/public';\n---\n<div/>", "<div/><script>import '@cssearth/volume-bake/public';</script>"]) {
      f.write('site/page.astro', source); assert.ok(f.check().some(error => error.includes('runtime closure forbids')));
    }
  } finally { f.cleanup(); }
});

test('reachable vendor, prepared and generated wrappers cannot hide forbidden imports', () => {
  const f = fixture();
  try {
    for (const path of ['vendor/helper.ts', 'src/objects/sample/prepared/helper.mts', 'tools/dist/helper.js']) {
      f.write(path, "export * from '@cssearth/nebula-lab/public';");
      f.write('site/runtime.mts', `import '../${path}';`);
      assert.ok(f.check().some(error => error.includes('runtime closure forbids') && error.includes(`via ${path}`)), path);
      f.write(path, 'export {};');
    }
  } finally { f.cleanup(); }
});

test('production filesystem loads cannot read lab models or research implementation through static aliases', () => {
  const f = fixture();
  try {
    for (const source of [
      "import {readFile} from 'node:fs/promises'; readFile('labs/nebula/models/model.json');",
      "import {readFile as load} from 'node:fs/promises'; const location = 'labs/nebula/models/model.json'; load(location);",
      "const prefix = 'labs/nebula/'; const path = prefix + 'models/model.json'; fs.readFileSync(path);",
      "readFile(resolve('labs', 'nebula', 'models/model.json'));",
      "readFile(resolve(process.cwd(), 'labs/nebula/models/model.json'));",
      "readFile(new URL('../labs/nebula/models/model.json', import.meta.url));",
      "const location = new URL('../labs/nebula/packages/lab/src/main.ts', import.meta.url);",
    ]) {
      f.write('tools/prepare.mts', source); assert.ok(f.check().some(error => error.includes('filesystem access into labs/nebula')), source);
    }
    f.write('tools/prepare.mts', "const historical = { path: 'labs/nebula/models/immutable.json' }; const migrated = path.startsWith('labs/nebula/');");
    assert.deepEqual(f.check(), [], 'metadata comparisons do not load current lab data');
    f.write('src/evidence.test.ts', "readFile('labs/nebula/models/immutable.json');");
    assert.deepEqual(f.check(), [], 'historical test comparisons are allowed');
    f.write('site/runtime.mts', "import '../src/evidence.test.ts';");
    assert.ok(f.check().some(error => error.includes('filesystem access into labs/nebula')));
  } finally { f.cleanup(); }
});


test('package import aliases and redirected public exports cannot disguise a lab owner', () => {
  const f = fixture();
  try {
    f.write('package.json', JSON.stringify({ type: 'module', imports: { '#research': './labs/nebula/packages/lab/src/public.ts' } }));
    f.write('site/runtime.mts', "import '#research';");
    assert.ok(f.check().some(error => error.includes('direct path into labs/nebula')));
    f.write('site/runtime.mts', 'export {};');
    f.write('labs/nebula/packages/volume-core/package.json', JSON.stringify({ name: '@cssearth/volume-core', exports: { './public': '../lab/src/public.ts' } }));
    f.write('tools/prepare.mts', "import '@cssearth/volume-core/public';");
    assert.ok(f.check().some(error => error.includes('public export escapes')));
  } finally { f.cleanup(); }
});

test('source-looking directories are never read as modules and directory entry points remain checked', () => {
  const f = fixture();
  try {
    mkdirSync(resolve(f.root, '.astro'));
    mkdirSync(resolve(f.root, 'vendor/empty.ts'), { recursive: true });
    f.write('site/runtime.mts', "import '../vendor/empty.ts';");
    assert.deepEqual(f.check(), []);
    f.write('vendor/entry/index.ts', "export * from '@cssearth/nebula-lab/public';");
    f.write('site/runtime.mts', "import '../vendor/entry';");
    assert.ok(f.check().some(error => error.includes('runtime closure forbids') && error.includes('via vendor/entry/index.ts')));
  } finally { f.cleanup(); }
});
