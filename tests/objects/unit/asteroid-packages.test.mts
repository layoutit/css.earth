import { test } from 'node:test';
import { assertAsteroidPackage } from './asteroid-contract.mts';
import { anchorTable, selectedObjectIds, stringList } from './anchor-table.mts';
import { requireFiniteNumber } from '../../../tools/sources/source-values.mts';
import table from './anchors/asteroid-packages.json' with { type: 'json' };

// Each prepared asteroid package keeps its declared lenses, native raster triangles and radius.
const entries = anchorTable(table, 'asteroid package anchors', (entry, id) => ({
  lenses: stringList(entry.lenses, `${id} lenses`),
  radiusM: requireFiniteNumber(entry.radiusM, `${id} radiusM`),
}));
const selected = new Set(selectedObjectIds(entries.map(entry => entry.id)));
for (const { id, claim, anchors } of entries) if (selected.has(id))
  test(`${id}: ${claim}`, () => assertAsteroidPackage(id, anchors.lenses, anchors.radiusM));
