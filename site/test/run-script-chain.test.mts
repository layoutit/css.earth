import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { expandScriptChain } from '../build/run-script-chain.mts';

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
  assert.equal(scripts.predev, 'node site/build/run-script-chain.mts dev:prepare');
  assert.equal(scripts.prebuild, 'node site/build/run-script-chain.mts build:prepare');
});

test('site chains restore prepared assets before discovery reads them, and a deploy keeps the published world', async () => {
  const scripts = (JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> }).scripts;
  for (const name of ['dev:prepare', 'build:prepare', 'build:deploy']) {
    const commands = expandScriptChain(scripts, name).map(step => step.command);
    // Discovery reads each body's prepared/controls.json, which only the R2 restore provides on a clean checkout.
    const restore = commands.indexOf('node packages/bake/cli/setup-assets.mts');
    const catalogue = commands.indexOf('node site/build/prepare/prepare-catalog.mts');
    assert.ok(restore >= 0 && restore < catalogue, `${name}: first restore at step ${restore}, catalogue at step ${catalogue}`);
  }
  // The deploy bundles the published world context, so it restores once and never regenerates the world. A copy made on
  // the runner differs from the published bytes, and restoring over it re-hashed every restored file.
  const deploy = expandScriptChain(scripts, 'build:deploy').map(step => step.command);
  assert.equal(deploy.findIndex(command => command.includes('prepare-spatial-context')), -1, 'build:deploy regenerates the world context');
  assert.equal(deploy.filter(command => command === 'node packages/bake/cli/setup-assets.mts').length, 1, 'build:deploy restores once');
});
