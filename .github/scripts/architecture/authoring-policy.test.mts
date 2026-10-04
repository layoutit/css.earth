import assert from 'node:assert/strict';
import test from 'node:test';
import { bodyMapAveragingFindings, cliLibraryFindings, checkAuthoringPolicies } from './authoring-policy.mts';
import { REPOSITORY_RULES } from './repository-rules.mts';

const cli = 'packages/bake/cli/new-command.mts';
test('new CLI implementations fail; main, default, local orchestration and existing paths pass', () => {
  for (const text of ['export function reduce() {}', 'export const reduce = () => 1;', 'export const reduce = function() {};', 'export class Reducer {}', 'export { reduce };']) {
    assert.equal(cliLibraryFindings(cli, text, new Set()).length, 1);
    assert.deepEqual(cliLibraryFindings(cli, text, new Set([cli])), []);
  }
  for (const text of ['export function main() {}', 'export default function reduce() {}', 'function reduce() {}', 'export type Options = {};'])
    assert.deepEqual(cliLibraryFindings(cli, text, new Set()), []);
  assert.deepEqual(cliLibraryFindings('packages/bake/src/reduce.ts', 'export function reduce() {}', new Set()), []);
});

test('both authoring owners and telescope sources reject direct, renamed and namespace averaging', () => {
  for (const path of ['packages/bake/authoring/body/author.mts', 'packages/telescope-cli/authoring/body/author.mts', 'packages/telescope-cli/src/maps.mts']) {
    for (const text of ['combineBodyMaps(maps, 30);', "import { combineBodyMaps as average } from '@cssearth/bake/objects/layers/observation'; average(maps, 30);", 'maps.combineBodyMaps(values, 30);'])
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
