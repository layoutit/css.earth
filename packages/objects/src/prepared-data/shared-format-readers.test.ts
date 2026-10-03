/** Caller wiring gates complement behavioral admission tests; each fails when a shared call is dropped. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = (path: string) => readFileSync(path, 'utf8');
const objects = 'packages/objects/src/';

test('A226 disc policies have one parser and forwarding compatibility readers', () => {
  const reader = source(`${objects}prepared-data/disc-integrated-color.ts`);
  assert.match(reader, /parseDiscColor\(value, \{ acceptance: 'photometry' \}\)/u);
  assert.match(reader, /parseDiscColorRecord = \(value: unknown\): DiscColorRecord => parseDiscColor\(value\)/u);
  assert.doesNotMatch(source('packages/telescope-cli/src/family-operation.mts'), /function parseDiscColor/u);
  assert.match(source('packages/telescope-cli/src/family-operation.mts'), /parseDiscColorPhotometry\(JSON.parse/u);
});
test('A230 restore uses the matrix parser finite policy', () => {
  const reader = source(`${objects}prepared-data/camera-pose.ts`);
  assert.match(reader, /return parseCameraPoseMatrix\(scene, \{ rotation: 'finite' \}\)/u);
  assert.equal(reader.match(/\.map\(Number\)/gu)?.length, 1);
});
test('A232 prepared panel primitive readers have one owner', () => {
  for (const path of [`${objects}prepared-data/prepared-content.ts`, `${objects}prepared-data/object-content.ts`, 'site/prepared-panel-content.mts']) {
    const caller = source(path);
    assert.match(caller, /from '\.[^']*panel-readers\.js'|import \{ preparedPanelReaders \}/u);
    assert.doesNotMatch(caller, /const (?:preparedObject|preparedText|preparedArray|object|text|number|optionalBoolean|array) =/u);
  }
});
test('A225 limb edge evaluation delegates to core', () => {
  assert.match(source(`${objects}prepared-data/published-limb-darkening.ts`), /limbIntensity\(0, law\)/u);
  assert.doesNotMatch(source('packages/bake/src/objects/stellar/limb-laws.ts'), /function limbIntensity/u);

});
test('A190 convex edge admission has one arithmetic owner', () => {
  for (const path of [`${objects}volume/emission-window.ts`, 'packages/bake/src/volume/fields/emission-window.ts']) {
    assert.match(source(path), /convexWindowEdges\(/u);
    assert.doesNotMatch(source(path), /function edges|Math\.hypot/u);
  }
});
test('A191 compact replay consumes typed material and projection', () => {
  const reader = source(`${objects}volume/compact-finite-emission.ts`);
  for (const call of ['parseCloudAppearance(input.appearance)', 'validateChannelGain(dataset.channelGain)', 'validateDatasetToneCurve(dataset.toneCurve)', 'readCompactToneProjection(input.toneProjection)']) assert.ok(reader.includes(call), call);
  const replay = source('packages/bake/src/volume/node/compact-inputs/finite-emission.ts');
  assert.doesNotMatch(replay, /parseCloudAppearance|validateChannelGain|validateDatasetToneCurve|readCompactToneProjection|readCompactFiniteDataset/u);
});
test('A228 catalogue projection uses shared coordinate admission and reads once', () => {
  const caller = source('labs/nebula/packages/reconstruction/src/stars/observed-catalogue.ts');
  assert.match(caller, /isStellarCoordinate\(centerIcrsDegrees/u);
  assert.doesNotMatch(caller, /const coordinate|readObservedStellarCatalogueEnvelope/u);
  assert.equal(caller.match(/parseObservedStellarCatalogue\(/gu)?.length, 1);
});
test('A205 density JSON parsing stays in the shared text reader', () => {
  for (const path of ['packages/renderer/src/volume/loader.ts', 'packages/bake/src/density/promote-density-volume-dataset-bank.ts', 'packages/telescope-cli/src/families/f16/f16-cartesian-grid.mts']) {
    assert.match(source(path), /parsePreparedDensityVolumeText\(text, descriptor\)/u);
    assert.doesNotMatch(source(path), /JSON\.parse\(new TextDecoder/u);
  }
});
