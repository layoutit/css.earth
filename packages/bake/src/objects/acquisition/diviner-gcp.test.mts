import { pathToFileURL } from 'node:url';
import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { checkGcpLabel, parseGcpRecipe } from '@cssearth/bake/objects/acquisition';

const recipePath = new URL('src/objects/moon/source/science/diviner-gcp/prepare-tbol.json', pathToFileURL(findProjectRoot(import.meta.url) + '/'));
const label = (south: number, north: number, name = '00N10N') => `PDS_VERSION_ID = PDS3
RECORD_TYPE = FIXED_LENGTH
RECORD_BYTES = 113
FILE_RECORDS = 1382401
^HEADER = ("GLOBAL_CUMUL_AVG_CYL_00N10N_002.TAB", 1)
^TABLE = ("GLOBAL_CUMUL_AVG_CYL_00N10N_002.TAB", 2)
DATA_SET_ID = "LRO-L-DLRE-5-GCP-V1.0"
PRODUCT_ID = "GLOBAL_CUMUL_AVG_CYL_${name}_002.TAB"
PRODUCT_VERSION_ID = "1"
A_AXIS_RADIUS = 1737.4 <km>
MAXIMUM_LATITUDE = ${north}.00000 <deg>
MINIMUM_LATITUDE = ${south}.00000 <deg>
WESTERNMOST_LONGITUDE = -180.00000 <deg>
EASTERNMOST_LONGITUDE = 180.00000 <deg>
POSITIVE_LONGITUDE_DIRECTION = "EAST"
OBJECT = HEADER
  BYTES = 113
END_OBJECT = HEADER
OBJECT = TABLE
  INTERCHANGE_FORMAT = ASCII
  ROW_BYTES = 113
  ROWS = 1382400
  COLUMNS = 11
  ^STRUCTURE = "DLRE_GCP.FMT"
END_OBJECT = TABLE
END`;

test('the Moon GCP recipe names the 18 strips once and the noon window on bin edges', async () => {
  const recipe = parseGcpRecipe(JSON.parse(await readFile(recipePath, 'utf8')));
  assert.equal(recipe.tables.length, 18);
  assert.deepEqual(recipe.reductions.map(r => r.kind === 'local-time' ? [r.id, r.fromHour, r.toHour, r.minimumBins] : [r.id]), [['noon', 11.5, 12.5, 1], ['maximum']]);
  const raw = JSON.parse(await readFile(recipePath, 'utf8'));
  assert.throws(() => parseGcpRecipe({ ...raw, tables: raw.tables.slice(1) }), /18 ten-degree strips/);
  assert.throws(() => parseGcpRecipe({ ...raw, reductions: [{ id: 'noon', kind: 'local-time', fromHour: 11.8, toHour: 12.2, output: 'x.tif' }] }), /bin edges/);
  assert.throws(() => parseGcpRecipe({ ...raw, reductions: [{ id: 'noon', kind: 'local-time', fromHour: 11.75, toHour: 12.25, minimumBins: 3, output: 'x.tif' }] }), /minimumBins/);
});

test('a GCP strip label must match its strip, data set and layout', async () => {
  const recipe = parseGcpRecipe(JSON.parse(await readFile(recipePath, 'utf8')));
  const strip = recipe.tables.find(t => t.south === 0)!;
  assert.doesNotThrow(() => checkGcpLabel(label(0, 10), strip, recipe));
  assert.throws(() => checkGcpLabel(label(10, 20), strip, recipe), /MINIMUM_LATITUDE/);
  assert.throws(() => checkGcpLabel(label(0, 10).replace('ROWS = 1382400', 'ROWS = 1382399'), strip, recipe), /TABLE ROWS/);
  assert.throws(() => checkGcpLabel(label(0, 10).replace('GCP-V1.0', 'GCP-V2.0'), strip, recipe), /DATA_SET_ID/);
  // The archived 40S-30S label exchanges its latitudes; only a strip the recipe flags may do so.
  const swapped = label(-40, -30, '40S30S').replace('MAXIMUM_LATITUDE = -30', 'MAXIMUM_LATITUDE = -40').replace('MINIMUM_LATITUDE = -40', 'MINIMUM_LATITUDE = -30');
  const flagged = recipe.tables.find(t => t.south === -40)!;
  assert.ok(flagged.labelLatitudesSwapped);
  assert.doesNotThrow(() => checkGcpLabel(swapped, flagged, recipe));
  assert.throws(() => checkGcpLabel(label(-40, -30, '40S30S'), flagged, recipe), /swaps its latitudes/);
  assert.throws(() => checkGcpLabel(swapped, { ...flagged, labelLatitudesSwapped: undefined }, recipe), /MINIMUM_LATITUDE/);
});
