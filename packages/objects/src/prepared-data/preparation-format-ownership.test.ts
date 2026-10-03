import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const contracts = [
  { id: 'A236', diagnostic: 'Solar-system source is invalid.', readers: [
    ['packages/bake/src/objects/celestial/celestial.ts', 'parseSolarSceneSource(JSON.parse'],
    ['site/build/prepare/prepare-world-navigation.ts', "parseSolarSceneSource(sources.get('solar-system'), 'units')"]] },
  { id: 'A237-ledger', diagnostic: 'expects status ${INVESTIGATION_STATUSES.join', readers: [
    ['packages/bake/src/sources/investigation-ledger.ts', 'parseSharedInvestigationLedger(value,']] },
  { id: 'A237', diagnostic: 'Acquisition URL or groups are missing.', readers: [
    ['packages/bake/src/objects/acquisition/operations-acquisition.ts', 'parseSharedAcquisitionPlan(value,'],
    ['packages/bake/src/sources/investigation-ledger.ts', 'parseSharedInvestigationLedger(value,'],
    ['packages/bake/src/sources/investigation-ledger.ts', 'parseSharedFacilityLedger(value,']] },
  { id: 'A238', diagnostic: 'Unsupported geometry profile.', readers: [
    ['packages/bake/src/scene/profile.ts', "export { parseGeometryProfile, type GeometryProfile } from '@cssearth/objects'"]] },
  { id: 'A239', diagnostic: 'paged ellipsoid zoom limit needs atlas.sourceWidth', readers: [
    ['packages/bake/src/objects/layers/paged-ellipsoid/globe/profile-source.ts', 'parsePagedRecipe(value)'],
    ['site/build/prepare/prepare-world-navigation.ts', "parsePagedRecipe(paged, 'surface-arc')"],
    ['site/build/prepare/prepare-world-navigation.ts', "parsePagedRecipe(paged, 'drag')"]] },
  { id: 'A240', diagnostic: 'Chart asset base must be an absolute URL prefix.', readers: [
    ['site/build/charts/charts.ts', 'parseChartAssetRecipe(config)'],
    ['site/overview/spectrum-data.mts', 'parseSpectrumRecipe(input)'],
    ['packages/bake/src/objects/charts/measured-spectrum.ts', 'parseMeasuredSpectrum(input)'],
    ['packages/bake/src/objects/charts/retrieved-profile.ts', 'parseRetrievedProfile(input)'],
    ['packages/bake/src/objects/charts/system-orbits.ts', "from '@cssearth/objects'"]] },
  { id: 'A241', diagnostic: 'Invalid nebula depth-model recipe.', readers: [
    ['labs/nebula/packages/reconstruction/src/methods/inference/depth-model.ts', 'parseDepthRecipe(v, path => jointPath(path) && allowedPath(path))']] },
] as const;

for (const contract of contracts) test(`${contract.id}: parser diagnostics and reader delegation have one owner`, () => {
  const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.ts', '*.mts', '*.astro'], { cwd: root, encoding: 'utf8' }).split('\0');
  const sources = [...new Set(paths)].filter(path => /\.(?:ts|mts|astro)$/u.test(path) && !path.includes('.test.')
    && !path.startsWith('output/') && !path.startsWith('untangle/'));
  const parserNames = ['parseSolarSceneSource', 'parseGeometryProfile', 'parseDepthRecipe', 'parsePagedRecipe', 'parseChartAssetRecipe', 'parseMeasuredSpectrum', 'parseRetrievedProfile', 'parseSystemOrbits', 'parseSpectrumRecipe', 'parsePagedDatasetBindings'];
  const declarations = sources.filter(path => !path.startsWith('packages/objects/src/') && parserNames.some(name => new RegExp(`\\b(?:function|const)\\s+${name}\\b`, 'u').test(readFileSync(resolve(root, path), 'utf8'))));
  assert.deepEqual(declarations, [], 'Pure parsers must have one objects owner');
  const copies = sources.filter(path => !path.startsWith('packages/objects/src/') && readFileSync(resolve(root, path), 'utf8').includes(contract.diagnostic));
  assert.deepEqual(copies, [], `${contract.id}: duplicated parser admission`);
  assert.ok(sources.some(path => path.startsWith('packages/objects/src/') && readFileSync(resolve(root, path), 'utf8').includes(contract.diagnostic)), `${contract.id}: missing shared admission`);
  for (const [path, call] of contract.readers) assert.ok(readFileSync(resolve(root, path), 'utf8').includes(call), `${contract.id}: ${path} bypasses shared reader`);
});
