import './test-user-root.mts';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { configureWorkspace, WORKSPACE } from '@cssearth/telescope-core/node';
import { packagePath, programStorePath } from './paths.mts';
import { readProgram as readJuno, writeProgram as writeJuno, parseProgram as parseJuno } from './archives/juno/archive.mts';
import { measureProgram } from './archives/juno/measure.mts';
import { readProgram as readNaco, writeProgram as writeNaco } from './archives/naco/archive.mts';
import { compareTemplates } from './archives/naco/compare.mts';
import { parseImagingProgram, writeImagingProgram } from './archives/jwst/imaging/archive.mts';
import { readImagingProgram } from './archives/jwst/imaging/image3.mts';
import { archivePrograms, type ProgramArchive } from './archives/programs.mts';

const archives: readonly ProgramArchive[] = ['pds', 'keck', 'gemini', 'naco', 'chandra', 'spitzer', 'juno', 'hst', 'jwst', 'ihw', 'espadons'];

test('package A authors and consumes new and updated programs exclusively in workspace B', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'workspace-authoring-')), previous = WORKSPACE;
  const id = `workspace-probe-${process.pid}`;
  const previousEntry = process.argv[1], previousEnvironment = process.env.CSSEARTH_WORKSPACE;
  // Explicit package reads supply fixture inputs before selecting an empty workspace.
  const junoSeed = parseJuno(JSON.parse(await readFile(packagePath('src/archives/juno/programs/europa-pj45.json'), 'utf8')));
  const nacoSeed = await readNaco('ceres-080C0881');
  const jwstSeed = parseImagingProgram(JSON.parse(await readFile(packagePath('src/archives/jwst/programs/europa-1250.json'), 'utf8')));
  try {
    await mkdir(resolve(root, 'packages/telescope-cli/src'), { recursive: true });
    await mkdir(resolve(root, 'src/objects'), { recursive: true });
    await writeFile(resolve(root, 'packages/telescope-cli/src/cli.mts'), '');
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ scripts: { telescope: 'node source' } }));
    configureWorkspace(['--workspace', root]);
    for (const archive of archives) {
      const identity = archivePrograms(archive).path;
      assert.equal(programStorePath(identity), resolve(root, identity));
      assert.equal(programStorePath(identity, 'write'), programStorePath(identity));
    }
    // A selected empty workspace must not silently consume A's shipped copy.
    await assert.rejects(readJuno('europa-pj45'), { code: 'ENOENT' });
    for (const [identifier, revision] of [[id, 'new'], [id, 'updated'], ['europa-pj45', 'workspace-existing']] as const) {
      const juno = { ...junoSeed, id: identifier, kernelSet: `workspace-${revision}` };
      await writeJuno(juno);
      assert.deepEqual(await readJuno(identifier), juno);
      // Measurement reaches B's kernel selection, then stops at an intentionally absent bank.
      await assert.rejects(measureProgram(identifier, resolve(root, 'work')), error =>
        error instanceof Error && error.message.includes(`workspace-${revision}`));
    }
    for (const [identifier, revision] of [[id, 'new'], [id, 'updated'], ['ceres-080C0881', 'workspace-existing']] as const) {
      const naco = { ...nacoSeed, program: identifier, objectTemplates: [`workspace-${revision}`] };
      await writeNaco(naco);
      assert.deepEqual(await readNaco(identifier), naco);
      await assert.rejects(compareTemplates(identifier, root, ['absent', 'other']),
        new RegExp(`sequence of ${identifier}: workspace-${revision}`, 'u'));
    }
    for (const [identifier, revision] of [[id, 'new'], [id, 'updated'], ['europa-1250', 'workspace-existing']] as const) {
      const jwst = { ...jwstSeed, id: identifier, crdsContext: `workspace-${revision}.pmap` };
      const path = await writeImagingProgram(jwst), read = await readImagingProgram(identifier);
      assert.equal(read.path, resolve(root, `packages/telescope-cli/src/archives/jwst/programs/${identifier}.json`));
      assert.equal(read.path, path);
      assert.deepEqual(read.program, jwst);
    }
    for (const archive of ['juno', 'naco', 'jwst']) assert.equal(existsSync(packagePath(`src/archives/${archive}/programs/${id}.json`)), false);
    process.argv[1] = resolve(root, 'installed-entry.mjs');
    delete process.env.CSSEARTH_WORKSPACE;
    configureWorkspace([]);
    assert.equal(WORKSPACE, undefined);
    assert.deepEqual(await readJuno('europa-pj45'), junoSeed);
    await assert.rejects(writeJuno({ ...junoSeed, id }), /workspace/u);
    await assert.rejects(writeNaco({ ...nacoSeed, program: id }), /workspace/u);
    await assert.rejects(writeImagingProgram({ ...jwstSeed, id }), /workspace/u);
    for (const archive of archives) {
      const identity = archivePrograms(archive).path;
      assert.equal(programStorePath(identity), packagePath(identity));
      assert.throws(() => programStorePath(identity, 'write'), /workspace/u);
    }
  } finally {
    process.argv[1] = previousEntry;
    if (previousEnvironment === undefined) delete process.env.CSSEARTH_WORKSPACE;
    else process.env.CSSEARTH_WORKSPACE = previousEnvironment;
    configureWorkspace(previous ? ['--workspace', previous] : []);
    for (const archive of ['juno', 'naco', 'jwst']) await rm(packagePath(`src/archives/${archive}/programs/${id}.json`), { force: true });
    await rm(root, { recursive: true, force: true });
  }
});
