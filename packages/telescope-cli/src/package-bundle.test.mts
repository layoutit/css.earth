import './test-user-root.mts';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isBuiltin } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { requireRecord } from '@cssearth/core';
import { requireWorkspace } from '@cssearth/telescope-core/node';
import { packageBundlePlugins } from './package-bundle.mts';
import { assertPackedClosure, assertPackedExports } from './pack-structure.mts';
import { copyPackageData, validatePublishPackage } from './package-data.mts';

const root = requireWorkspace();
test('published dependencies cover runtime external imports and the public Node declarations', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'telescope-dependencies-'));
  try {
    const packageRoot = resolve(root, 'packages/telescope-cli');
    await mkdir(resolve(directory, 'data'));
    await copyFile(resolve(packageRoot, 'package.json'), resolve(directory, 'package.json'));
    await copyFile(resolve(packageRoot, 'README.md'), resolve(directory, 'README.md'));
    for (const name of ['skills', '.claude-plugin', '.codex-plugin', '.factory-plugin'])
      await cp(resolve(packageRoot, name), resolve(directory, name), { recursive: true });
    const externalPackages = new Set<string>();
    for (const format of ['esm', 'cjs'] as const) {
      const result = await build({
        entryPoints: format === 'esm' ? {
          telescope: resolve(packageRoot, 'src/bin.mts'), cli: resolve(packageRoot, 'src/cli.mts'),
          'sphere-lane': resolve(packageRoot, 'src/sphere/sphere-lane.mts'), 'viewer-lane': resolve(packageRoot, 'src/delivery/viewer-lane.mts'),
        } : { 'sphere-lane': resolve(packageRoot, 'src/sphere/sphere-lane.mts'), 'viewer-lane': resolve(packageRoot, 'src/delivery/viewer-lane.mts') },
        outdir: resolve(directory, 'dist'), outExtension: { '.js': format === 'esm' ? '.mjs' : '.cjs' },
        bundle: true, platform: 'node', target: 'node22', format, packages: 'external', metafile: true,
        plugins: packageBundlePlugins(root), logLevel: 'silent',
      });
      assert.ok(result.metafile, 'packaging build must return its runtime import graph');
      // Output imports describe emitted runtime edges; input imports include code removed by tree shaking.
      for (const output of Object.values(result.metafile.outputs)) for (const imported of output.imports) {
        if (!imported.external || isBuiltin(imported.path) || imported.path.startsWith('.')) continue;
        externalPackages.add(imported.path.split('/').slice(0, imported.path.startsWith('@') ? 2 : 1).join('/'));
      }
    }
    await validatePublishPackage(root, directory);
    const manifest = requireRecord(JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8')));
    const dependencies = requireRecord(manifest.dependencies);
    assert.deepEqual(Object.keys(dependencies).sort(), [...externalPackages].sort(),
      'every runtime dependency must have a runtime external import');
    assert.equal(requireRecord(manifest.peerDependencies)['@types/node'], '^26.4.0');
    assert.equal(requireRecord(requireRecord(manifest.peerDependenciesMeta)['@types/node']).optional, true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('bundled data owners resolve outside the checkout and preserve pin bytes', async () => {
  const directory = await realpath(await mkdtemp(resolve(tmpdir(), 'telescope-package-')));
  try {
    await mkdir(resolve(directory, 'dist'));
    await writeFile(resolve(directory, 'package.json'), JSON.stringify({ name: '@cssearth/telescope', type: 'module', exports: { './package.json': './package.json' } }));
    await build({ entryPoints: { core: resolve(root, 'packages/telescope-core/src/node/paths.ts'), paths: resolve(root, 'packages/telescope-cli/src/paths.mts') },
      outdir: resolve(directory, 'dist'), outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: packageBundlePlugins(root) });
    await mkdir(resolve(directory, 'data/telescope-core'), { recursive: true });
    await writeFile(resolve(directory, 'data/telescope-core/package.json'), '{}');
    const pins = resolve(root, 'packages/telescope-core/toolchains'), installed = resolve(directory, 'data/telescope-core/toolchains');
    await copyPackageData(pins, installed);
    for (const name of await readdir(pins)) assert.deepEqual(await readFile(resolve(installed, name)), await readFile(resolve(pins, name)), name);
    await mkdir(resolve(directory, 'data/cli/src/archives/sample/programs'), { recursive: true });
    await copyFile(resolve(root, 'packages/telescope-cli/src/modes.json'), resolve(directory, 'data/cli/src/modes.json'));
    const env: NodeJS.ProcessEnv = { ...process.env, CSSEARTH_TELESCOPE_HOME: resolve(directory, 'user') };
    delete env.CSSEARTH_WORKSPACE;
    const script = `
      import assert from 'node:assert/strict';
      const core = await import('./dist/core.mjs'), paths = await import('./dist/paths.mjs');
      assert.equal(core.WORKSPACE, undefined);
      assert.equal(core.TOOLCHAINS, ${JSON.stringify(installed)});
      assert.equal(paths.packagePath('src/modes.json'), ${JSON.stringify(resolve(directory, 'data/cli/src/modes.json'))});
      const identity = 'src/archives/sample/programs/program.json', expected = ${JSON.stringify(resolve(directory, 'data/cli/src/archives/sample/programs/program.json'))};
      assert.equal(paths.programStorePath(identity), expected);
      assert.equal(paths.programStorePath(expected), expected);
      assert.throws(() => paths.programStorePath(identity, 'write'), /needs a css.earth checkout/);
      console.log('PACKAGED_ROOTS_OK');
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: directory, env, encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /PACKAGED_ROOTS_OK/u);
    const workspaceScript = `
      import assert from 'node:assert/strict';
      const core = await import('./dist/core.mjs'), paths = await import('./dist/paths.mjs');
      assert.equal(core.WORKSPACE, ${JSON.stringify(root)});
      assert.equal(paths.programStorePath('src/archives/sample/programs/program.json'), ${JSON.stringify(resolve(root, 'packages/telescope-cli/src/archives/sample/programs/program.json'))});
      console.log('PACKAGED_WORKSPACE_OK');
    `;
    const workspace = spawnSync(process.execPath, ['--input-type=module', '-e', workspaceScript], { cwd: directory, env: { ...env, CSSEARTH_WORKSPACE: root }, encoding: 'utf8', timeout: 30_000 });
    assert.equal(workspace.status, 0, workspace.stderr); assert.match(workspace.stdout, /PACKAGED_WORKSPACE_OK/u);

  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('runtime data copying excludes implementation, tests, fixtures and authoring', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'telescope-data-'));
  try {
    const source = resolve(directory, 'source'), destination = resolve(directory, 'data');
    await mkdir(resolve(source, 'fixtures'), { recursive: true }); await mkdir(resolve(source, 'authoring'));await mkdir(resolve(source,'examples/evidence'),{recursive:true});await mkdir(resolve(source,'new-object'));
    for (const name of ['toolchain.json', 'requirements.lock', 'tools.py', 'test_tools.py', 'code.mts', 'code.test.mts', 'code.js.map', 'fixtures/input.json', 'authoring/pin.json','examples/evidence/proof.png','new-object/workspace.json'])
      await writeFile(resolve(source, name), name);
    await copyPackageData(source, destination);
    assert.deepEqual((await readdir(destination)).sort(), ['requirements.lock', 'toolchain.json', 'tools.py']);
    assert.equal(await readFile(resolve(destination, 'requirements.lock'), 'utf8'), 'requirements.lock');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('CommonJS bundles read the executable from the ESM dependency namespace', async () => {
  await mkdir(resolve(root, 'output'), { recursive: true });
  const directory = await mkdtemp(resolve(root, 'output/telescope-cjs-')), file = resolve(directory, 'webp.cjs');
  try {
    await build({ entryPoints: [resolve(root, 'packages/bake/src/delivery/prepared-webp.ts')], outfile: file,
      bundle: true, platform: 'node', format: 'cjs', packages: 'external', plugins: packageBundlePlugins(root) });
    const input = resolve(directory, 'input.webp');
    await writeFile(input, 'only stat is needed before executable dispatch');
    const result = spawnSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict'), childProcess = require('node:child_process');
      const sentinel = new Error('intercepted encoder dispatch');
      let executable, arguments;
      childProcess.execFile = (file, args, callback) => {
        executable = file; arguments = args; callback(sentinel);
      };
      const owner = require(${JSON.stringify(file)});
      (async () => {
        const namespace = await import('cwebp-bin');
        assert.equal(typeof namespace.default, 'string');
        assert.match(namespace.default, /[\\/]vendor[\\/]cwebp(?:\\.exe)?$/);
        await assert.rejects(owner.optimizePreparedQ75Webp(${JSON.stringify(input)}), error => error === sentinel);
        assert.equal(executable, namespace.default);
        assert.deepEqual(arguments.slice(0, 9), ['-quiet', '-q', '75', '-m', '6', '-alpha_q', '100', ${JSON.stringify(input)}, '-o']);
        assert.match(arguments[9], /\\.candidate\\.webp$/);
        console.log('CJS_ESM_DEPENDENCY_OK');
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /CJS_ESM_DEPENDENCY_OK/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('packed closure and public exports reject undeclared or missing files without installing a consumer', async () => {
  const manifest = requireRecord(JSON.parse(await readFile(resolve(root, 'packages/telescope-cli/package.json'), 'utf8')));
  const files = [
    'package/package.json', 'package/README.md', 'package/LICENSE', 'package/run-typed-module.mjs',
    'package/dist/cli.mjs', 'package/dist/telescope.mjs',
    ...['sphere', 'viewer'].flatMap(lane => ['js', 'cjs', 'd.ts'].map(extension => `package/dist/${lane}-lane.${extension}`)),
    'package/skills/telescope/SKILL.md', ...['claude', 'codex', 'factory'].map(host => `package/.${host}-plugin/plugin.json`),
    'package/data/spheres/sphere-bank.json.gz', 'package/data/target-catalogue.json',
    'package/data/cli/src/archives/example/programs/observations.json',
  ];
  assertPackedClosure(files);
  assertPackedExports(manifest, files);
  for (const missing of ['package/dist/viewer-lane.d.ts', 'package/dist/sphere-lane.cjs', 'package/run-typed-module.mjs'])
    assert.throws(() => assertPackedExports(manifest, files.filter(file => file !== missing)), /Missing packed export/u);
  assert.throws(() => assertPackedExports({ ...manifest, exports: { './broken': './src/absent.mts' } }, files));
  for (const forbidden of ['package/pnpm-lock.yaml', 'package/data/spheres/src/objects/body/prepared/runtime.json.gz',
    'package/data/cli/src/examples/sample/evidence/image.png', 'package/data/bake/src/unused.json',
    'package/src/objects/body/source/measurements.json', 'package/data/cli/src/archives/example/evidence/proof.png',
    'package/data/cli/src/archives/example/fixtures/input.json', 'package/data/cli/src/archives/example/source.test.mts',
    'package/data/cli/src/archives/example/yarn.lock', 'package/dist/extra/unknown.mjs', 'package/unknown.json'])
    assert.throws(() => assertPackedClosure([...files, forbidden]), `Packaging guard must reject ${forbidden}`);
});
