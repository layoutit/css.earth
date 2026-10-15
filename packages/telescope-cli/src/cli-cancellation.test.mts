import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('piped and JSON installs terminate and await the child group on parent SIGINT without progress', async () => {
  for (const mode of ['pipe', 'json']) {
    const root = await mkdtemp(resolve(tmpdir(), 'install-cancellation-'));
    const child = spawn(process.execPath, [fileURLToPath(new URL('./tui/fixtures/install-cancellation.mts', import.meta.url)), root, mode], {
      stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, CSSEARTH_TELESCOPE_STDIN_TTY: '0', CSSEARTH_TELESCOPE_STDOUT_TTY: '0', CSSEARTH_TELESCOPE_STDERR_TTY: '0' },
    });
    let stdout = '', stderr = '', interrupted = false;
    const timeout = setTimeout(() => child.kill('SIGKILL'), 60000);
    child.stdout.setEncoding('utf8').on('data', text => { stdout += text; });
    child.stderr.setEncoding('utf8').on('data', text => {
      stderr += text;
      if (!interrupted && stderr.includes('ready')) { interrupted = true; child.kill('SIGINT'); }
    });
    try {
      const code = await new Promise<number | null>((accept, reject) => {
        child.once('error', reject); child.once('close', accept);
      });
      assert.equal(interrupted, true, stderr); assert.equal(code, 130, stderr); assert.equal(stdout, '');
      assert.doesNotMatch(stderr, /\x1b/u);
      for (const name of ['installer', 'helper']) assert.equal(await readFile(resolve(root, `${name}-stopped`), 'utf8'), 'stopped');
    } finally { clearTimeout(timeout); child.kill('SIGKILL'); await rm(root, { recursive: true, force: true }); }
  }
});
