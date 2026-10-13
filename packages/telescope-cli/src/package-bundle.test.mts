import './test-user-root.mts';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isBuiltin, createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { requireRecord } from '@cssearth/core';
import { fileSize, requireWorkspace, writeProductRecord } from '@cssearth/telescope-core/node';
import { encodeFits } from '@cssearth/fits/node';
import { packageBundlePlugins } from './package-bundle.mts';
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
    const result = spawnSync(process.execPath, ['-e', `
      const owner = require(${JSON.stringify(file)}), sharp = require('sharp');
      (async () => {
        await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 180, g: 110, b: 45, alpha: 1 } } }).webp({ lossless: true }).toFile(${JSON.stringify(input)});
        await owner.optimizePreparedQ75Webp(${JSON.stringify(input)});
        const metadata = await sharp(${JSON.stringify(input)}).metadata();
        if (metadata.format !== 'webp' || metadata.width !== 64 || metadata.height !== 64) throw new Error('encoding failed');
        console.log('CJS_ESM_DEPENDENCY_OK');
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /CJS_ESM_DEPENDENCY_OK/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

function assertPackedClosure(files: readonly string[]) {
  for(const path of files) {
    // Forbidden contents are rejected everywhere, including otherwise allowed archive descendants.
    assert.doesNotMatch(path, /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?|composer\.lock|Cargo\.lock|Pipfile\.lock|poetry\.lock|uv\.lock|evidence|tests?|__tests__|fixtures?)(?:\/|$)|(?:^|\/)src\/objects(?:\/|$)|(?:^|\/)(?:test_[^/]*|[^/]*\.(?:test|spec)\.[^/]+)$/u, path);
    assert.match(path, /^package\/(?:package\.json|README\.md|LICENSE|skills\/telescope\/SKILL\.md|\.(?:claude|codex|factory)-plugin\/plugin\.json|dist\/(?:(?:cli|telescope)\.mjs|(?:sphere|viewer)-lane\.(?:js|cjs|d\.ts|d\.cts))|data\/.+)$/u, path);
    if(!path.startsWith('package/data/'))continue;
    // Generated viewer inputs have explicit readers; archive programs/ledgers/toolchains are selected dynamically.
    assert.match(path,/^package\/data\/(?:spheres\/sphere-bank\.json\.gz|renderer\/volume\.css|target-catalogue\.json|telescope-core\/package\.json|telescope-core\/toolchains\/.+|cli\/src\/(?:archives\/.+|examples\.json|modes\.json)|src\/sources\/(?:wwt\/(?:core-imagesets\.jsonl|fits-associations\.json|phat-fits\.json|WWT-CORE-CATALOGS-LICENSE\.txt)|[^/]+\/(?:ledger\.json|discovery\.json|target-associations\.json)))$/u,path);
  }
}
function assertPackedExports(manifest: Readonly<Record<string, unknown>>, files: readonly string[]): void {
  const visit = (value: unknown): void => {
    if (typeof value === 'string') { assert.ok(files.includes('package/' + value.replace(/^\.\//u, '')), `Missing packed export: ${value}`); return; }
    for (const child of Object.values(requireRecord(value))) visit(child);
  };
  visit(manifest.exports);
  for (const value of Object.values(requireRecord(manifest.bin))) visit(value);
}
async function packRoot(directory: string): Promise<string> {
  const packageRoot = resolve(root, 'packages/telescope-cli');
  const watched = ['dist/viewer-lane.js', 'data/target-catalogue.json'].map(file => resolve(packageRoot, file));
  // Other source tests consume the last completed build while npm runs prepack.
  for (const file of watched) assert.ok((await readFile(file)).length > 0);
  const child = spawn('npm', ['pack', '--offline', '--json', '--cache', resolve(directory, 'cache'), '--pack-destination', directory], { cwd: packageRoot });
  let stdout = '', stderr = '', pending = Promise.resolve();
  const failures: string[] = [];
  child.stdout.on('data', data => { stdout += String(data); });
  child.stderr.on('data', data => { stderr += String(data); });
  const interval = setInterval(() => {
    pending = pending.then(async () => {
      try {
        const contents = await Promise.all(watched.map(file => readFile(file, 'utf8')));
        assert.ok(contents[0]!.length > 0); JSON.parse(contents[1]!);
      } catch (error) { failures.push(String(error)); }
    });
  }, 10);
  const timeout = setTimeout(() => child.kill('SIGTERM'), 180_000);
  try {
    const status = await new Promise<number | null>((accept, reject) => { child.once('error', reject); child.once('exit', accept); });
    assert.equal(status, 0, stderr);
  } finally { clearInterval(interval); clearTimeout(timeout); await pending; }
  assert.deepEqual(failures, [], 'prepack must retain complete bundles and data for source consumers');
  return stdout;
}
test('actual tarball stays within the standalone budget and contains only runtime data owners',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'telescope-packed-'));
  try{
    const stdout = await packRoot(directory);
    // Lifecycle build output precedes npm's final JSON array.
    const record=requireRecord(JSON.parse(stdout.slice(stdout.lastIndexOf('\n[') + 1))[0]);
    assert.ok(typeof record.size==='number'&&record.size<15_000_000,`Packed size ${record.size} exceeds 15 MB`);
    const files=Array.isArray(record.files)?record.files.map(value=>'package/'+String(requireRecord(value).path)):[];
    assert.ok(files.length>0,'npm pack must report its file list');assertPackedClosure(files);
    assert.equal(typeof record.filename, 'string');
    const tarball = resolve(directory, String(record.filename)), unpacked = resolve(directory, 'unpacked');
    await mkdir(unpacked);
    const extraction = spawnSync('tar', ['-xzf', tarball, '-C', unpacked], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(extraction.status, 0, extraction.stderr);
    const manifest = requireRecord(JSON.parse(await readFile(resolve(unpacked, 'package/package.json'), 'utf8')));
    assertPackedExports(manifest, files);
    assert.throws(() => assertPackedExports({ ...manifest, exports: { './broken': './src/absent.mts' } }, files));
    const consumer = resolve(directory, 'consumer'); await mkdir(consumer);
    await writeFile(resolve(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    // Package the compiler's installed Node type dependencies as local tarballs, so this gate also runs offline.
    const typeRequire = createRequire(resolve(root, 'packages/telescope-cli/package.json'));
    const nodeTypes = typeRequire.resolve('@types/node/package.json');
    const typeTarballs: string[] = [];
    for (const manifestPath of [nodeTypes, createRequire(nodeTypes).resolve('undici-types/package.json')]) {
      const packedTypes = spawnSync('npm', ['pack', '--ignore-scripts', '--offline', '--json', '--cache', resolve(directory, 'cache'), '--pack-destination', directory],
        { cwd: dirname(manifestPath), encoding: 'utf8', timeout: 30_000 });
      assert.equal(packedTypes.status, 0, packedTypes.stderr);
      typeTarballs.push(resolve(directory, String(requireRecord(JSON.parse(packedTypes.stdout)[0]).filename)));
    }
    const install = spawnSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', process.env.npm_config_cache ?? resolve(directory, 'install-cache'), tarball, ...typeTarballs],
      { cwd: consumer, encoding: 'utf8', timeout: 120_000 });
    assert.equal(install.status, 0, install.stderr);
    await writeFile(resolve(consumer, 'consumer.ts'), `
      import * as sphere from '@cssearth/telescope/sphere/lane';
      import * as viewer from '@cssearth/telescope/viewer/lane';
      import { loadPreparedCssVolume, loadPreparedCssPointField } from '@cssearth/telescope/viewer/lane';
      const volume: typeof loadPreparedCssVolume = viewer.loadPreparedCssVolume;
      const points: typeof loadPreparedCssPointField = viewer.loadPreparedCssPointField;
      void [volume, points, sphere];
    `);
    const compile = () => spawnSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', 'consumer.ts'],
      { cwd: consumer, encoding: 'utf8', timeout: 30_000 });
    let compiled = compile(); assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
    const declarations = resolve(consumer, 'node_modules/@cssearth/telescope/dist/viewer-lane.d.ts');
    const original = await readFile(declarations, 'utf8');
    await writeFile(declarations, original + "\nexport { loadPreparedCssVolume as broken } from '@cssearth/renderer/volume/loader.ts';\n");
    compiled = compile(); assert.notEqual(compiled.status, 0); assert.match(compiled.stdout, /TS2307/u);
    await writeFile(declarations, original);
    // The declarations need Node types; launching the JavaScript CLI does not.
    await rm(resolve(consumer, 'node_modules/@types/node'), { recursive: true, force: true });
    await rm(resolve(consumer, 'node_modules/undici-types'), { recursive: true, force: true });
    const help = spawnSync(process.execPath, [resolve(consumer, 'node_modules/@cssearth/telescope/dist/telescope.mjs'), '--help'],
      { cwd: consumer, encoding: 'utf8', timeout: 30_000 });
    assert.equal(help.status, 0, help.stderr); assert.match(help.stdout, /telescope explore/u);
    const image = resolve(consumer, 'adu.fits'), inputRecord = resolve(consumer, 'input.product.json'), delivery = resolve(consumer, 'result.json');
    await writeFile(image, encodeFits(new Float32Array([1, 2, 3, 4]), 2, 2, { BUNIT: 'ADU' }));
    await writeProductRecord(inputRecord, { telescope: 'Fixture', stage: 'fixture', inputs: [], parameters: {}, software: [] }, [{ path: 'adu.fits', file: image }]);
    await writeFile(delivery, JSON.stringify({ schema: 'cssearth-telescope-delivery@3', product: 'adu.fits', record: 'input.product.json', receipt: 'input.product.json', facts: { target: 'fixture', verified: true }, context: { kind: 'exploration', target: 'fixture', discovery: { schema: 'cssearth-telescope-exploration@1', observation: 'ADU image' }, assessment: { status: 'not-requested' } }, files: [{ path: 'adu.fits', ...await fileSize(image) }, { path: 'input.product.json', ...await fileSize(inputRecord) }] }));
    const env: NodeJS.ProcessEnv = { ...process.env, CSSEARTH_TELESCOPE_HOME: resolve(consumer, 'user') };
    delete env.CSSEARTH_WORKSPACE;
    for (const kind of ['image', 'html']) {
      const directory = resolve(consumer, kind);
      const exported = spawnSync(process.execPath, [resolve(consumer, 'node_modules/@cssearth/telescope/dist/telescope.mjs'),
        'export', delivery, '--output', kind, ...(kind === 'image' ? ['--hdu', '0'] : []), '--out', directory, '--json'],
        { cwd: consumer, env, encoding: 'utf8', timeout: 30_000 });
      assert.equal(exported.status, 0, exported.stdout + exported.stderr);
      assert.ok((await readFile(resolve(directory, 'figure.png'))).length > 1000);
      const evidence = requireRecord(JSON.parse(await readFile(resolve(directory, 'output.product.json'), 'utf8')));
      assert.equal(requireRecord(requireRecord(requireRecord(evidence.parameters).metadata).units).value, 'ADU');
      if (kind === 'html') assert.match(await readFile(resolve(directory, 'viewer.html'), 'utf8'), /data:image\/png;base64,/u);
    }
    for(const forbidden of ['package/pnpm-lock.yaml','package/data/spheres/src/objects/body/prepared/runtime.json.gz','package/data/cli/src/examples/sample/evidence/image.png','package/data/bake/src/unused.json','package/src/objects/body/source/measurements.json','package/data/cli/src/archives/example/evidence/proof.png','package/data/cli/src/archives/example/fixtures/input.json','package/data/cli/src/archives/example/source.test.mts','package/data/cli/src/archives/example/yarn.lock','package/dist/extra/unknown.mjs','package/unknown.json'])
      assert.throws(()=>assertPackedClosure([...files,forbidden]),`Packaging guard must reject ${forbidden}`);
  }finally{await rm(directory,{recursive:true,force:true});}
});
