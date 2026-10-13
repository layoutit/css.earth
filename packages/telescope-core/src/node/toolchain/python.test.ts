import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it as test } from 'node:test';
import { processRssBytes, toolchainPython } from './python.js';

const python = (() => { try { execFileSync('python3', ['--version']); return 'python3'; } catch { return null; } })();

test('inline Python returns its last stdout line and keeps the whole log', { skip: !python }, async () => {
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

test('ps samples require successful status and one positive integral RSS value', () => {
  assert.equal(processRssBytes({ status: 0, stdout: ' 123\n' }), 123 * 1024);
  for (const result of [{status: 1, stdout: '123'}, {status: null, stdout: '123'}, {status: 0, stdout: null}, {status: 0, stdout: ''}, {status: 0, stdout: ' '}, {status: 0, stdout: '0'}, {status: 0, stdout: '-1'}, {status: 0, stdout: '1.5'}, {status: 0, stdout: '12\n34'}, {status: 0, stdout: '123', error: new Error('ps failed')}])
    assert.equal(processRssBytes(result), undefined);
});
