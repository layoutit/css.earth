import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { build } from 'esbuild';

const execFileAsync = promisify(execFile);

test('bundled navigation reads object packages from the repository root', async t => {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), 'navigation-prerender-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(resolve(root, 'pnpm-workspace.yaml'), 'packages: []\n');
  for (const id of ['sun', 'earth']) {
    const directory = resolve(root, 'src/objects', id);
    await mkdir(resolve(directory, 'prepared'), { recursive: true });
    await writeFile(resolve(directory, 'README.md'), `# ${id}\n`);
    await writeFile(resolve(directory, 'object.json'), JSON.stringify({ id }));
  }
  const outfile = resolve(root, 'dist/.prerender/chunks/navigation.mjs');
  await build({
    stdin: {
      contents: `import { readNavigationPackages } from './navigation-packages.mts';
        console.log(JSON.stringify(readNavigationPackages().map(object => object.id).sort()));`,
      resolveDir: resolve(import.meta.dirname, '../navigation'), sourcefile: 'navigation-fixture.mts', loader: 'ts',
    },
    outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22',
  });
  // A workspace-filtered command can run from another directory. Neither cwd nor the bundle depth is the root.
  const { stdout } = await execFileAsync(process.execPath, [outfile], { cwd: tmpdir() });
  assert.deepEqual(JSON.parse(stdout), ['earth', 'sun']);
});
