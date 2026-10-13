import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, rmdir, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { installManagedToolchain, verifyToolchainExecutables, verifyToolchainPython, withInstallLock } from './environment.js';
import { installedMarkerIssue, writeInstalledMarker, type ToolchainPins } from './marker.js';

const pins: ToolchainPins = { id: 'fixture', file: 'fixture.json', descriptor: 'fixture pins', lock: null,
  entry: { python: 'python3.12', requirements: ['fixture-package'] } };
const python = `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path');
const prefix = path.dirname(path.dirname(process.argv[1]));
if (process.argv.includes('-c')) process.stdout.write(fs.readFileSync(path.join(prefix, 'version'), 'utf8'));
else if (process.argv.includes('--version') && fs.existsSync(path.join(prefix, 'pip-ready'))) process.stdout.write('pip fixture');
else process.exit(23);
`;
async function interpreter(prefix: string, version = '3.12.2', pip = true) {
  await mkdir(resolve(prefix, 'bin'), { recursive: true });
  await writeFile(resolve(prefix, 'bin/python'), python); await chmod(resolve(prefix, 'bin/python'), 0o755);
  await writeFile(resolve(prefix, 'version'), version);
  if (pip) await writeFile(resolve(prefix, 'pip-ready'), 'installed');
}
async function fixture() {
  const userRoot = await mkdtemp(resolve(tmpdir(), 'toolchain-lifecycle-')), root = resolve(userRoot, 'environment'), prefix = resolve(root, 'venv');
  await mkdir(root);
  return { userRoot, root, prefix, cleanup: () => rm(userRoot, { recursive: true, force: true }) };
}

test('interrupted, wrong-version, missing-pip and differently pinned environments are rebuilt from scratch', async () => {
  for (const state of ['interrupted', 'wrong-version', 'missing-pip', 'other-pins']) {
    const f = await fixture(); let creations = 0;
    try {
      await interpreter(f.prefix, state === 'wrong-version' ? '3.11.9' : '3.12.2', state !== 'missing-pip');
      await writeFile(resolve(f.prefix, 'partial-dependency'), 'must disappear');
      if (state !== 'interrupted') writeInstalledMarker(f.root, state === 'other-pins' ? { ...pins, descriptor: 'other' } : pins);
      const install = async () => {
        creations++;
        assert.deepEqual(await readdir(f.root), ['venv.installing']);
        assert.equal(installedMarkerIssue(f.root, pins), 'missing');
        await interpreter(f.prefix);
      };
      await installManagedToolchain(f.root, () => pins, f.prefix, install, () => {
        if (creations > 0) assert.equal(installedMarkerIssue(f.root, pins), 'missing', 'marker must follow verification');
      });
      assert.equal(creations, 1, state);
      assert.equal(installedMarkerIssue(f.root, pins), null);
      assert.deepEqual((await readdir(f.prefix)).sort(), ['bin', 'pip-ready', 'version']);
      await installManagedToolchain(f.root, () => pins, f.prefix, install, () => verifyToolchainPython(f.prefix, pins));
      assert.equal(creations, 1, 'a complete environment is reused');
    } finally { await f.cleanup(); }
  }
});

test('installation and verification failures never leave a completion marker, and retries rebuild', async () => {
  const f = await fixture();
  try {
    await assert.rejects(installManagedToolchain(f.root, () => pins, f.prefix, async () => {
      await interpreter(f.prefix); throw new Error('dependency installation interrupted');
    }, () => verifyToolchainPython(f.prefix, pins)), /dependency installation interrupted/u);
    assert.equal(installedMarkerIssue(f.root, pins), 'missing');
    await assert.rejects(installManagedToolchain(f.root, () => pins, f.prefix, async () => {
      await interpreter(f.prefix, '3.11.2');
    }, () => verifyToolchainPython(f.prefix, pins)), /Expected Python 3.12/u);
    assert.equal(installedMarkerIssue(f.root, pins), 'missing');
    await assert.rejects(installManagedToolchain(f.root, () => pins, f.prefix, async () => {
      await interpreter(f.prefix);
    }, () => { throw new Error('package verification failed'); }), /package verification failed/u);
    assert.equal(installedMarkerIssue(f.root, pins), 'missing');
    await installManagedToolchain(f.root, () => pins, f.prefix, async () => { await interpreter(f.prefix); }, () => verifyToolchainPython(f.prefix, pins));
    assert.equal(installedMarkerIssue(f.root, pins), null);
    assert.deepEqual(await readdir(f.root), ['installed.json', 'venv']);
  } finally { await f.cleanup(); }
});

async function mambaFixture(userRoot: string) {
  const command = resolve(userRoot, 'micromamba');
  await writeFile(command, `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2), prefix = args[args.indexOf('-p') + 1];
fs.appendFileSync(${JSON.stringify(resolve(userRoot, 'creations'))}, 'create\\n');
fs.mkdirSync(path.join(prefix, 'bin'), { recursive: true });
fs.writeFileSync(path.join(prefix, 'bin/python'), ${JSON.stringify(python)}, { mode: 0o755 });
fs.writeFileSync(path.join(prefix, 'version'), '3.12.2');
fs.writeFileSync(path.join(prefix, 'pip-ready'), 'installed');
setTimeout(() => {}, 250);
`);
  await chmod(command, 0o755); return command;
}
function child(source: string, env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((done, fail) => {
    const worker = spawn(process.execPath, ['--import', resolve('packages/core/src/node/register-vite-suffix.mts'), '--input-type=module', '-e', source],
      { env: { ...process.env, ...env } });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { worker.kill(); fail(new Error('installer worker timed out')); }, 15_000);
    worker.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    worker.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    worker.on('error', error => { clearTimeout(timer); fail(error); });
    worker.on('close', code => { clearTimeout(timer); code === 0 ? done(stdout) : fail(new Error(stderr)); });
  });
}

test('two processes installing one prefix create it once, both succeed, and reuse a complete final environment', async () => {
  const f = await fixture();
  try {
    const mamba = await mambaFixture(f.userRoot);
    const source = `
import { ensureToolchainPython } from ${JSON.stringify(new URL('./environment.ts', import.meta.url).href)};
import { installedMarkerIssue } from ${JSON.stringify(new URL('./marker.ts', import.meta.url).href)};
import { writeFile } from 'node:fs/promises';
const pins = ${JSON.stringify(pins)};
await ensureToolchainPython(${JSON.stringify(f.prefix)}, () => pins, async () => {
  await new Promise(done => setTimeout(done, 250));
  await writeFile(${JSON.stringify(resolve(f.prefix, 'dependencies'))}, 'complete');
});
if (installedMarkerIssue(${JSON.stringify(f.root)}, pins) !== null) throw new Error('no final marker');
process.stdout.write('COMPLETE');
`;
    const results = await Promise.all([child(source, { CSSEARTH_TELESCOPE_HOME: f.userRoot, CSSEARTH_TELESCOPE_MICROMAMBA: mamba }),
      child(source, { CSSEARTH_TELESCOPE_HOME: f.userRoot, CSSEARTH_TELESCOPE_MICROMAMBA: mamba })]);
    assert.deepEqual(results, ['COMPLETE', 'COMPLETE']);
    assert.equal(await readFile(resolve(f.userRoot, 'creations'), 'utf8'), 'create\n');
    assert.equal(await readFile(resolve(f.prefix, 'dependencies'), 'utf8'), 'complete');
    assert.equal(installedMarkerIssue(f.root, pins), null);
    await installManagedToolchain(f.root, () => pins, f.prefix, async () => { throw new Error('must reuse'); }, () => verifyToolchainPython(f.prefix, pins));
  } finally { await f.cleanup(); }
});

test('a dead install lock is reclaimed while an old live lock is retained until its owner releases it', async () => {
  const f = await fixture(), lock = `${f.prefix}.installing`;
  try {
    for (const pid of [2147483647, process.pid]) {
      await mkdir(lock); await writeFile(resolve(lock, 'owner'), String(pid));
      const old = new Date(Date.now() - 120_000); await utimes(resolve(lock, 'owner'), old, old);
      let entered = false;
      const work = withInstallLock(f.prefix, async () => { entered = true; });
      if (pid === process.pid) {
        await new Promise(done => setTimeout(done, 200));
        assert.equal(entered, false, 'age alone must never retire a live owner');
        assert.equal(await readFile(resolve(lock, 'owner'), 'utf8'), String(pid));
        await rm(resolve(lock, 'owner'));
        await rmdir(lock).catch(error => { if (error.code !== 'ENOTEMPTY' && error.code !== 'ENOENT') throw error; });
      }
      await work; assert.equal(entered, true);
    }
    assert.deepEqual(await readdir(f.root), []);
  } finally { await f.cleanup(); }
});

test('a waiting process reads newly published pins under the lock and reuses the environment without deletion', async () => {
  const f = await fixture(), pinsFile = resolve(f.userRoot, 'pins.json');
  const published = { ...pins, lock: '@EXPLICIT\nnew-package\n' };
  try {
    await writeFile(pinsFile, JSON.stringify(pins));
    const source = `
import { installManagedToolchain } from ${JSON.stringify(new URL('./environment.ts', import.meta.url).href)};
import { readFile } from 'node:fs/promises';
const readPins = async () => JSON.parse(await readFile(${JSON.stringify(pinsFile)}, 'utf8'));
await installManagedToolchain(${JSON.stringify(f.root)}, readPins, ${JSON.stringify(f.prefix)},
  async () => { throw new Error('waiting process must not delete or reinstall'); },
  async pins => {
    if (pins.lock !== ${JSON.stringify(published.lock)}) throw new Error('stale pins reached verifier');
    if (await readFile(${JSON.stringify(resolve(f.prefix, 'sentinel'))}, 'utf8') !== 'preserved') throw new Error('environment deleted');
  });
process.stdout.write('REUSED');
`;
    let waiting: Promise<string> | undefined;
    await withInstallLock(f.prefix, async () => {
      waiting = child(source, {});
      // The child's staging directory proves it attempted acquisition while A still owns the lock.
      const deadline = Date.now() + 10_000;
      while (!(await readdir(f.root)).some(name => name.startsWith('venv.installing-'))) {
        if (Date.now() > deadline) throw new Error('process B did not wait for the lock');
        await new Promise(done => setTimeout(done, 20));
      }
      await interpreter(f.prefix);
      await writeFile(resolve(f.prefix, 'sentinel'), 'preserved');
      await writeFile(pinsFile, JSON.stringify(published));
      writeInstalledMarker(f.root, published);
    });
    assert.equal(await waiting, 'REUSED');
    assert.equal(await readFile(resolve(f.prefix, 'sentinel'), 'utf8'), 'preserved');
    assert.equal(installedMarkerIssue(f.root, published), null);
  } finally { await f.cleanup(); }
});

test('native reuse verifies executables and repairs deletion before republishing the marker', async () => {
  const f = await fixture(), executable = resolve(f.root, 'pipeline/bin/esorex');
  let installs = 0;
  const install = async () => {
    installs++;
    await mkdir(resolve(executable, '..'), { recursive: true });
    await writeFile(executable, '#!/bin/sh\nexit 0\n'); await chmod(executable, 0o755);
  };
  const verify = () => verifyToolchainExecutables([executable]);
  try {
    await installManagedToolchain(f.root, () => pins, null, install, verify);
    await installManagedToolchain(f.root, () => pins, null, install, verify);
    assert.equal(installs, 1, 'healthy native tool is reused');
    await rm(executable);
    await installManagedToolchain(f.root, () => pins, null, install, verify);
    assert.equal(installs, 2, 'matching marker cannot conceal a deleted executable');
    await verify();
    assert.equal(installedMarkerIssue(f.root, pins), null);
    await rm(executable);
    await assert.rejects(installManagedToolchain(f.root, () => pins, null, async () => {}, verify), /missing or not executable/u);
    assert.equal(installedMarkerIssue(f.root, pins), 'missing');
  } finally { await f.cleanup(); }
});

test('toolchain verification rejects a nonexecutable file or a directory', async () => {
  const f = await fixture(), path = resolve(f.root, 'command');
  try {
    await writeFile(path, 'not executable'); await chmod(path, 0o644);
    await assert.rejects(verifyToolchainExecutables([path]), /missing or not executable/u);
    await rm(path); await mkdir(path);
    await assert.rejects(verifyToolchainExecutables([path]), /missing or not executable/u);
    await assert.rejects(verifyToolchainExecutables([]), /at least one executable/u);
  } finally { await f.cleanup(); }
});

test('the lifecycle requires both a pins reader and an explicit verifier before writing', async () => {
  const f = await fixture();
  try {
    await assert.rejects(Reflect.apply(installManagedToolchain, undefined, [f.root, pins, null, async () => {}, () => {}]), /pins reader and a verifier/u);
    await assert.rejects(Reflect.apply(installManagedToolchain, undefined, [f.root, () => pins, null, async () => {}]), /pins reader and a verifier/u);
    assert.deepEqual(await readdir(f.root), []);
  } finally { await f.cleanup(); }
});
