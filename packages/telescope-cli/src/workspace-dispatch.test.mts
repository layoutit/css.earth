import './test-user-root.mts';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { parseCli } from './cli-arguments.mts';
import { NEW_OBJECT_COMMAND } from './workspace-commands/new-object.mts';

const checkout = resolve(import.meta.dirname, '../../..');
const bin = resolve(import.meta.dirname, 'bin.mts');
const cli = resolve(import.meta.dirname, 'cli.mts');

test('workspace admission runs the selected checkout source with unchanged arguments', async () => {
  await mkdir(resolve(checkout, 'output'), { recursive: true });
  const directory = await mkdtemp(resolve(checkout, 'output/workspace-dispatch-'));
  const root = resolve(directory, 'checkout');
  const source = resolve(root, 'packages/telescope-cli/src/cli.mts');
  const args = ['new-object', 'relative spec.json', '--check', '--skip-existing', '--json'];
  const env = { ...process.env };
  delete env.CSSEARTH_WORKSPACE;
  try {
    await mkdir(resolve(source, '..'), { recursive: true });
    await mkdir(resolve(root, 'src/objects'), { recursive: true });
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ scripts: { telescope: 'node packages/telescope-cli/src/cli.mts' } }));
    await writeFile(source, `console.log(JSON.stringify({ args: process.argv.slice(2), workspace: process.env.CSSEARTH_WORKSPACE, source: import.meta.filename }));`);
    const sourceBin = resolve(source, '../bin.mts');
    await writeFile(sourceBin, `import ${JSON.stringify(bin)};`);
    for (const [entry, input, cwd, environment] of [
      [bin, ['--workspace', root, ...args], directory, env],
      [bin, args, directory, { ...env, CSSEARTH_WORKSPACE: root }],
      [sourceBin, args, root, env],
    ] as const) {
      const result = spawnSync(process.execPath, [entry, ...input], { cwd, env: environment, encoding: 'utf8', timeout: 30_000 });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { args, workspace: root, source });
    }

    // The CLI's process boundary also sends the complete parsed options to B's own generator.
    const generator = resolve(root, NEW_OBJECT_COMMAND.script);
    await mkdir(resolve(generator, '..'), { recursive: true });
    await writeFile(generator, `import { answerParent } from '@cssearth/core/node';
await answerParent(async () => ({ text: JSON.stringify({ options: JSON.parse(process.argv[2]), cwd: process.cwd(), workspace: process.env.CSSEARTH_WORKSPACE, source: import.meta.filename }) + '\\n', code: 0 }));`);
    const runner = resolve(directory, 'dispatch.mts');
    await writeFile(runner, `import { main } from ${JSON.stringify(cli)};
process.exitCode = await main(process.argv.slice(2));`);
    const dispatched = spawnSync(process.execPath, [runner, ...args, '--workspace', root], { cwd: directory, env, encoding: 'utf8', timeout: 30_000 });
    assert.equal(dispatched.status, 0, dispatched.stderr);
    assert.deepEqual(JSON.parse(dispatched.stdout), { options: parseCli(args.map(arg => arg === 'relative spec.json' ? resolve(directory, arg) : arg)), cwd: root, workspace: root, source: generator });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
