import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { MICROMAMBA_RELEASE, micromambaAsset, resolveMicromamba, type MicromambaOptions } from './micromamba.js';

const binary = Buffer.from(`#!${process.execPath}\nprocess.stdout.write('2.9.0\\n');\n`);
async function fixture() {
  const userRoot = await mkdtemp(resolve(tmpdir(), 'managed-micromamba-')), messages: string[] = [], urls: string[] = [];
  const fetcher: NonNullable<MicromambaOptions['fetcher']> = async url => {
    urls.push(url);
    return new Response(binary, { headers: { 'content-length': String(binary.length) } });
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
    assert.equal(f.urls.length, 1);
    assert.ok(f.urls.every(url => !url.endsWith('.sha256')), 'no published checksum URL is requested');
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
test('HTTPS redirects resolve relative locations and reach the release objects host', async () => {
  const f = await fixture(), urls: string[] = [], signals: (AbortSignal | null | undefined)[] = [];
  try {
    const path = await resolveMicromamba({ ...f.options, fetcher: async (url, options) => {
      assert.equal(options.redirect, 'manual');
      urls.push(url); signals.push(options.signal);
      if (urls.length === 1) return new Response(null, { status: 302, headers: { location: './redirected' } });
      if (urls.length === 2) return new Response(null, { status: 307, headers: { location: 'https://release-assets.githubusercontent.com/objects/micromamba' } });
      return new Response(binary, { headers: { 'content-length': String(binary.length) } });
    } });
    assert.deepEqual(urls, [
      `https://github.com/mamba-org/micromamba-releases/releases/download/${MICROMAMBA_RELEASE}/${micromambaAsset(process.platform, process.arch)}`,
      `https://github.com/mamba-org/micromamba-releases/releases/download/${MICROMAMBA_RELEASE}/redirected`,
      'https://release-assets.githubusercontent.com/objects/micromamba',
    ]);
    assert.ok(signals[0] instanceof AbortSignal);
    assert.ok(signals.every(signal => signal === signals[0]), 'all hops retain the same timeout');
    assert.deepEqual(await readFile(path), binary);
    assert.deepEqual(await readdir(f.directory), ['micromamba']);
  } finally { await f.cleanup(); }
});
test('an HTTPS to HTTP redirect is refused before fetching or reading the insecure binary', async () => {
  const f = await fixture(), urls: string[] = [];
  let bodyReads = 0, cancelled = false;
  try {
    await assert.rejects(resolveMicromamba({ ...f.options, fetcher: async (url, options) => {
      urls.push(url);
      // Model native auto-follow: a valid executable arrives unless manual redirects are requested.
      if (options.redirect !== 'manual' || new URL(url).protocol === 'http:') {
        bodyReads++;
        return new Response(binary);
      }
      return new Response(new ReadableStream<Uint8Array>({
        pull(controller) { bodyReads++; controller.enqueue(binary); },
        cancel() { cancelled = true; },
      }, { highWaterMark: 0 }), { status: 302, headers: { location: 'http://objects.example/micromamba' } });
    } }), /require HTTPS at every redirect hop: http:\/\/objects\.example\/micromamba/u);
    assert.equal(urls.length, 1, 'the HTTP hop is never fetched');
    assert.equal(bodyReads, 0, 'no redirect or executable body is read');
    assert.equal(cancelled, true);
    assert.deepEqual(await readdir(f.directory), []);
  } finally { await f.cleanup(); }
});
test('more than 10 redirects are refused without publishing a binary', async () => {
  const f = await fixture();
  let calls = 0;
  try {
    await assert.rejects(resolveMicromamba({ ...f.options, fetcher: async () => {
      calls++;
      return new Response(null, { status: 308, headers: { location: `./hop-${calls}` } });
    } }), /exceeded 10 redirects/u);
    assert.equal(calls, 11);
    assert.deepEqual(await readdir(f.directory), []);
  } finally { await f.cleanup(); }
});
test('a redirect without Location is refused without publishing a binary', async () => {
  const f = await fixture();
  try {
    await assert.rejects(resolveMicromamba({ ...f.options, fetcher: async () => new Response(null, { status: 301 }) }),
      /HTTP 301 without a redirect Location/u);
    assert.deepEqual(await readdir(f.directory), []);
  } finally { await f.cleanup(); }
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
      assert.equal(f.urls.length, 1, 'an incompatible PATH binary triggers the managed download');
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
test('a failed transfer leaves no installed or partial binary and retries from the beginning', async () => {
  const f = await fixture();
  try {
    const fetcher: NonNullable<MicromambaOptions['fetcher']> = async () =>
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
for (const [kind, reason] of [
  ['offline', /network blocked/u], ['http', /HTTP 404/u],
  ['short-transfer', /Incomplete micromamba download/u],
  ['truncated', /does not run as 2\.9\.0/u], ['wrong-version', /does not run as 2\.9\.0/u],
  ['missing-version', /does not run as 2\.9\.0/u],
] as const) {
  test(`${kind} refuses the managed download and leaves a clean retry`, async () => {
    const f = await fixture();
    try {
      await assert.rejects(resolveMicromamba({ ...f.options, fetcher: async () => {
        if (kind === 'offline') throw new Error('network blocked');
        if (kind === 'http') return new Response('missing', { status: 404 });
        if (kind === 'short-transfer') return new Response(binary.subarray(0, 8), { headers: { 'content-length': String(binary.length) } });
        if (kind === 'truncated') return new Response(binary.subarray(0, 8));
        return new Response(`#!${process.execPath}\n${kind === 'wrong-version' ? "process.stdout.write('2.8.0\\n');" : 'process.exit(0);'}\n`);
      } }), error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Missing managed micromamba.*Retry the same telescope command/u);
        assert.match(error.message, reason);
        return true;
      });
      assert.deepEqual(await readdir(f.directory), []);
      assert.deepEqual(await readFile(await resolveMicromamba(f.options)), binary);
    } finally { await f.cleanup(); }
  });
}
test('simultaneous callers share one download, and dead staging directories are reclaimed', async () => {
  const f = await fixture();
  try {
    await mkdir(resolve(f.directory, 'download-abandoned'), { recursive: true });
    await writeFile(resolve(f.directory, 'download-abandoned/owner'), '2147483647');
    const paths = await Promise.all([resolveMicromamba(f.options), resolveMicromamba(f.options)]);
    assert.equal(paths[0], paths[1]); assert.equal(f.urls.length, 1);
    assert.deepEqual(await readdir(f.directory), ['micromamba']);
  } finally { await f.cleanup(); }
});
test('separate processes publish complete verified binaries without sharing partial files', async () => {
  const f = await fixture();
  try {
    const source = `
import { resolveMicromamba } from ${JSON.stringify(new URL('./micromamba.ts', import.meta.url).href)};
const binary = Buffer.from(${JSON.stringify(binary.toString())});
const path = await resolveMicromamba({
  userRoot: ${JSON.stringify(f.userRoot)}, env: { PATH: '' }, report: () => {},
  fetcher: async () => {
    await new Promise(done => setTimeout(done, 100));
    return new Response(binary);
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
