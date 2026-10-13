/** Exercise real installer entry points with an executable override that stops at the conda boundary. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

const installerScript = (preflight?: 'passing' | 'failing') => `
const core = await import('@cssearth/telescope-core/node');
const outcomes = [];
${preflight ? `await core.withSourceBuildPreflight(() => {
  ${preflight === 'failing' ? "throw new core.SourceBuildPrerequisiteError('fixture compiler unavailable');" : ''}
}, async () => {` : ''}
for (const name of ['installAstroquery', 'installPdsToolchain', 'installStarry', 'installSpiderman', 'installPicaso']) {
  try { await core[name](); outcomes.push({ name, message: 'unexpected success' }); }
  catch (error) { outcomes.push({ name, message: error.message }); }
}
for (const [archive, name, args] of [
  ['hst', 'installHst', []], ['keck', 'installKeck', []], ['spitzer', 'installSpitzer', []],
  ['jwst', 'installToolchain', ['eureka']], ['jwst', 'installToolchain', ['klip']],
  ['chandra', 'installChandra', []], ${preflight !== 'failing' ? "['chandra', 'solveChandra', []]," : ''} ['gemini', 'installGemini', []],
  ['tess', 'installToolchain', []], ['mearth', 'installToolchain', []], ['espadons', 'installToolchain', []],
  ['interferometry', 'installToolchain', ['casa']]
]) {
  const mod = await import(new URL('../archives/'+archive+'/toolchain.mts', ${JSON.stringify(pathToFileURL(resolve('packages/telescope-cli/src/toolchains/')).href + '/')}));
  try { await mod[name](...args); outcomes.push({ name: archive, message: 'unexpected success' }); }
  catch (error) { outcomes.push({ name: archive, message: error.message }); }
}
${preflight ? '});' : ''}
process.stdout.write(JSON.stringify(outcomes));
`;

test('all Python installers reach the shared executable before invoking any system Python', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'telescope-installers-')), command = resolve(root, 'chosen-micromamba'), log = resolve(root, 'commands.jsonl');
  try {
    await writeFile(command, `#!${process.execPath}
const fs = require('node:fs');
fs.appendFileSync(process.env.TELESCOPE_TEST_PROCESS_LOG, JSON.stringify(process.argv.slice(2))+'\\n');
process.stderr.write('reached selected micromamba\\n'); process.exit(19);
`);
    await chmod(command, 0o755);
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', installerScript('passing')], { cwd: resolve('.'), encoding: 'utf8',
      env: { ...process.env, PATH: root, CSSEARTH_TELESCOPE_HOME: resolve(root, 'user'),
        CSSEARTH_TELESCOPE_MICROMAMBA: command, TELESCOPE_TEST_PROCESS_LOG: log, CSSEARTH_WORKSPACE: undefined },
      timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr);
    const outcomes = requireArray(JSON.parse(result.stdout));
    assert.equal(outcomes.length, 17);
    for (const raw of outcomes) {
      const row = requireRecord(raw);
      assert.match(requireString(row.message), /reached selected micromamba/u, requireString(row.name));
    }
    const calls = (await readFile(log, 'utf8')).trim().split('\n').map(line => requireArray(JSON.parse(line)).map(value => requireString(value)));
    assert.equal(calls.length, 17);
    assert.ok(calls.every(args => args[0] === 'create'));
    for (const version of ['python=3.12', 'python=3.13', 'python=3.9', 'python=3.11.16', 'python=3.14']) assert.ok(calls.some(args => args.includes(version)), version);
    assert.ok(calls.some(args => args.includes('--dry-run')), 'the Chandra solver uses the same executable');
    assert.ok(calls.some(args => args.includes('--platform') && args.includes('osx-64')), 'Gemini retains its target platform');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a failing source-build preflight prevents every Python installer from reaching micromamba', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'telescope-preflight-')), command = resolve(root, 'chosen-micromamba'), log = resolve(root, 'commands.jsonl');
  try {
    await writeFile(command, `#!${process.execPath}
require('node:fs').appendFileSync(process.env.TELESCOPE_TEST_PROCESS_LOG, 'unexpected micromamba call\\n');
process.exit(19);
`, { mode: 0o755 });
    // The dry-run solver is not an installer and has no source-build gate.
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', installerScript('failing')], {
      cwd: resolve('.'), encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, PATH: root, CSSEARTH_TELESCOPE_HOME: resolve(root, 'user'),
        CSSEARTH_TELESCOPE_MICROMAMBA: command, TELESCOPE_TEST_PROCESS_LOG: log, CSSEARTH_WORKSPACE: undefined },
    });
    assert.equal(result.status, 0, result.stderr);
    const outcomes = requireArray(JSON.parse(result.stdout));
    assert.equal(outcomes.length, 16);
    for (const raw of outcomes) {
      const row = requireRecord(raw);
      assert.equal(requireString(row.message), 'Managed source-build prerequisite: fixture compiler unavailable', requireString(row.name));
    }
    assert.ok(!(await readdir(root)).includes('commands.jsonl'), 'no installer invokes micromamba after a failed preflight');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('every installer refuses Windows before writes or downloads; help, version and families still work', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'telescope-windows-'));
  try {
    const script = `
// Load this host's native dependencies before simulating the Windows command policy.
const { main } = await import(${JSON.stringify(pathToFileURL(resolve('packages/telescope-cli/src/cli.mts')).href)});
Object.defineProperty(process, 'platform', { value: 'win32' });
globalThis.fetch = () => { throw new Error('Windows must never download'); };
${installerScript().replace('process.stdout.write(JSON.stringify(outcomes));', '')}
for (const [archive, name, args] of [['naco', 'installNacoToolchain', []], ['interferometry', 'installToolchain', ['rotir']]]) {
  const mod = await import(new URL('../archives/'+archive+'/toolchain.mts', ${JSON.stringify(pathToFileURL(resolve('packages/telescope-cli/src/toolchains/')).href + '/')}));
  try { await mod[name](...args); outcomes.push({ name: archive, message: 'unexpected success' }); }
  catch (error) { outcomes.push({ name: archive, message: error.message }); }
}
const commands = [];
for (const args of [['--help'], ['--version'], ['families', '--json']]) {
  let text = ''; const code = await main(args, undefined, output => { text += output; });
  commands.push({ code, text });
}
process.stdout.write(JSON.stringify({ outcomes, commands }));
`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8',
      env: { ...process.env, CSSEARTH_TELESCOPE_HOME: root, PATH: '', CSSEARTH_TELESCOPE_MICROMAMBA: '/missing/override',
        CSSEARTH_WORKSPACE: undefined }, timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr);
    const answer = requireRecord(JSON.parse(result.stdout)), outcomes = requireArray(answer.outcomes);
    assert.equal(outcomes.length, 19);
    for (const raw of outcomes) {
      const row = requireRecord(raw);
      assert.equal(row.message, 'managed Python toolchains need macOS or Linux; on Windows use WSL', requireString(row.name));
    }
    const commands = requireArray(answer.commands); assert.equal(commands.length, 3);
    for (const raw of commands) {
      const row = requireRecord(raw); assert.ok(row.code === 0 || row.code === 3); assert.ok(requireString(row.text).length > 0);
    }
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
