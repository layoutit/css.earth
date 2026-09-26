/** Run the actual delivery CLI with only application owners and relocated numerical packages. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, cp, symlink, access } from 'node:fs/promises';
import { resolve, relative, dirname, join } from 'node:path';
import { sha256 } from '@cssearth/core/node';
import { spawn, spawnSync } from 'node:child_process';
const root = process.cwd(), require = createRequire(resolve(root, 'package.json'));
const engine = createRequire(resolve(root, 'packages/engine/package.json'));
const { build } = createRequire(engine.resolve('tsup'))('esbuild') as typeof import('esbuild');
const output = resolve(root, 'output/nebula-application-isolation'); await mkdir(output, { recursive: true });
const sandbox = await mkdtemp(join(output, 'run-'));
const names = ['bake'];
await writeFile(join(sandbox, 'package.json'), '{"type":"module"}\n');
await mkdir(join(sandbox, 'node_modules/@cssearth'), { recursive: true });
for (const name of names) {
  const manifest = require.resolve(`@cssearth/${name}/package.json`), destination = join(sandbox, 'internal', name);
  await cp(dirname(manifest), destination, { recursive: true, filter: source => !source.includes('/node_modules') });
  await symlink(destination, join(sandbox, 'node_modules/@cssearth', name));
}
// Native/external dependencies can reuse installation bytes; no research package is linked.
for (const name of ['sharp']) await symlink(resolve(dirname(require.resolve(name)), '..'), join(sandbox, 'node_modules', name));
const bundle = await build({ entryPoints: [resolve(root, 'tools/nebula/application/prepare.ts')], outfile: join(sandbox, 'prepare.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', metafile: true,
  plugins: [{ name: 'public-workspace-packages', setup(plugin) {
    plugin.onResolve({ filter: /^@cssearth\// }, args => ({ path: require.resolve(args.path) }));
  } }] });
assert.ok(bundle.metafile);
const inputs = Object.keys(bundle.metafile.inputs).map(path => relative(root, resolve(root, path)));
for (const path of inputs) {
  assert.ok(!path.startsWith('labs/') || names.some(name => path.startsWith(`labs/nebula/packages/${name}/`)), `Forbidden lab implementation: ${path}`);
  if (path.startsWith('labs/')) continue;
  const destination = resolve(sandbox, path); await mkdir(dirname(destination), { recursive: true }); await cp(resolve(root, path), destination);
}
// Runtime host fingerprints include validation owners even when esbuild removes type-only imports.
for (const path of ['packages/renderer/src/volume/types.ts', 'packages/renderer/src/navigation/world-camera-math.ts',
  'packages/renderer/src/stars/prepared-catalogue-points.ts', 'src/objects/m42/object.json',
  'src/objects/m42/source', 'src/objects/m2-9/object.json', 'src/objects/m2-9/source',
  'src/objects/lmc/object.json', 'src/objects/lmc/prepared/lenses.json', 'src/objects/lmc/source', 'src/objects/stellar-neighbourhood/source/stars.json']) {
  const destination = resolve(sandbox, path); await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(root, path), destination, { recursive: true });
}
await assert.rejects(access(join(sandbox, 'labs')));
await writeFile(join(output, 'closure.json'), JSON.stringify({ sandbox, inputs }, null, 2));
await build({ entryPoints: [resolve(root, 'tools/nebula/application-isolation-guard.ts')], outfile: join(sandbox, 'guard.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22' });
const guardProbe = spawnSync(process.execPath, ['--import', './guard.mjs', '-e',
  "require('node:fs').readFileSync('/forbidden/labs/nebula/models/missing.json')"], { cwd: sandbox, encoding: 'utf8' });
assert.notEqual(guardProbe.status, 0);
assert.match(guardProbe.stderr, /ISOLATION_FORBIDDEN_LAB_ACCESS/);
await writeFile(join(output, 'deny-probe.log'), guardProbe.stdout + guardProbe.stderr);
async function run(id: string, reuse: boolean) {
  const args = ['--import', './guard.mjs', 'prepare.mjs', `--object=${id}`, ...(reuse ? ['--if-missing'] : [])];
  const child = spawn(process.execPath, args, { cwd: sandbox, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', data => { log += data; }); child.stderr.on('data', data => { log += data; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 180_000);
  const code = await new Promise<number | null>((accept, reject) => { child.once('error', reject); child.once('close', accept); }).finally(() => clearTimeout(timer));
  await writeFile(join(output, `${id}-${reuse ? 'reuse' : 'bake'}.log`), log);
  assert.equal(code, 0, log); assert.match(log, /APPLICATION_ISOLATION_GUARD_ACTIVE/); assert.match(log, /NEBULA_OBJECTS_COMPLETE/);
  if (reuse) assert.match(log, /"status":"verified"/);
}
for (const id of ['m42', 'm2-9', 'lmc']) {
  await run(id, false); await run(id, true);
  const directory = join(sandbox, 'src/objects', id);
  const descriptor = JSON.parse(await readFile(join(directory, 'object.json'), 'utf8'));
  const bytes = await readFile(join(directory, descriptor.prepared.url));
  const bank = JSON.parse(bytes.toString()).data; let resources = 0;
  for (const lens of bank.lenses) for (const resource of lens.volume.resources) {
    assert.equal(sha256(await readFile(join(directory, 'prepared', resource.path))), resource.sha256); resources++;
  }
  assert.ok(resources > 0);
  console.log(`APPLICATION_ISOLATION_PASS ${id} lenses=${bank.lenses.length} resources=${resources} reuse=verified`);
}
