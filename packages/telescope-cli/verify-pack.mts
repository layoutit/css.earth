/** Maintainer integration gate: builds/packs and installs a real consumer; never part of the unit lane. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';
import { fileSize, writeProductRecord } from '@cssearth/telescope-core/node';
import { encodeFits } from '@cssearth/fits/node';
import { assertPackedClosure, assertPackedExports } from './src/pack-structure.mts';

const root = resolve(import.meta.dirname, '../..');
async function packRoot(directory: string): Promise<string> {
  const packageRoot = resolve(root, 'packages/telescope-cli');
  const data = resolve(packageRoot, 'data'), previous = resolve(directory, 'previous-data');
  let hadData = false;
  try { await rename(data, previous); hadData = true; }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  const watched = ['dist/viewer-lane.js', 'data/target-catalogue.json'].map(file => resolve(packageRoot, file));
  // Start without data to prove plain npm pack invokes its owner. Once published, a file must stay complete.
  const published = new Set<string>();
  for (const file of watched) {
    try { assert.ok((await readFile(file)).length > 0); published.add(file); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  }
  const child = spawn('npm', ['pack', '--offline', '--json', '--cache', resolve(directory, 'cache'), '--pack-destination', directory], { cwd: packageRoot });
  let stdout = '', stderr = '', pending = Promise.resolve();
  const failures: string[] = [];
  child.stdout.on('data', data => { stdout += String(data); });
  child.stderr.on('data', data => { stderr += String(data); });
  const interval = setInterval(() => {
    pending = pending.then(async () => {
      try {
        for (const file of watched) {
          try {
            const contents = await readFile(file, 'utf8');
            assert.ok(contents.length > 0); if (file.endsWith('.json')) JSON.parse(contents);
            published.add(file);
          } catch (error) {
            if (!published.has(file) && error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
            throw error;
          }
        }
      } catch (error) { failures.push(String(error)); }
    });
  }, 10);
  const timeout = setTimeout(() => child.kill('SIGTERM'), 180_000);
  try {
    const status = await new Promise<number | null>((accept, reject) => { child.once('error', reject); child.once('exit', accept); });
    assert.equal(status, 0, stderr);
  } finally {
    clearInterval(interval); clearTimeout(timeout); await pending;
    if (hadData && !published.has(watched[1]!)) { await rm(data, { recursive: true, force: true }); await rename(previous, data); }
  }
  assert.deepEqual(failures, [], 'prepack must retain complete bundles and data for source consumers');
  return stdout;
}
async function verifyPack(): Promise<void> {
  const directory=await mkdtemp(resolve(tmpdir(),'telescope-packed-'));
  try{
    const stdout = await packRoot(directory);
    // Lifecycle build output precedes npm's final JSON array.
    const record=requireRecord(JSON.parse(stdout.slice(stdout.lastIndexOf('\n[') + 1))[0]);
    assert.ok(typeof record.size==='number'&&record.size<15_000_000,`Packed size ${record.size} exceeds 15 MB`);
    const files=Array.isArray(record.files)?record.files.map(value=>'package/'+String(requireRecord(value).path)):[];
    assert.ok(files.length>0,'npm pack must report its file list');assertPackedClosure(files);
    for (const input of ['data/spheres/sphere-bank.json.gz', 'data/target-catalogue.json']) assert.ok(files.includes(`package/${input}`), input);
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
    const help = spawnSync(process.execPath, [resolve(consumer, 'node_modules/.bin/telescope'), '--help'],
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
      const exported = spawnSync(process.execPath, [resolve(consumer, 'node_modules/.bin/telescope'),
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
}

await verifyPack();
console.log('PASS: packed consumer imports, declarations, help and FITS image/HTML exports.');
