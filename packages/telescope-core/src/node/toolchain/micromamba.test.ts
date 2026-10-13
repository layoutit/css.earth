import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { MICROMAMBA_RELEASE, micromambaAsset, resolveMicromamba, type MicromambaOptions } from './micromamba.js';

const binary = Buffer.from(`#!${process.execPath}\nprocess.stdout.write('2.9.0\\n');\n`);
const checksum = () => createHash('sha256').update(binary).digest('hex');
async function fixture() {
  const userRoot = await mkdtemp(resolve(tmpdir(), 'managed-micromamba-')), messages: string[] = [], urls: string[] = [];
  const fetcher: NonNullable<MicromambaOptions['fetcher']> = async url => {
    urls.push(url);
    return url.endsWith('.sha256') ? new Response(checksum()) :
      new Response(binary, { headers: { 'content-length': String(binary.length) } });
  };
  const options: MicromambaOptions = { userRoot, env: { PATH: '' }, fetcher, report: message => { messages.push(message); } };
  const directory = resolve(userRoot, 'micromamba', MICROMAMBA_RELEASE, micromambaAsset(process.platform, process.arch));
  return { userRoot, options, directory, urls, messages, cleanup: () => rm(userRoot, { recursive: true, force: true }) };
}
test('a cold user root with no Python, uv or micromamba on PATH downloads the managed release', async () => {
  const f = await fixture(), previousPath = process.env.PATH, previousOverride = process.env.CSSEARTH_TELESCOPE_MICROMAMBA;
  try {
    process.env.PATH = ''; delete process.env.CSSEARTH_TELESCOPE_MICROMAMBA;
    // Exercise the default environment policy, not an explicit resolver override that bypasses PATH.
    const path = await resolveMicromamba({ ...f.options, env: undefined });
    assert.equal(path, resolve(f.directory, 'micromamba'));
    assert.deepEqual(await readFile(path), binary);
    assert.equal((await stat(path)).mode & 0o111, 0o111);
    assert.equal(f.urls.length, 2);
    assert.ok(f.urls.every(url => url.startsWith(`https://github.com/mamba-org/micromamba-releases/releases/download/${MICROMAMBA_RELEASE}/`)));
    assert.match(f.messages.join(''), new RegExp(`${binary.length} bytes`));
    assert.match(f.messages.join(''), /Downloading micromamba.*https:/u);
    assert.deepEqual(await readdir(f.directory), ['micromamba']);
    assert.equal(await resolveMicromamba({ ...f.options, fetcher: async () => { throw new Error('must work offline'); } }), path);
  } finally {
    if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
    if (previousOverride === undefined) delete process.env.CSSEARTH_TELESCOPE_MICROMAMBA; else process.env.CSSEARTH_TELESCOPE_MICROMAMBA = previousOverride;
    await f.cleanup();
  }
});
test('an override wins over PATH and the managed cache; PATH wins over a download', async () => {
  const f = await fixture();
  try {
    const directory = resolve(f.userRoot, 'bin'), override = resolve(f.userRoot, 'chosen');
    await mkdir(directory); await writeFile(resolve(directory, 'micromamba'), binary); await chmod(resolve(directory, 'micromamba'), 0o755);
    await writeFile(override, binary); await chmod(override, 0o755);
    await resolveMicromamba(f.options);
    const noNetwork = async () => { throw new Error('network forbidden'); };
    assert.equal(await resolveMicromamba({ ...f.options, env: { PATH: directory, CSSEARTH_TELESCOPE_MICROMAMBA: override }, fetcher: noNetwork }), override);
    assert.equal(await resolveMicromamba({ ...f.options, env: { PATH: directory }, fetcher: noNetwork }), resolve(directory, 'micromamba'));
    assert.equal(await resolveMicromamba({ ...f.options, env: { PATH: directory, CSSEARTH_TELESCOPE_MICROMAMBA: 'micromamba' }, fetcher: noNetwork }), resolve(directory, 'micromamba'));
    await assert.rejects(resolveMicromamba({ ...f.options, env: { PATH: directory, CSSEARTH_TELESCOPE_MICROMAMBA: '/missing/binary' }, fetcher: noNetwork }), /not an executable/u);
    await assert.rejects(resolveMicromamba({ ...f.options, env: { PATH: directory, CSSEARTH_TELESCOPE_MICROMAMBA: '' } }), /not an executable/u);
  } finally { await f.cleanup(); }
});
for (const [version, status] of [
  ['0.27.0', 0], ['1.5.3', 0], ['1.99.99', 0], ['2.0.5', 0], ['2.0.6', 0],
  ['not a version', 0], ['', 0], ['2.0', 0], ['2.0.7.rc1', 0], ['2.0.5', 1], ['2.9.0', 1],
] as const) {
  test(`PATH version ${JSON.stringify(version)} (status ${status}) falls back to the managed release`, async () => {
    const f = await fixture();
    try {
      const directory = resolve(f.userRoot, 'bin'), path = resolve(directory, 'micromamba');
      await mkdir(directory);
      await writeFile(path, `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(version)}); process.exit(${status});\n`, { mode: 0o755 });
      assert.equal(await resolveMicromamba({ ...f.options, env: { PATH: directory } }), resolve(f.directory, 'micromamba'));
      assert.equal(f.urls.length, 2, 'an incompatible PATH binary triggers the managed download');
    } finally { await f.cleanup(); }
  });
}
test('stable micromamba 2.0.7 and later on PATH work without a download', async () => {
  const f = await fixture();
  try {
    const directory = resolve(f.userRoot, 'bin'), path = resolve(directory, 'micromamba');
    await mkdir(directory);
    for (const version of ['2.0.7', '2.0.10', '2.1.0', '2.9.0', '3.0.0']) {
      await writeFile(path, `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(version)});\n`, { mode: 0o755 });
      assert.equal(await resolveMicromamba({ ...f.options, env: { PATH: directory }, fetcher: async () => { throw new Error('network forbidden'); } }), path);
    }
    assert.deepEqual(f.urls, []);
  } finally { await f.cleanup(); }
});
test('a corrupted download is refused even when it runs and reports the pinned version', async () => {
  const f = await fixture();
  try {
    const corrupt = Buffer.concat([binary, Buffer.from('// changed bytes\n')]);
    await assert.rejects(resolveMicromamba({ ...f.options, fetcher: async url => url.endsWith('.sha256') ?
      new Response(checksum()) : new Response(corrupt) }), /checksum mismatch/u);
    assert.deepEqual(await readdir(f.directory), []);
    await resolveMicromamba(f.options); // A failed verification does not poison the next attempt.
  } finally { await f.cleanup(); }
});
test('a failed transfer leaves no installed or partial binary and retries from the beginning', async () => {
  const f = await fixture();
  try {
    const fetcher: NonNullable<MicromambaOptions['fetcher']> = async url => url.endsWith('.sha256') ? new Response(checksum()) :
      new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(binary.subarray(0, 8)); },
        pull(controller) { controller.error(new Error('connection lost')); } }));
    await assert.rejects(resolveMicromamba({ ...f.options, fetcher }), /Missing managed micromamba.*Python cannot be installed.*connection lost.*Retry the same telescope command/u);
    assert.deepEqual(await readdir(f.directory), []);
    const abandoned = resolve(f.directory, 'download-abandoned');
    await mkdir(abandoned);
    await writeFile(resolve(abandoned, 'owner'), '2147483647');
    await writeFile(resolve(abandoned, 'binary.partial'), 'previous crashed transfer');
    const path = await resolveMicromamba(f.options);
    assert.deepEqual(await readFile(path), binary);
    assert.deepEqual(await readdir(f.directory), ['micromamba']);
  } finally { await f.cleanup(); }
});
test('network and checksum failures identify the missing download and leave a clean retry', async () => {
  for (const kind of ['offline', 'http', 'invalid-checksum', 'truncated', 'wrong-version']) {
    const f = await fixture();
    try {
      await assert.rejects(resolveMicromamba({ ...f.options, fetcher: async url => {
        if (kind === 'offline') throw new Error('network blocked');
        if (kind === 'http') return new Response('missing', { status: 404 });
        const wrong = Buffer.from(`#!${process.execPath}\nprocess.exit(0);\n`);
        if (url.endsWith('.sha256')) return new Response(kind === 'invalid-checksum' ? 'invalid' :
          kind === 'wrong-version' ? createHash('sha256').update(wrong).digest('hex') : checksum());
        if (kind === 'truncated') return new Response(binary.subarray(0, 8), { headers: { 'content-length': String(binary.length) } });
        // Matching checksum, but the process exits without the required positive version signal.
        return new Response(wrong);
      } }), /Missing managed micromamba.*Retry the same telescope command/u);
      assert.deepEqual(await readdir(f.directory), []);
    } finally { await f.cleanup(); }
  }
});
test('simultaneous callers share one download, and dead staging directories are reclaimed', async () => {
  const f = await fixture();
  try {
    await mkdir(resolve(f.directory, 'download-abandoned'), { recursive: true });
    await writeFile(resolve(f.directory, 'download-abandoned/owner'), '2147483647');
    const paths = await Promise.all([resolveMicromamba(f.options), resolveMicromamba(f.options)]);
    assert.equal(paths[0], paths[1]); assert.equal(f.urls.length, 2);
    assert.deepEqual(await readdir(f.directory), ['micromamba']);
  } finally { await f.cleanup(); }
});
test('separate processes publish complete verified binaries without sharing partial files', async () => {
  const f = await fixture();
  try {
    const source = `
import { resolveMicromamba } from ${JSON.stringify(new URL('./micromamba.ts', import.meta.url).href)};
import { createHash } from 'node:crypto';
const binary = Buffer.from(${JSON.stringify(binary.toString())});
const path = await resolveMicromamba({
  userRoot: ${JSON.stringify(f.userRoot)}, env: { PATH: '' }, report: () => {},
  fetcher: async url => {
    await new Promise(done => setTimeout(done, 100));
    return url.endsWith('.sha256') ? new Response(createHash('sha256').update(binary).digest('hex')) : new Response(binary);
  }
});
process.stdout.write(path);
`;
    const run = () => new Promise<string>((done, fail) => {
      const child = spawn(process.execPath, ['--import', resolve('packages/core/src/node/register-vite-suffix.mts'), '--input-type=module', '-e', source]);
      let stdout = '', stderr = '';
      child.stdout.setEncoding('utf8').on('data', text => { stdout += text; });
      child.stderr.setEncoding('utf8').on('data', text => { stderr += text; });
      child.on('error', fail);
      child.on('close', code => { if (code !== 0) fail(new Error(stderr)); else done(stdout); });
    });
    const paths = await Promise.all([run(), run()]);
    assert.equal(paths[0], paths[1]);
    assert.deepEqual(await readFile(paths[0]!), binary);
    assert.deepEqual(await readdir(f.directory), ['micromamba']);
  } finally { await f.cleanup(); }
});
test('release targets are explicit and unsupported architectures require an override', () => {
  for (const [platform, arch, target] of [['darwin', 'arm64', 'osx-arm64'], ['darwin', 'x64', 'osx-64'],
    ['linux', 'x64', 'linux-64'], ['linux', 'arm64', 'linux-aarch64'], ['linux', 'ppc64', 'linux-ppc64le']]) assert.equal(micromambaAsset(platform!, arch!), `micromamba-${target}`);
  assert.throws(() => micromambaAsset('freebsd', 'x64'), /No managed micromamba/u);
  assert.throws(() => micromambaAsset('linux', 'ia32'), /No managed micromamba/u);
});

test('Windows refuses before overrides, PATH lookup or downloads', async () => {
  const f = await fixture();
  try {
    for (const env of [{ PATH: '' }, { PATH: '', CSSEARTH_TELESCOPE_MICROMAMBA: '/missing/override' }]) {
      await assert.rejects(resolveMicromamba({ ...f.options, env, platform: 'win32' }),
        { message: 'managed Python toolchains need macOS or Linux; on Windows use WSL' });
    }
    assert.throws(() => micromambaAsset('win32', 'x64'), /managed Python toolchains need macOS or Linux; on Windows use WSL/u);
    assert.deepEqual(f.urls, []);
    assert.deepEqual(await readdir(f.userRoot), []);
  } finally { await f.cleanup(); }
});
