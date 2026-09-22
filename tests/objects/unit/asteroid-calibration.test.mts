import { sourceTest } from '../source-test.mts';
const test = sourceTest();
import { assertCalibratedAsteroidSource } from './asteroid-calibration-contract.mts';
import { anchorTable, numberList, selectedObjectIds } from './anchor-table.mts';
import { requireFiniteNumber, requireRecord, requireString } from '../../../tools/sources/source-values.mts';
import table from './anchors/asteroid-calibration.json' with { type: 'json' };

// Original publisher-coordinate anchors and independent signed-volume intake, one entry per body.
const optionalNumber = (value: unknown, label: string): number | undefined => value === undefined ? undefined : requireFiniteNumber(value, label);
const entries = anchorTable(table, 'asteroid calibration anchors', (entry, id) => {
  const expected = requireRecord(entry.expected, `${id} expected`), label = `${id} expected`;
  return {
    name: expected.name === undefined ? undefined : requireString(expected.name, `${label} name`),
    modelId: requireFiniteNumber(expected.modelId, `${label} modelId`),
    modelVersion: expected.modelVersion === undefined ? undefined : requireString(expected.modelVersion, `${label} modelVersion`),
    vertices: requireFiniteNumber(expected.vertices, `${label} vertices`),
    faces: requireFiniteNumber(expected.faces, `${label} faces`),
    firstVertex: numberList(expected.firstVertex, `${label} firstVertex`),
    firstFace: numberList(expected.firstFace, `${label} firstFace`),
    signedVolume: requireFiniteNumber(expected.signedVolume, `${label} signedVolume`),
    diameterKm: requireFiniteNumber(expected.diameterKm, `${label} diameterKm`),
    uncertaintyKm: expected.uncertaintyKm === null ? null : optionalNumber(expected.uncertaintyKm, `${label} uncertaintyKm`),
    lambda: optionalNumber(expected.lambda, `${label} lambda`),
    beta: optionalNumber(expected.beta, `${label} beta`),
    periodHours: optionalNumber(expected.periodHours, `${label} periodHours`),
    rotation: expected.rotation === undefined ? undefined : requireRecord(expected.rotation, `${label} rotation`),
  };
});
const selected = new Set(selectedObjectIds(entries.map(entry => entry.id)));
for (const { id, claim, anchors } of entries) if (selected.has(id))
  test(`${id}: ${claim}`, () => assertCalibratedAsteroidSource(id, anchors));
