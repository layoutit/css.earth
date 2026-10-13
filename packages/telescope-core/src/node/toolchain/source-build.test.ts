import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSourceBuildPrerequisites, needsSourceBuild, SourceBuildPrerequisiteError } from './source-build.js';
import { readToolchainPins, type ToolchainPins } from './marker.js';

const pins: ToolchainPins = { id: 'fixture', file: 'fixture.json', descriptor: '{}', lock: null, entry: { sourceBuilds: ['fixture'] } };

test('the real astronomy lock requires a source-build preflight', () => {
  assert.equal(needsSourceBuild(readToolchainPins('astroquery', 'toolchain.json')), true);
  assert.equal(needsSourceBuild({ ...pins, entry: {} }), false);
});

test('a missing macOS SDK fails before invoking the compiler', () => {
  const calls: string[] = [];
  assert.throws(() => assertSourceBuildPrerequisites(pins, 'darwin', command => {
    calls.push(command); throw new Error('not installed');
  }), error => error instanceof SourceBuildPrerequisiteError && /macOS SDK.*xcode-select --install/u.test(error.message));
  assert.deepEqual(calls, ['xcrun']);
});

test('macOS compiles a standard-library probe against the selected SDK', () => {
  const calls: string[] = [];
  assertSourceBuildPrerequisites(pins, 'darwin', (command, args, options) => {
    if (args.length === 0) return 'TELESCOPE_COMPILER_READY';
    calls.push(command);
    if (command === 'xcrun') { assert.deepEqual(args, ['--show-sdk-path']); return '/SDK'; }
    assert.equal(command, 'cc'); assert.deepEqual(args.slice(0, 2), ['-isysroot', '/SDK']);
    assert.match(options?.input ?? '', /#include <stdlib.h>/u);
    return '';
  });
  assert.deepEqual(calls, ['xcrun', 'cc']);
});

test('missing or broken Linux compilers name both distribution remedies', () => {
  const calls: string[] = [];
  assert.throws(() => assertSourceBuildPrerequisites(pins, 'linux', command => {
    calls.push(command); throw new Error('missing compiler or headers');
  }), /C compiler.*sudo apt install build-essential.*sudo dnf install gcc/u);
  assert.deepEqual(calls, ['cc', 'gcc']);
});

test('Linux falls back to gcc, and a wheel-only environment needs no compiler', () => {
  const calls: string[] = [];
  assertSourceBuildPrerequisites(pins, 'linux', (command, args) => {
    if (args.length === 0) return 'TELESCOPE_COMPILER_READY';
    calls.push(command); if (command === 'cc') throw new Error('missing'); return '';
  });
  assert.deepEqual(calls, ['cc', 'gcc']);
  assertSourceBuildPrerequisites({ ...pins, entry: {} }, 'linux', () => { throw new Error('must not check'); });
});
