/** The process boundary between the telescope and the workspace entries it runs: the answer crosses IPC, logs go to stderr. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();

const ROOT = resolve(import.meta.dirname, '../../..');
const DISPATCHER = resolve(import.meta.dirname, 'workspace-commands.mts');

/** A throwaway entry and a dispatcher that runs it through `runWorkspaceCommand`, under the checkout so both resolve its packages. */
async function workspace(entry: string) {
  await mkdir(resolve(ROOT, 'output'), { recursive: true });
  const directory = await mkdtemp(resolve(ROOT, 'output/workspace-commands-'));
  await writeFile(resolve(directory, 'entry.mts'), entry);
  await writeFile(resolve(directory, 'dispatch.mts'), `import { runWorkspaceCommand } from ${JSON.stringify(DISPATCHER)};
const command = { script: ${JSON.stringify(resolve(directory, 'entry.mts'))}, source: 'entry.mts' };
try { const result = await runWorkspaceCommand(${JSON.stringify(ROOT)}, command, process.argv.slice(2)); process.stdout.write(JSON.stringify({ result })); }
catch (error) { process.stdout.write(JSON.stringify({ error: { class: error.constructor.name, message: error.message, cause: error.cause?.message } })); }
`);
  const run = (args: readonly string[] = []) => new Promise<{ stdout: string; stderr: string; code: number | null; signal: NodeJS.Signals | null }>((accept, reject) => {
    const child = spawn(process.execPath, [resolve(directory, 'dispatch.mts'), ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; }); child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.once('error', reject); child.once('close', (code, signal) => accept({ stdout, stderr, code, signal }));
  });
  return { directory, run, cleanup: () => rm(directory, { recursive: true, force: true }) };
}

test('the result crosses IPC alone: what the entry and its own subprocesses print is stderr', async () => {
  const fixture = await workspace(`import { spawnSync } from 'node:child_process';
import { answerParent } from '@cssearth/core/node';
await answerParent(async () => {
  spawnSync('sh', ['-c', 'echo BAKE LOG'], { stdio: 'inherit' });
  console.log('JS LOG');
  return { text: '{"baked":["fixture"]}\\n', code: 0 };
});
`);
  try {
    const { stdout, stderr, code } = await fixture.run();
    assert.equal(code, 0, stderr);
    assert.deepEqual(JSON.parse(stdout), { result: { text: '{"baked":["fixture"]}\n', code: 0 } });
    assert.match(stderr, /BAKE LOG/u); assert.match(stderr, /JS LOG/u);
  } finally { await fixture.cleanup(); }
});
