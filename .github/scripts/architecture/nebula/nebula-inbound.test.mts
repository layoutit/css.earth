import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { checkNebulaInboundBoundaries } from './nebula-inbound.mts';

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'nebula-inbound-'));
  const write = (path: string, source: string) => { const file = resolve(root, path); mkdirSync(resolve(file, '..'), { recursive: true }); writeFileSync(file, source); };
  const owners = { 'packages/bake': '@cssearth/bake', 'labs/nebula/packages/lab': '@cssearth/nebula-lab', 'labs/nebula/packages/reconstruction': '@cssearth/nebula-reconstruction',
    'packages/volume-viewer': '@cssearth/volume-viewer' };
  write('package.json', JSON.stringify({ type: 'module', devDependencies: Object.fromEntries(Object.values(owners).map(name => [name, 'workspace:*'])) }));
  for (const [directory, name] of Object.entries(owners)) {
    write(`${directory}/package.json`, JSON.stringify({ name, exports: { './public': './src/public.ts' } }));
    write(`${directory}/src/public.ts`, 'export const value = 1; export type Contract = number;');
  }
  return { root, write, check: () => checkNebulaInboundBoundaries(root), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('normal runtime and preparation reject all public research imports, including erased types and reexports', () => {
  const f = fixture();
  try {
    for (const path of ['site/runtime.mts', 'src/runtime.ts', 'packages/engine/src/runtime.ts', 'packages/bake/cli/prepare-nebulae.mts']) {
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

test('preparation accepts the public bake entries while the runtime accepts none of them, not even an erased type', () => {
  const f = fixture();
  try {
    f.write('site/build/prepare.mts', "import {value} from '@cssearth/bake/public'; export {value as core} from '@cssearth/bake/public';");
    for (const path of ['site/build/volume.ts', 'packages/bake/src/volume/other.ts', 'packages/telescope-cli/src/query.mts']) {
      f.write(path, "import {value, type Contract} from '@cssearth/bake/public'; export {value};"); assert.deepEqual(f.check(), [], path);
      f.write(path, 'export {};');
    }
    assert.deepEqual(f.check(), []);
    // The runtime used to import volume-core for a type; that type belongs to the renderer now.
    for (const source of ["import type {Contract} from '@cssearth/bake/public';", "import {type Contract} from '@cssearth/bake/public';",
      "export type {Contract} from '@cssearth/bake/public';", "export {type Contract} from '@cssearth/bake/public';",
      "type T = import('@cssearth/bake/public').Contract;", "import '@cssearth/bake/public';", "import {value,type Contract} from '@cssearth/bake/public';",
      "export * from '@cssearth/bake/public';"]) {
      for (const path of ['site/runtime.mts', 'packages/renderer/src/volume/types.ts']) {
        f.write(path, source); assert.ok(f.check().some(error => error.includes('runtime closure forbids')), `${path}: ${source}`);
        f.write(path, 'export {};');
      }
    }
    f.write('site/build/prepare.mts', "import '@cssearth/bake/src/private';");
    assert.ok(f.check().some(error => error.includes('non-public nebula import')));
  } finally { f.cleanup(); }
});

test('viewer retains its declared volume contract after moving into packages', () => {
  const f = fixture();
  try {
    f.write('packages/volume-viewer/src/viewer.ts', "import {value} from '@cssearth/bake/public';");
    assert.ok(f.check().some(error => error.includes('runtime closure forbids')));
    f.write('packages/bake/package.json', JSON.stringify({ name: '@cssearth/bake', exports: { './volume': './src/public.ts' } }));
    f.write('packages/volume-viewer/src/viewer.ts', "import {value} from '@cssearth/bake/volume';");
    assert.deepEqual(f.check(), []);
  } finally { f.cleanup(); }
});

test('relative, absolute, URL, traversal and tsconfig aliases cannot enter the lab source tree', () => {
  const f = fixture();
  try {
    for (const source of [
      "export * from '../../labs/nebula/packages/volume-core/src/public.ts';",
      "import '../../src/../labs/nebula/packages/lab/src/private.ts';",
      "import('/labs/nebula/packages/reconstruction/src/public.ts');",
      `import('${resolve(f.root, 'labs/nebula/packages/lab/src/public.ts')}');`,
      `import('file://${resolve(f.root, 'labs/nebula/packages/lab/src/public.ts')}');`,
      "import(new URL('../../labs/nebula/packages/lab/src/public.ts', import.meta.url).href);",
    ]) {
      f.write('site/build/prepare.mts', source); assert.ok(f.check().some(error => error.includes('direct path into labs/nebula')), source);
    }
    f.write('tsconfig.base.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@research/*': ['labs/nebula/packages/lab/src/*'], '@cssearth/bake/*': ['labs/nebula/packages/lab/src/*'] } } }));
    f.write('tsconfig.json', JSON.stringify({ extends: './tsconfig.base.json' }));
    for (const path of ['public', 'not-yet-created']) {
      f.write('site/build/prepare.mts', `import '@research/${path}';`); assert.ok(f.check().some(error => error.includes('direct path into labs/nebula')));
    }
    f.write('site/build/prepare.mts', "import '@cssearth/bake/public';");
    assert.ok(f.check().some(error => error.includes('package alias escapes')));
  } finally { f.cleanup(); }
});

test('relative, absolute and URL paths cannot enter the bake sources past the public entries', () => {
  const f = fixture();
  try {
    for (const source of [
      "export * from '../../packages/bake/src/public.ts';",
      "import '../../src/../packages/bake/src/volume/not-yet-created.ts';",
      `import('${resolve(f.root, 'packages/bake/src/public.ts')}');`,
      "import(new URL('../../packages/bake/src/public.ts', import.meta.url).href);",
    ]) {
      f.write('site/build/prepare.mts', source); assert.ok(f.check().some(error => error.includes('direct path into packages/bake')), source);
    }
    f.write('site/build/prepare.mts', 'export {};');
    f.write('packages/bake/src/volume/field.ts', "export * from '../public.ts';");
    assert.deepEqual(f.check(), [], 'the package reaches its own sources');
  } finally { f.cleanup(); }
});

test('site/build is site-owned preparation: it imports the public bake entries, and the runtime cannot reach the bake through it', () => {
  const f = fixture();
  try {
    f.write('site/build/prepare/p.mts', "import {value} from '@cssearth/bake/public'; export {value};");
    assert.deepEqual(f.check(), []);
    f.write('site/runtime.mts', "import '../site/build/prepare/p.mts';");
    assert.ok(f.check().some(error => error.includes('runtime closure forbids') && error.includes('via site/build/prepare/p.mts')));
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
    f.write('site/build/prepare.mts', "export * from '@cssearth/bake/public';");
    f.write('site/runtime.mts', "import './build/prepare.mts';");
    assert.ok(f.check().some(error => error.includes('runtime closure forbids') && error.includes('via site/build/prepare.mts')));
    f.write('site/runtime.mts', 'export {};');
    f.write('site/build/prepare.mts', 'export {};');
    f.write('integration/prepared-object-mount/fixtures/helper.mts', "import '@cssearth/bake/public'; export const helper = 1;");
    f.write('site/journeys/helper.test.mts', "import '../../integration/prepared-object-mount/fixtures/helper.mts';");
    assert.deepEqual(f.check(), [], 'the moved integration harness is test code');
    f.write('site/runtime.mts', "import '../integration/prepared-object-mount/fixtures/helper.mts';");
    assert.ok(f.check().some(error => error.includes('runtime closure forbids') && error.includes('via integration/prepared-object-mount/fixtures/helper.mts')));
    f.write('site/runtime.mts', 'export {};');
    f.write('src/check.test.ts', "import '../labs/nebula/packages/lab/src/public.ts';");
    assert.ok(f.check().some(error => error.includes('direct path into labs/nebula')), 'tests must use public exports too');
  } finally { f.cleanup(); }
});

test('root research dependencies remain development-only and computed policy stays scoped', () => {
  const f = fixture();
  try {
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      f.write('package.json', JSON.stringify({ [field]: { '@cssearth/bake': 'workspace:*', '@cssearth/nebula-lab': 'workspace:*', '@cssearth/nebula-reconstruction': 'workspace:*', '@cssearth/volume-viewer': 'workspace:*' } }));
      assert.equal(f.check().filter(error => error.includes('must remain a devDependency')).length, 4);
    }
    f.write('package.json', JSON.stringify({ devDependencies: { '@cssearth/bake': 'workspace:*' } }));
    f.write('site/plugin.mts', 'export const load = (plugin: string) => import(plugin);');
    assert.deepEqual(f.check(), []);
    f.write('packages/bake/cli/prepare-nebulae.mts', 'export const load = (plugin: string) => import(plugin);');
    assert.ok(f.check().some(error => error.includes('unchecked computed nebula')), 'the application nebula entry is the compact adapter');
    f.write('packages/bake/cli/prepare-nebulae.mts', 'export {};');
    f.write('site/plugin.mts', "const prefix = '@cssearth/nebula-lab/'; export const load = (name: string) => import(prefix + name);");
    assert.ok(f.check().some(error => error.includes('unchecked computed nebula')));
    f.write('site/plugin.mts', "const prefix = '@cssearth/bake/'; export const load = (name: string) => import(prefix + name);");
    assert.ok(f.check().some(error => error.includes('unchecked computed nebula')));
    // Preparation code imports the bake by design: its computed loads are not suspect for naming it, but a runtime module
    // that reaches such a file still is.
    f.write('site/plugin.mts', 'export {};');
    f.write('site/build/plugin.mts', "import '@cssearth/bake/public'; export const load = (name: string) => import(name);");
    assert.deepEqual(f.check(), []);
    f.write('site/plugin.mts', "import { load } from './build/plugin.mts'; export { load };");
    assert.ok(f.check().some(error => error.includes('site/plugin.mts: unchecked computed nebula module loading via site/build/plugin.mts')));
    f.write('site/build/plugin.mts', "import '@cssearth/bake/public'; export const load = (name: string) => import('@cssearth/nebula-lab/' + name);");
    f.write('site/plugin.mts', 'export {};');
    assert.ok(f.check().some(error => error.includes('site/build/plugin.mts: unchecked computed nebula module loading')));
    // An owner-local test helper may import the bake; a runtime module that reaches it may not.
    f.write('site/build/plugin.mts', 'export {};');
    f.write('site/world/fixtures/helper.mts', "import '@cssearth/bake/public'; export const helper = 1;");
    f.write('site/build/plugin.test.mts', "import { helper } from '../world/fixtures/helper.mts'; export { helper };");
    assert.deepEqual(f.check(), []);
    f.write('site/plugin.mts', "import { helper } from './world/fixtures/helper.mts'; export { helper };");
    assert.ok(f.check().some(error => error.includes('site/plugin.mts: runtime closure forbids @cssearth/bake/public via site/world/fixtures/helper.mts')));
    f.write('site/plugin.mts', 'export {};');
  } finally { f.cleanup(); }
});

test('Astro frontmatter and script imports obey the same inbound policy', () => {
  const f = fixture();
  try {
    for (const source of ["---\nimport '@cssearth/nebula-lab/public';\n---\n<div/>", "<div/><script>import '@cssearth/bake/public';</script>"]) {
      f.write('site/page.astro', source); assert.ok(f.check().some(error => error.includes('runtime closure forbids')));
    }
  } finally { f.cleanup(); }
});

test('reachable vendor, prepared and generated wrappers cannot hide forbidden imports', () => {
  const f = fixture();
  try {
    for (const path of ['vendor/helper.ts', 'src/objects/sample/prepared/helper.mts', 'packages/sample/dist/helper.js']) {
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
      "readFile(new URL('../../labs/nebula/models/model.json', import.meta.url));",
      "const location = new URL('../../labs/nebula/packages/lab/src/main.ts', import.meta.url);",
    ]) {
      f.write('site/build/prepare.mts', source); assert.ok(f.check().some(error => error.includes('filesystem access into labs/nebula')), source);
    }
    f.write('site/build/prepare.mts', "const historical = { path: 'labs/nebula/models/immutable.json' }; const migrated = path.startsWith('labs/nebula/');");
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
    f.write('packages/bake/package.json', JSON.stringify({ name: '@cssearth/bake', exports: { './public': '../../labs/nebula/packages/lab/src/public.ts' } }));
    f.write('site/build/prepare.mts', "import '@cssearth/bake/public';");
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

test('the telescope command is preparation; a runtime package stays refused', () => {
  const f = fixture();
  try {
    const computed = "const at = String(Math.random()); await import(at + 'packages/bake');";
    f.write('packages/telescope-cli/src/implementation.mts', `import {value} from '@cssearth/bake/public'; ${computed} export {value};`);
    assert.deepEqual(f.check(), [], 'the command imports the bake and loads bake modules it computes');
    f.write('packages/telescope-cli/src/implementation.mts', "import '@cssearth/nebula-lab/public';");
    assert.ok(f.check().some(error => error.includes('closure forbids')), 'the command still may not reach the lab');
    f.write('packages/telescope-cli/src/implementation.mts', 'export {};');
    for (const source of ["import {value} from '@cssearth/bake/public'; export {value};", computed]) {
      f.write('packages/renderer/src/volume/loader.ts', source);
      assert.ok(f.check().some(error => error.includes('runtime closure forbids') || error.includes('unchecked computed')), source);
    }
  } finally { f.cleanup(); }
});

test('relocated owner fixtures stay test-only while runtime imports check their closure', () => {
  const f = fixture();
  try {
    for (const path of ['site/world/fixtures/helper.mts', 'src/platform/fixtures/helper.mts', 'src/objects/earth/fixtures/helper.mts']) {
      f.write(path, "import '@cssearth/bake/public'; export const helper = 1;");
      assert.deepEqual(f.check(), [], path);
      f.write('site/plugin.mts', `import { helper } from '../${path}'; export { helper };`);
      assert.ok(f.check().some(error => error.includes(`runtime closure forbids @cssearth/bake/public via ${path}`)), path);
      f.write('site/plugin.mts', 'export {};');
      f.write(path, 'export {};');
    }
  } finally { f.cleanup(); }
});

test('tests reach package-owned bake fixtures without a public export; runtime and other sources stay forbidden', () => {
  const f = fixture();
  try {
    f.write('packages/bake/src/contract/fixtures/helper.mts', "import '@cssearth/bake/public'; export const helper = 1;");
    f.write('site/journeys/example.test.mts', "import '../../packages/bake/src/contract/fixtures/helper.mts';");
    assert.deepEqual(f.check(), []);
    f.write('site/runtime.mts', "import '../packages/bake/src/contract/fixtures/helper.mts';");
    assert.ok(f.check().some(error => error.includes('direct path into packages/bake')));
    f.write('site/runtime.mts', 'export {};');
    f.write('site/journeys/example.test.mts', "import '../../packages/bake/src/public.ts';");
    assert.ok(f.check().some(error => error.includes('direct path into packages/bake')));
  } finally { f.cleanup(); }
});
