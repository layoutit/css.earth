import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { expandScriptChain } from './run-script-chain.mts';

test('aliases expand in place, depth first, and only plain node steps remain', () => {
  const scripts = { a: 'node one.mts && pnpm b && node four.mts', b: 'pnpm -s c && node three.mts', c: 'node two.mts --flag x' };
  assert.deepEqual(expandScriptChain(scripts, 'a'), [
    { script: 'a', command: 'node one.mts' }, { script: 'c', command: 'node two.mts --flag x' },
    { script: 'b', command: 'node three.mts' }, { script: 'a', command: 'node four.mts' }]);
  assert.throws(() => expandScriptChain({ a: 'pnpm b', b: 'pnpm a' }, 'a'), /loops: a -> b -> a/);
  assert.throws(() => expandScriptChain(scripts, 'missing'), /Unknown script/);
});

test('the dev and build chains expand to direct steps: no alias is left for pnpm to resolve', async () => {
  const scripts = (JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> }).scripts;
  for (const name of ['dev:prepare', 'build:prepare']) {
    const steps = expandScriptChain(scripts, name);
    assert.ok(steps.length > 10, name);
    // A workspace package build (`pnpm -r`, `pnpm --filter`) is a real command, not an alias of this package.json.
    for (const step of steps) assert.match(step.command, /^(node |pnpm (-r|--filter) )/u, `${name}: ${step.command}`);
  }
  for (const step of expandScriptChain(scripts, 'dev:prepare')) assert.match(step.command, /^node /u, `a warm dev start spawns no pnpm: ${step.command}`);
  assert.equal(scripts.predev, 'node tools/cli/run-script-chain.mts dev:prepare');
  assert.equal(scripts.prebuild, 'node tools/cli/run-script-chain.mts build:prepare');
});
