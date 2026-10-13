/** Source releases in the pinned locks need native headers as well as a compiler executable. */
import { mkdtempSync, rmSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { resolve } from 'node:path';
import { SCRATCH_ROOT, telescopePythonEnvironment } from '../paths.js';
import { runToolchainProcess } from './process.js';
import type { ToolchainPins } from './marker.js';

export const SOURCE_BUILD_PREREQUISITE_PREFIX = 'Managed source-build prerequisite: ';
export class SourceBuildPrerequisiteError extends Error {
  constructor(message: string) { super(SOURCE_BUILD_PREREQUISITE_PREFIX + message); }
}

/** Existing descriptors declare source passes; orbitize and SPIDERMAN also ship source-only releases in their locks. */
export function needsSourceBuild(pins: ToolchainPins): boolean {
  const e = pins.entry;
  return Array.isArray(e.sourcePackages) && e.sourcePackages.length > 0 || Array.isArray(e.sourceBuilds) && e.sourceBuilds.length > 0
    || typeof e.orbitize === 'string' || typeof e.spiderman === 'string';
}

/** Match setuptools' split_quoted: no shell expansion, with escapes inside quotes retained. */
function buildWords(value: string, name: string): string[] {
  value = value.trim();
  const words: string[] = [];
  let word = '', quote: string | undefined, started = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (quote) {
      if (char === quote) quote = undefined;
      else if (char === '\\' && i + 1 < value.length) word += char + value[++i];
      else word += char;
    } else if (char === '\\') {
      started = true;
      if (i + 1 < value.length) word += value[++i];
    } else if (char === '"' || char === "'") { quote = char; started = true; }
    else if (/[ \t\n\r\v\f]/u.test(char)) {
      if (started) words.push(word);
      word = ''; started = false;
    } else { word += char; started = true; }
  }
  if (quote) throw new SourceBuildPrerequisiteError(`Invalid ${name}: mismatched quotes.`);
  if (started) words.push(word);
  return words;
}

const sourceBuildPreflight = new AsyncLocalStorage<typeof checkSourceBuildPrerequisites>();

/** Scope a prerequisite provider to one operation, including its asynchronous installer calls. */
export function withSourceBuildPreflight<T>(preflight: typeof checkSourceBuildPrerequisites, work: () => T): T {
  return sourceBuildPreflight.run(preflight, work);
}

export function assertSourceBuildPrerequisites(pins: ToolchainPins, platform: NodeJS.Platform = process.platform,
  run: typeof runToolchainProcess = runToolchainProcess, overrides: NodeJS.ProcessEnv = {}): void {
  (sourceBuildPreflight.getStore() ?? checkSourceBuildPrerequisites)(pins, platform, run, overrides);
}

function checkSourceBuildPrerequisites(pins: ToolchainPins, platform: NodeJS.Platform,
  run: typeof runToolchainProcess = runToolchainProcess, overrides: NodeJS.ProcessEnv = {}): void {
  if (!needsSourceBuild(pins)) return;
  const env = telescopePythonEnvironment(overrides);
  const explicit = env.CC !== undefined;
  const selected = explicit ? buildWords(env.CC ?? '', 'CC') : undefined;
  if (selected && !selected[0]) throw new SourceBuildPrerequisiteError('Invalid CC: give a compiler command.');
  const cflags = buildWords(env.CFLAGS ?? '', 'CFLAGS'), cppflags = buildWords(env.CPPFLAGS ?? '', 'CPPFLAGS');
  const ldflags = buildWords(env.LDFLAGS ?? '', 'LDFLAGS');
  const remedy = platform === 'darwin' ? 'Install the Command Line Tools and SDK: xcode-select --install.'
    : 'Install a C compiler and development headers: Debian/Ubuntu: sudo apt install build-essential; Fedora: sudo dnf install gcc.';
  let sdk: string | undefined;
  if (platform === 'darwin') {
    try { sdk = env.SDKROOT ?? run('xcrun', ['--show-sdk-path'], { env }).trim(); if (!sdk) throw new Error('empty SDK path'); }
    catch { throw new SourceBuildPrerequisiteError(`The ${pins.id} source builds need a working macOS SDK (xcrun --show-sdk-path). ${remedy}`); }
  }
  let compilers: string[][];
  if (selected) compilers = [selected];
  else if (platform === 'darwin') {
    try {
      const compiler = run('xcrun', ['--find', 'cc'], { env }).trim();
      if (!compiler) throw new Error('empty compiler path');
      compilers = [[compiler]];
    } catch { throw new SourceBuildPrerequisiteError(`The ${pins.id} source builds need a working C compiler (xcrun --find cc). ${remedy}`); }
  } else compilers = [['cc'], ['gcc'], ['clang']];
  const directory = mkdtempSync(resolve(env.TMPDIR ?? SCRATCH_ROOT, 'telescope-compiler-'));
  try {
    const object = resolve(directory, 'probe.o'), executable = resolve(directory, 'probe');
    const sdkflags = sdk ? ['-isysroot', sdk] : [];
    for (const [compiler, ...args] of compilers) {
      try {
        run(compiler, [...args, ...sdkflags, ...cflags, ...cppflags, '-x', 'c', '-c', '-', '-o', object],
          { env, input: '#include <stdlib.h>\n#include <stdio.h>\nint main(void) { puts("TELESCOPE_COMPILER_READY"); return EXIT_SUCCESS; }\n' });
        run(compiler, [...args, ...sdkflags, ...ldflags, ...cflags, ...cppflags, object, '-o', executable], { env });
        if (run(executable, [], { env }).trim() !== 'TELESCOPE_COMPILER_READY') throw new Error('compiler probe produced no confirmation');
        return;
      } catch { /* Only default selection may try another compiler; CC is authoritative. */ }
      finally { rmSync(object, { force: true }); rmSync(executable, { force: true }); }
    }
    throw new SourceBuildPrerequisiteError(`The ${pins.id} source builds need a working C compiler and C standard-library headers.${explicit ? ` Check CC=${env.CC}.` : ''} ${remedy}`);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
