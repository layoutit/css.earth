import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { bodyMapAveragingFindings, cliLibraryFindings, checkAuthoringPolicies } from './authoring-policy.mts';
import { REPOSITORY_RULES } from './repository-rules.mts';

const cli = 'packages/bake/cli/new-command.mts';
test('new CLI implementations fail; main, default, local orchestration and existing paths pass', () => {
  for (const text of ['export function reduce() {}', 'export const reduce = () => 1;', 'export const reduce = function() {};', 'export class Reducer {}', 'export { reduce };', 'export const K = class {};', 'export const k = { h() {} };', 'const h = () => 1; export const k = h;']) {
    assert.equal(cliLibraryFindings(cli, text, {}).length, 1);
    const name = cliLibraryFindings(cli, text, {})[0]!.match(/implementation (\S+)/u)![1]!;
    assert.deepEqual(cliLibraryFindings(cli, text, { [cli]: [name] }), []);
    assert.equal(cliLibraryFindings(cli, text + '\nexport function added() {}', { [cli]: [name] }).length, 1);
  }
  for (const text of ['export function main() {}', 'export default function reduce() {}', 'function reduce() {}', 'export type Options = {};'])
    assert.deepEqual(cliLibraryFindings(cli, text, {}), []);
  assert.deepEqual(cliLibraryFindings('packages/bake/src/reduce.ts', 'export function reduce() {}', {}), []);
});

test('both authoring owners and telescope sources reject direct, renamed and namespace averaging', () => {
  for (const path of ['packages/bake/authoring/body/author.mts', 'packages/telescope-cli/authoring/body/author.mts', 'packages/telescope-cli/src/maps.mts']) {
    for (const text of ['combineBodyMaps(maps, 30);', "import { combineBodyMaps as average } from '@cssearth/bake/objects/layers/observation'; average(maps, 30);", 'maps.combineBodyMaps(values, 30);', "m['combineBodyMaps']();", 'const { combineBodyMaps: f } = m; f();', 'const f = combineBodyMaps; f();', 'combineBodyMaps.call(null, values);', 'm.combineBodyMaps.apply(null, values);'])
      assert.equal(bodyMapAveragingFindings(path, text).length, 1);
    assert.deepEqual(bodyMapAveragingFindings(path, 'combineUnderPolicy(inputs, policy, 30); // combineBodyMaps(maps)\nconst example = "combineBodyMaps(maps)";'), []);
  }
  assert.deepEqual(bodyMapAveragingFindings('packages/telescope-cli/authoring/hst/slit-scan-map.mts', 'combineBodyMaps(maps, 30);'), []);
  assert.equal(bodyMapAveragingFindings('packages/telescope-cli/authoring/other/slit-scan-map.mts', 'combineBodyMaps(maps, 30);').length, 1);
  assert.deepEqual(bodyMapAveragingFindings('packages/bake/authoring/body/author.test.mts', 'combineBodyMaps(maps, 30);'), []);
});

test('the mandatory repository gate installs the authoring checks', () => {
  assert.equal(REPOSITORY_RULES.find(rule => rule.id === 'authoring-policies')?.check, checkAuthoringPolicies);
});

test('committed allowance works with no git repository or refs; mutations fail', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'authoring-no-refs-'));
  try {
    mkdirSync(resolve(root, '.github/scripts/architecture'), { recursive: true });
    mkdirSync(resolve(root, 'packages/bake/cli'), { recursive: true });
    writeFileSync(resolve(root, '.github/scripts/architecture/cli-exports-baseline.json'), JSON.stringify({ ceiling: 1, entries: { [cli]: { reason: 'Fixture retained export.', exports: ['old'] } } }));
    writeFileSync(resolve(root, cli), 'export function old() {}');
    assert.deepEqual(checkAuthoringPolicies(root, [cli]), []);
    writeFileSync(resolve(root, cli), 'export function old() {} export const added = class {};');
    assert.equal(checkAuthoringPolicies(root, [cli]).length, 1);
    const budget = { ceiling: 1, entries: { [cli]: { reason: 'Fixture retained exports.', exports: ['old', 'added'] } } };
    writeFileSync(resolve(root, '.github/scripts/architecture/cli-exports-baseline.json'), JSON.stringify(budget));
    assert.match(checkAuthoringPolicies(root, [cli]).join('\n'), /exceed committed ceiling/u);
    budget.ceiling = 2;
    writeFileSync(resolve(root, '.github/scripts/architecture/cli-exports-baseline.json'), JSON.stringify(budget));
    assert.deepEqual(checkAuthoringPolicies(root, [cli]), []);
    rmSync(resolve(root, '.github/scripts/architecture/cli-exports-baseline.json'));
    assert.throws(() => checkAuthoringPolicies(root, [cli]), /ENOENT/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('committed CLI ceiling equals the current export count', () => {
  const value = JSON.parse(readFileSync(new URL('./cli-exports-baseline.json', import.meta.url), 'utf8'));
  assert.equal(value.ceiling, Object.values(value.entries).reduce((count: number, entry) => {
    assert.ok(entry && typeof entry === 'object' && 'exports' in entry && Array.isArray(entry.exports));
    return count + entry.exports.length;
  }, 0));
});
