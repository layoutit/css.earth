import './test-support/index.mts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { configureWorkspace, requireWorkspace, withAcquisitionDirectory } from '@cssearth/telescope-core/node';
import { CLI_PACKAGE_ROOT, inputPath, packagePath, programStorePath, workspacePath } from './paths.mts';
import { parseSpitzerProgram, programPath, writeSpitzerProgram } from './archives/spitzer/archive.mts';

const checkout = requireWorkspace();
const identity = 'packages/telescope-cli/src/archives/spitzer/programs/ngc3132-4416768.json';

for (const separate of [false, true]) test(`program paths stay in the run through an aliased ${separate ? 'distinct' : 'package'} checkout`, async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'program-alias-')), alias = resolve(root, 'alias'), run = resolve(root, 'run');
  const physical = separate ? resolve(root, 'workspace') : checkout;
  try {
    if (separate) {
      await mkdir(resolve(physical, 'packages/telescope-cli/src'), { recursive: true });
      await mkdir(resolve(physical, 'src/objects'), { recursive: true });
      await writeFile(resolve(physical, 'package.json'), JSON.stringify({ scripts: { telescope: 'fixture' } }));
      await writeFile(resolve(physical, 'packages/telescope-cli/src/cli.mts'), '');
    }
    await symlink(physical, alias);
    configureWorkspace(['--workspace', alias]);
    assert.notEqual(resolve(alias, 'packages/telescope-cli'), CLI_PACKAGE_ROOT);
    const program = parseSpitzerProgram(JSON.parse(await readFile(packagePath(identity), 'utf8')));
    const destination = resolve(run, 'programs/spitzer', `${program.id}.json`);
    const before = await readdir(resolve(physical, 'packages/telescope-cli'), { recursive: true });
    await withAcquisitionDirectory(run, async () => {
      for (const path of [identity, packagePath(identity), resolve(alias, identity), resolve(physical, identity)])
        assert.equal(programStorePath(path, 'write'), destination, path);
      // A read may use the shipped program before the run has one. The writer must create its final parent.
      assert.notEqual(programPath(program.id), destination);
      await writeSpitzerProgram(program);
      assert.deepEqual(JSON.parse(await readFile(destination, 'utf8')), program);
      assert.equal(programPath(program.id), destination);
      assert.equal(inputPath(alias, packagePath(identity)), destination);
      assert.equal(workspacePath(resolve(alias, identity)), destination);
      assert.equal(programStorePath(destination, 'write'), destination);
      assert.throws(() => programStorePath(resolve(root, 'foreign.json'), 'write'), /archive programs folder/u);
    });
    assert.deepEqual(await readdir(resolve(physical, 'packages/telescope-cli'), { recursive: true }), before);
  } finally { configureWorkspace(['--workspace', checkout]); await rm(root, { recursive: true, force: true }); }
});
