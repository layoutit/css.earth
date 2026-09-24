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

test('bundled navigation reads object packages and prepared context from the repository root', async t => {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), 'navigation-prerender-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(resolve(root, 'pnpm-workspace.yaml'), 'packages: []\n');
  for (const id of ['sun', 'earth']) {
    const directory = resolve(root, 'src/objects', id);
    await mkdir(resolve(directory, 'prepared'), { recursive: true });
    await writeFile(resolve(directory, 'README.md'), `# ${id}\n`);
    await writeFile(resolve(directory, 'object.json'), JSON.stringify({ id }));
  }
  await writeFile(resolve(root, 'src/objects/sun/prepared/world-context.json'), JSON.stringify({
    focus: { id: 'sun', color: '#fff' },
    bodies: [{ id: 'earth', color: '#00f', orbit: { centerBodyId: 'sun' } }],
  }));
  const outfile = resolve(root, 'dist/.prerender/chunks/navigation.mjs');
  await build({
    stdin: {
      contents: `import { REPOSITORY, readObjects, objectColors } from './navigation-tree.mts';
        console.log(JSON.stringify({ repository: REPOSITORY,
          ids: readObjects().map(object => object.id).sort(), colors: [...objectColors()] }));`,
      resolveDir: resolve(import.meta.dirname, '../navigation'), sourcefile: 'navigation-fixture.mts', loader: 'ts',
    },
    // This relocation fixture exercises package/context reads, not application route preparation.
    plugins: [{ name: 'isolate-navigation-inputs', setup(build) {
      build.onLoad({ filter: /[\/]navigation-destination\.mts$/ }, () => ({
        contents: 'export function appNavigationDestination() { throw new Error("Routes are outside this fixture"); }',
        loader: 'ts',
      }));
    } }],
    outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22',
  });
  // A workspace-filtered command can run from another directory. Neither cwd nor the bundle depth is the root.
  const { stdout } = await execFileAsync(process.execPath, [outfile], { cwd: tmpdir() });
  assert.deepEqual(JSON.parse(stdout), {
    repository: root, ids: ['earth', 'sun'], colors: [['earth', '#00f'], ['sun', '#fff']],
  });
});
