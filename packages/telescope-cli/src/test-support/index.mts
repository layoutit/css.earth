/** Test workers own isolated user state; archive-memory tests may clear it between cases. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { after } from 'node:test';
import { telescopeUserRoot } from '../../../telescope-core/src/node/paths/user-root.js';
if (!process.env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME) process.env.CSSEARTH_TELESCOPE_TOOLCHAIN_HOME = telescopeUserRoot();
const root = mkdtempSync(resolve(tmpdir(), 'telescope-test-user-'));
process.env.CSSEARTH_TELESCOPE_HOME = root;
after(() => rmSync(root, { recursive: true, force: true }));
