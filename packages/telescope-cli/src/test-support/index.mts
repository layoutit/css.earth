/** Test workers own isolated user state; archive-memory tests may clear it between cases. */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { after } from 'node:test';
import { telescopeUserRoot } from '../../../telescope-core/src/node/paths/user-root.js';
if (!process.env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME) process.env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME = telescopeUserRoot();
const root = mkdtempSync(resolve(tmpdir(), 'telescope-test-user-'));
// Installers write under the user root. Every worker shares one toolchain home, so an environment missing on a fresh
// machine is installed once under its lock, not once per test process.
for (const name of ['toolchains', 'micromamba']) {
  const shared = resolve(process.env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME, name);
  mkdirSync(shared, { recursive: true });
  symlinkSync(shared, resolve(root, name), 'dir');
}
process.env.CSSEARTH_TELESCOPE_HOME = root;
after(() => rmSync(root, { recursive: true, force: true }));
/** The user root's own files; the shared toolchain links are central by design and change under concurrent installs. */
export async function userRootEntries(): Promise<string[]> {
  return (await readdir(root, { recursive: true })).filter(entry => !/^(toolchains|micromamba)(\/|$)/u.test(entry));
}
