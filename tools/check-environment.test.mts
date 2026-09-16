import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkEnvironment } from './check-environment.mts';

test('a checkout without installs, package builds or a real scenes directory names each fix', async () => {
  const root = await mkdtemp(join(tmpdir(), 'check-environment-'));
  try {
    await writeFile(join(root, 'package.json'), '{}\n');
    await mkdir(join(root, 'packages/objects'), { recursive: true });
    await mkdir(join(root, 'tools/objects'), { recursive: true }); await mkdir(join(root, 'src/preparation'), { recursive: true });
    await mkdir(join(root, 'elsewhere')); await mkdir(join(root, 'public')); await symlink(join(root, 'elsewhere'), join(root, 'public/scenes'));
    const problems = await checkEnvironment(root);
    for (const expected of [/cwebp binary is missing/u, /sharp does not load/u, /public\/scenes is a symlink/u, /packages\/objects\/dist is missing/u, /tools\/objects\/dist is missing/u])
      assert.ok(problems.some(problem => expected.test(problem)), `${expected}`);
  } finally { await rm(root, { recursive: true, force: true }); }
});
