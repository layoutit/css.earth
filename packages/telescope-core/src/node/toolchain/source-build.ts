/** Source releases in the pinned locks need native headers as well as a compiler executable. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
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

export function assertSourceBuildPrerequisites(pins: ToolchainPins, platform: NodeJS.Platform = process.platform,
  run: typeof runToolchainProcess = runToolchainProcess): void {
  if (!needsSourceBuild(pins)) return;
  const remedy = platform === 'darwin' ? 'Install the Command Line Tools and SDK: xcode-select --install.'
    : 'Install a C compiler and development headers: Debian/Ubuntu: sudo apt install build-essential; Fedora: sudo dnf install gcc.';
  let sdk: string | undefined;
  if (platform === 'darwin') {
    try { sdk = run('xcrun', ['--show-sdk-path']).trim(); if (!sdk) throw new Error('empty SDK path'); }
    catch { throw new SourceBuildPrerequisiteError(`The ${pins.id} source builds need a working macOS SDK (xcrun --show-sdk-path). ${remedy}`); }
  }
  const directory = mkdtempSync(resolve(tmpdir(), 'telescope-compiler-'));
  try {
    for (const compiler of platform === 'darwin' ? ['cc'] : ['cc', 'gcc']) {
      try {
        run(compiler, [...sdk ? ['-isysroot', sdk] : [], '-x', 'c', '-', '-o', resolve(directory, 'probe')],
          { input: '#include <stdlib.h>\n#include <stdio.h>\nint main(void) { puts("TELESCOPE_COMPILER_READY"); return EXIT_SUCCESS; }\n' });
        if (run(resolve(directory, 'probe'), []).trim() !== 'TELESCOPE_COMPILER_READY') throw new Error('compiler probe produced no confirmation');
        return;
      } catch { /* Try the other Linux compiler before reporting one prerequisite failure. */ }
    }
    throw new SourceBuildPrerequisiteError(`The ${pins.id} source builds need a working C compiler and C standard-library headers. ${remedy}`);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
