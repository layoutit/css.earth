import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { requireWorkspace } from '@cssearth/telescope-core/node';
import { preparePackageBuildInputs } from './build-inputs.mts';

test('standalone build creates absent astronomy sources and refreshes stale inputs', { timeout: 120_000 }, async () => {
  const root = requireWorkspace(), fixture = await mkdtemp(resolve(tmpdir(), 'telescope-build-inputs-'));
  try {
    await mkdir(resolve(fixture, 'packages'));
    await symlink(resolve(root, 'node_modules'), resolve(fixture, 'node_modules'), 'dir');
    await cp(resolve(root, '.github'), resolve(fixture, '.github'), { recursive: true });
    await copyFile(resolve(root, 'tsconfig.json'), resolve(fixture, 'tsconfig.json'));
    // Use real source owners and the declared generator without mutating the checkout used by other test workers.
    for (const owner of await readdir(resolve(root, 'packages'))) {
      const source = resolve(root, 'packages', owner), destination = resolve(fixture, 'packages', owner);
      if (owner !== 'astronomy' && owner !== 'telescope-cli') {
        await symlink(source, destination, 'dir');
        continue;
      }
      await cp(source, destination, { recursive: true, filter: path =>
        !['node_modules', 'dist'].includes(basename(path)) && path !== resolve(source, 'src/data/generated') &&
        !(owner === 'telescope-cli' && path === resolve(source, 'data')) });
      await symlink(resolve(source, 'node_modules'), resolve(destination, 'node_modules'), 'dir');
    }
    const generated = resolve(fixture, 'packages/astronomy/src/data/generated');
    await assert.rejects(readFile(resolve(generated, 'bodies.ts')), { code: 'ENOENT' });
    const env = { ...process.env };
    delete env.CSSEARTH_SKIP_DECLARATIONS;
    // Launch from the checkout root, as well as retaining pnpm/prepack's package-directory invocation.
    await promisify(execFile)(process.execPath, ['packages/telescope-cli/build.mts'], { cwd: fixture, env, timeout: 90_000 });
    const bodies = await readFile(resolve(generated, 'bodies.ts'), 'utf8');
    assert.match(bodies, /export const BODY_IDS/u);
    const dist = resolve(fixture, 'packages/telescope-cli/dist');
    for (const file of ['telescope.mjs', 'cli.mjs', 'sphere-lane.js', 'sphere-lane.cjs', 'sphere-lane.d.ts',
      'sphere-lane.d.cts', 'viewer-lane.js', 'viewer-lane.cjs', 'viewer-lane.d.ts', 'viewer-lane.d.cts']) {
      assert.ok((await readFile(resolve(dist, file))).length > 0, `Build must publish ${file}`);
    }
    const help = await promisify(execFile)(process.execPath, [resolve(dist, 'telescope.mjs'), '--help'], { cwd: fixture, env });
    assert.match(help.stdout, /telescope explore/u);
    await writeFile(resolve(generated, 'bodies.ts'), '// stale generated input\n');
    await preparePackageBuildInputs(fixture);
    assert.equal(await readFile(resolve(generated, 'bodies.ts'), 'utf8'), bodies);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
