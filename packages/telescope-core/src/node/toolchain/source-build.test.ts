import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { SCRATCH_ROOT, telescopePythonEnvironment } from '../paths/index.js';
import { runToolchainProcess } from './process.js';
import { assertSourceBuildPrerequisites, needsSourceBuild, SourceBuildPrerequisiteError, withSourceBuildPreflight } from './source-build.js';
import { readToolchainPins, type ToolchainPins } from './marker.js';

const pins: ToolchainPins = { id: 'fixture', file: 'fixture.json', descriptor: '{}', lock: null, entry: { sourceBuilds: ['fixture'] } };
const clean: NodeJS.ProcessEnv = { CC: undefined, CFLAGS: undefined, CPPFLAGS: undefined, LDFLAGS: undefined, SDKROOT: undefined };
type Call = { command: string; args: readonly string[]; options: Parameters<typeof runToolchainProcess>[2] };
const ready = (command: string) => command.endsWith('/probe') ? 'TELESCOPE_COMPILER_READY' : '';

test('preflight providers stay scoped across asynchronous operations and restore the compiler check', async () => {
  let passed = 0;
  await Promise.all([
    withSourceBuildPreflight(() => { passed++; }, async () => {
      await Promise.resolve();
      assertSourceBuildPrerequisites(pins);
    }),
    withSourceBuildPreflight(() => { throw new SourceBuildPrerequisiteError('scoped failure'); }, async () => {
      await Promise.resolve();
      assert.throws(() => assertSourceBuildPrerequisites(pins), /scoped failure/u);
    }),
  ]);
  assert.equal(passed, 1);
  assert.throws(() => assertSourceBuildPrerequisites(pins, 'linux', () => { throw new Error('missing compiler'); }, clean),
    /C compiler.*development headers/u);
});

test('the real astronomy lock requires a source-build preflight', () => {
  assert.equal(needsSourceBuild(readToolchainPins('astroquery', 'toolchain.json')), true);
  assert.equal(needsSourceBuild({ ...pins, entry: {} }), false);
});

test('a missing macOS SDK fails before invoking the compiler', () => {
  const calls: string[] = [];
  assert.throws(() => assertSourceBuildPrerequisites(pins, 'darwin', command => {
    calls.push(command); throw new Error('not installed');
  }, clean), error => error instanceof SourceBuildPrerequisiteError && /macOS SDK.*xcode-select --install/u.test(error.message));
  assert.deepEqual(calls, ['xcrun']);
});

test('macOS resolves cc with xcrun and compiles against the selected SDK', () => {
  const calls: Call[] = [];
  assertSourceBuildPrerequisites(pins, 'darwin', (command, args, options) => {
    calls.push({ command, args, options });
    if (command === 'xcrun') return args[0] === '--show-sdk-path' ? '/SDK' : '/developer/cc';
    return ready(command);
  }, clean);
  assert.deepEqual(calls.slice(0, 2).map(call => call.args), [['--show-sdk-path'], ['--find', 'cc']]);
  assert.deepEqual(calls.slice(2, 4).map(call => call.command), ['/developer/cc', '/developer/cc']);
  for (const call of calls.slice(2, 4)) assert.deepEqual(call.args.slice(0, 2), ['-isysroot', '/SDK']);
  assert.match(calls[2].options?.input ?? '', /#include <stdlib.h>/u);
  assert.equal(calls[0].options?.env, calls[4].options?.env);
});

test('macOS uses explicit CC and SDKROOT without substituting xcrun defaults', () => {
  const calls: Call[] = [];
  assertSourceBuildPrerequisites(pins, 'darwin', (command, args, options) => {
    calls.push({ command, args, options }); return ready(command);
  }, { ...clean, CC: 'custom-cc', SDKROOT: '/custom SDK', CFLAGS: '-O1' });
  assert.deepEqual(calls.slice(0, 2).map(call => call.command), ['custom-cc', 'custom-cc']);
  assert.deepEqual(calls[0].args.slice(0, 3), ['-isysroot', '/custom SDK', '-O1']);
  assert.equal(calls[0].options?.env?.SDKROOT, '/custom SDK');
});

test('missing or broken Linux compilers name both distribution remedies', () => {
  const calls: string[] = [];
  assert.throws(() => assertSourceBuildPrerequisites(pins, 'linux', command => {
    calls.push(command); throw new Error('missing compiler or headers');
  }, clean), /C compiler.*sudo apt install build-essential.*sudo dnf install gcc/u);
  assert.deepEqual(calls, ['cc', 'gcc', 'clang']);
});

test('Linux falls back to gcc then clang, and wheel-only environments need no compiler', () => {
  for (const working of ['gcc', 'clang']) {
    const calls: string[] = [];
    assertSourceBuildPrerequisites(pins, 'linux', command => {
      calls.push(command);
      if (command === 'cc' || command === 'gcc' && working === 'clang') throw new Error('missing');
      return ready(command);
    }, clean);
    assert.deepEqual(calls.slice(0, -1), working === 'gcc' ? ['cc', 'gcc', 'gcc'] : ['cc', 'gcc', 'clang', 'clang']);
  }
  assertSourceBuildPrerequisites({ ...pins, entry: {} }, 'linux', () => { throw new Error('must not check'); }, clean);
});

test('working CC is accepted without cc or gcc on PATH, with setuptools splitting and pip flags', () => {
  const calls: Call[] = [];
  const overrides = { ...clean, PATH: '/custom-tools', CC: '"/custom-tools/compiler wrapper" custom\\ compiler',
    CFLAGS: '-O2 -DNAME="two words"', CPPFLAGS: "-I'/headers with spaces'", LDFLAGS: '-L/libraries\\ with\\ spaces -lfixture' };
  assertSourceBuildPrerequisites(pins, 'linux', (command, args, options) => {
    calls.push({ command, args, options });
    if (command === 'cc' || command === 'gcc') throw new Error('not on PATH');
    return ready(command);
  }, overrides);
  assert.deepEqual(calls.slice(0, 2).map(call => call.command), ['/custom-tools/compiler wrapper', '/custom-tools/compiler wrapper']);
  assert.deepEqual(calls[0].args.slice(0, 6), ['custom compiler', '-O2', '-DNAME=two words', '-I/headers with spaces', '-x', 'c']);
  assert.deepEqual(calls[1].args.slice(0, 6), ['custom compiler', '-L/libraries with spaces', '-lfixture', '-O2', '-DNAME=two words', '-I/headers with spaces']);
  assert.deepEqual(calls[0].options?.env, telescopePythonEnvironment(overrides));
  for (const call of calls) assert.equal(call.options?.env, calls[0].options?.env);
});

test('broken CC is refused even when cc works, and the error names CC', () => {
  const calls: string[] = [];
  assert.throws(() => assertSourceBuildPrerequisites(pins, 'linux', command => {
    calls.push(command);
    if (command === 'broken-cc') throw new Error('broken');
    return ready(command);
  }, { ...clean, CC: 'broken-cc' }), /Check CC=broken-cc/u);
  assert.deepEqual(calls, ['broken-cc']);
});

test('the installer call inherits CC and flags without test-only overrides', () => {
  const previous = { CC: process.env.CC, CFLAGS: process.env.CFLAGS, CPPFLAGS: process.env.CPPFLAGS, LDFLAGS: process.env.LDFLAGS };
  const calls: Call[] = [];
  Object.assign(process.env, { CC: 'inherited-cc --fixture', CFLAGS: '-O1', CPPFLAGS: '-DINHERITED', LDFLAGS: '-L/inherited' });
  try {
    assertSourceBuildPrerequisites(pins, 'linux', (command, args, options) => {
      calls.push({ command, args, options }); return ready(command);
    });
    assert.equal(calls[0].command, 'inherited-cc');
    assert.deepEqual(calls[0].args.slice(0, 3), ['--fixture', '-O1', '-DINHERITED']);
    assert.deepEqual(calls[1].args.slice(0, 4), ['--fixture', '-L/inherited', '-O1', '-DINHERITED']);
    assert.deepEqual(calls[0].options?.env, telescopePythonEnvironment());
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('empty or malformed compiler configuration is refused without falling back', () => {
  for (const [name, value] of [['CC', ''], ['CC', '  '], ['CC', '""'], ['CC', '"unterminated'], ['CFLAGS', "'unterminated"],
    ['CPPFLAGS', '"unterminated'], ['LDFLAGS', "'unterminated"]]) {
    assert.throws(() => assertSourceBuildPrerequisites(pins, 'linux', () => { throw new Error('must not run'); },
      { ...clean, [name]: value }), new RegExp(`Invalid ${name}`, 'u'));
  }
});

test('setuptools preserves quoted escapes and empty arguments without shell expansion', () => {
  const calls: Call[] = [];
  assertSourceBuildPrerequisites(pins, 'linux', (command, args, options) => {
    calls.push({ command, args, options }); return ready(command);
  }, { ...clean, CC: 'custom-cc "" prefix\'suffix\'', CFLAGS: String.raw`'-DNAME=a\"b' -DPATH=one\\two $LITERAL` });
  assert.deepEqual(calls[0].args.slice(0, 5), ['', 'prefixsuffix', String.raw`-DNAME=a\"b`, String.raw`-DPATH=one\two`, '$LITERAL']);
});

test('compile, link and execution use managed build scratch and remove their files', () => {
  const calls: Call[] = [];
  assertSourceBuildPrerequisites(pins, 'linux', (command, args, options) => {
    calls.push({ command, args, options });
    const output = args[args.indexOf('-o') + 1];
    if (args.includes('-o')) assert.equal(resolve(output, '../..'), SCRATCH_ROOT);
    else assert.equal(resolve(command, '../..'), SCRATCH_ROOT);
    return ready(command);
  }, clean);
  assert.equal(calls.length, 3);
  const executable = calls[2].command;
  assert.equal(resolve(executable, '../..'), calls[2].options?.env?.TMPDIR);
  assert.equal(existsSync(resolve(executable, '..')), false);
  assert.throws(() => assertSourceBuildPrerequisites(pins, 'linux', (command, args) => {
    if (args.includes('-o')) return '';
    assert.equal(resolve(command, '../..'), SCRATCH_ROOT);
    throw new Error('no execution');
  }, { ...clean, CC: 'custom-cc' }), /Check CC=custom-cc/u);
});

test('a zero-exit compiler without a runnable confirmation is refused', () => {
  assert.throws(() => assertSourceBuildPrerequisites(pins, 'linux', () => '', { ...clean, CC: 'custom-cc' }), /Check CC=custom-cc/u);
});

test('a real CC compiles and runs without cc or gcc on PATH and refuses invalid build flags', {
  skip: !existsSync('/usr/bin/cc') || !['darwin', 'linux'].includes(process.platform),
}, () => {
  telescopePythonEnvironment();
  const directory = mkdtempSync(resolve(SCRATCH_ROOT, 'compiler-test-'));
  try {
    const compiler = resolve(directory, 'custom compiler');
    const nativeCompiler = process.platform === 'darwin' ? runToolchainProcess('xcrun', ['--find', 'cc']).trim() : '/usr/bin/cc';
    symlinkSync(nativeCompiler, compiler);
    for (const tool of ['as', 'ld']) if (existsSync(`/usr/bin/${tool}`)) symlinkSync(`/usr/bin/${tool}`, resolve(directory, tool));
    const overrides = { ...clean, CC: `"${compiler}"`, PATH: directory,
      SDKROOT: process.platform === 'darwin' ? runToolchainProcess('xcrun', ['--show-sdk-path']).trim() : undefined };
    assertSourceBuildPrerequisites(pins, process.platform, runToolchainProcess, overrides);
    for (const [name, flag] of [['CFLAGS', '-fno-such-telescope-option'], ['CPPFLAGS', '-include /no-such-telescope-header'],
      ['LDFLAGS', '-Wl,--no-such-telescope-option']]) {
      assert.throws(() => assertSourceBuildPrerequisites(pins, process.platform, runToolchainProcess, { ...overrides, [name]: flag }), /Check CC=/u);
    }
    assertSourceBuildPrerequisites(pins, process.platform, runToolchainProcess, { ...overrides, PATH: '/usr/bin' });
    assert.throws(() => assertSourceBuildPrerequisites(pins, process.platform, runToolchainProcess,
      { ...overrides, PATH: '/usr/bin', CC: '/no-such-telescope-compiler' }), /Check CC=\/no-such-telescope-compiler/u);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
