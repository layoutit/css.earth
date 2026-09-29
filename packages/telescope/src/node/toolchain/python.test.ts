import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it as test } from 'vitest';
import { toolchainPython } from './toolchain-python.js';

const python = (() => { try { execFileSync('python3', ['--version']); return 'python3'; } catch { return null; } })();

test.skipIf(!python)('inline Python returns its last stdout line and keeps the whole log', async () => {
  const work = await mkdtemp(join(tmpdir(), 'toolchain-python-'));
  try {
    const log = join(work, 'run.log'), toolchain = { python: python!, env: { CSSEARTH_PROBE: 'pinned' } };
    const found = await toolchainPython(toolchain, work, 'import os,sys\nprint("first")\nprint("warn", file=sys.stderr)\nprint(os.environ["CSSEARTH_PROBE"], sys.argv[1])', ['arg'], log);
    assert.equal(found.lastLine, 'pinned arg');
    const written = await readFile(log, 'utf8');
    assert.match(written, /^first$/mu); assert.match(written, /^warn$/mu);
    await assert.rejects(toolchainPython(toolchain, work, 'raise SystemExit(3)', ['stage'], log), /Python stage failed; see /u);
  } finally { await rm(work, { recursive: true, force: true }); }
});
