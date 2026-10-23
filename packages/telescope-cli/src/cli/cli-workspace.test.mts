import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { requireWorkspace } from '@cssearth/telescope-core/node';

test('CLI admission precedes dependencies that capture roots, including relative workspace flags', () => {
  const checkout = requireWorkspace(), directory = realpathSync(mkdtempSync(resolve(tmpdir(), 'telescope-cli-entry-')));
  const url = (path: string) => JSON.stringify(pathToFileURL(resolve(checkout, path)).href);
  try {
    for (const selected of [false, true]) {
      const args = selected ? ['--workspace', relative(directory, checkout)] : [];
      const script = `
        import assert from 'node:assert/strict';
        process.argv = [process.execPath, ${JSON.stringify(resolve(checkout, 'packages/telescope-cli/src/bin.mts'))}, ...${JSON.stringify(args)}];
        await import(${url('packages/telescope-cli/src/cli.mts')});
        const core = await import(${url('packages/telescope-core/dist/node/index.js')});
        const ledger = await import(${url('packages/telescope-cli/src/archives/ledger.mts')});
        assert.equal(core.WORKSPACE, ${selected ? JSON.stringify(checkout) : 'undefined'});
        assert.equal(ledger.REPOSITORY, ${selected ? JSON.stringify(checkout) : 'core.USER_ROOT'});
        console.log('CLI_WORKSPACE_READY');
      `;
      const env: NodeJS.ProcessEnv = { ...process.env, CSSEARTH_TELESCOPE_HOME: resolve(directory, 'user') };
      delete env.CSSEARTH_WORKSPACE;
      const child = spawnSync(process.execPath, ['--import', resolve(checkout, 'packages/core/src/node/register-vite-suffix.mts'), '--input-type=module', '-e', script],
        { cwd: directory, env, encoding: 'utf8', timeout: 30_000 });
      assert.equal(child.status, 0, child.stderr);
      assert.match(child.stdout, /CLI_WORKSPACE_READY/u);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
