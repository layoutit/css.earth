import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { loadPds3Grid, loadVicarGrid } from '@cssearth/bake/objects/raster';
const test = sourceTest();

/** A 4 x 2 one-degree-per-cell grid is too coarse for a planet but exact for placement: cell centres at whole degrees. */
const attachedLabel = (recordBytes: number, bands: number) => `PDS_VERSION_ID = PDS3
RECORD_TYPE = FIXED_LENGTH
RECORD_BYTES = ${recordBytes}
^IMAGE = 2
DATA_SET_ID = "TEST-GRAVITY"
PRODUCT_ID = "RS-TEST.A01"
OBJECT = IMAGE
  LINES = 2
  LINE_SAMPLES = 4
  SAMPLE_TYPE = "IEEE REAL"
  SAMPLE_BITS = 64
  BANDS = ${bands}
  BAND_STORAGE_TYPE = "BAND SEQUENTIAL"
  OFFSET = 0.0
  SCALING_FACTOR = 1.0
END_OBJECT = IMAGE
OBJECT = IMAGE_MAP_PROJECTION
  MAP_PROJECTION_TYPE = "SIMPLE CYLINDRICAL"
  POSITIVE_LONGITUDE_DIRECTION = "EAST"
  MAP_RESOLUTION = 1.0
  MAXIMUM_LATITUDE = 1.5 <DEGREES>
  MINIMUM_LATITUDE = 0.5 <DEGREES>
  WESTERNMOST_LONGITUDE = -120.0 <DEGREES>
  EASTERNMOST_LONGITUDE = -117.0 <DEGREES>
END_OBJECT = IMAGE_MAP_PROJECTION
END
`;
const gridPolicy = (band: number) => ({ width: 4, height: 2, band, pixelsPerDegree: 1, firstCentreLongitude: -120, firstCentreLatitude: 1.5,
  labelExtent: 'centres', datasetId: 'TEST-GRAVITY', productId: 'RS-TEST.A01', noData: null });

test('pds3-grid reads a band of an attached-label float64 image at its stated cell centres', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pds3-grid-'));
  try {
    const recordBytes = 1024, head = Buffer.alloc(recordBytes, 0x20);
    // Magellan files open with an SFDU wrapper line before PDS_VERSION_ID.
    head.write('CCSD3ZF0000100000001NJPL3KS0PDSX##mark##\n' + attachedLabel(recordBytes, 2), 'latin1');
    const values = [1, 2, 3, 4, 5, 6, 7, 8], errors = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    const body = Buffer.alloc(16 * 8);
    [...values, ...errors].forEach((v, i) => body.writeDoubleBE(v, i * 8));
    await writeFile(join(directory, 'freeair.dat'), Buffer.concat([head, body]));
    const lens = (band: number) => ({ id: 'gravity', format: 'pds3-grid', path: 'freeair.dat', sampling: 'nearest', grid: gridPolicy(band) });
    const value = await loadPds3Grid(directory, lens(1)), error = await loadPds3Grid(directory, lens(2));
    assert.equal(value.sample(-120, 1.5), 1);
    assert.equal(value.sample(-117, 0.5), 8);
    assert.equal(value.sample(-119.4, 1.4), 2, 'a point takes its nearest cell centre');
    assert.equal(error.sample(-118, 0.5), 0.7);
    assert.equal(value.sample(0, 1), null, 'outside a partial longitude span there is no value');
    await assert.rejects(loadPds3Grid(directory, { ...lens(1), grid: { ...gridPolicy(1), labelExtent: 'edges' } }), /WESTERNMOST_LONGITUDE/u,
      'edges would place the grid half a cell away from the label');
    await assert.rejects(loadPds3Grid(directory, lens(3)), /BANDS 2 for band 3/u);
    await assert.rejects(loadPds3Grid(directory, { ...lens(1), grid: { ...gridPolicy(1), noData: -1 } }), /noDataEvidence/u,
      'a missing value the label does not declare needs the producer\'s evidence');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('pds3-grid reads a detached-label integer map and withholds cells its mask flags', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pds3-grid-'));
  try {
    // 0.05 pixels per degree: an 18 x 9 global grid whose cell edges the label states, centres 10 degrees inside them.
    const width = 18, height = 9;
    const label = (product: string, bits: number) => `PDS_VERSION_ID = PDS3
RECORD_TYPE = FIXED_LENGTH
RECORD_BYTES = ${width * bits / 8}
^IMAGE = "${product}.IMG"
DATA_SET_ID = "TEST-TI"
PRODUCT_ID = "${product}"
OBJECT = IMAGE
  LINES = ${height}
  LINE_SAMPLES = ${width}
  SAMPLE_TYPE = MSB_INTEGER
  SAMPLE_BITS = ${bits}
END_OBJECT = IMAGE
OBJECT = IMAGE_MAP_PROJECTION
  MAP_PROJECTION_TYPE = "SIMPLE CYLINDRICAL"
  POSITIVE_LONGITUDE_DIRECTION = "EAST"
  MAP_RESOLUTION = 0.05
  MAXIMUM_LATITUDE = 90.0
  MINIMUM_LATITUDE = -90.0
  WESTERNMOST_LONGITUDE = -180.0
  EASTERNMOST_LONGITUDE = 180.0
END_OBJECT = IMAGE_MAP_PROJECTION
END
`;
    const values = Buffer.alloc(width * height * 2), mask = Buffer.alloc(width * height, 1);
    for (let i = 0; i < width * height; i++) values.writeInt16BE(10 + i, i * 2);
    values.writeInt16BE(0, 1 * 2);  // row 0, column 1: the null value
    mask[2] = 0;                     // row 0, column 2: interpolated
    await writeFile(join(directory, 'ti.img'), values);
    await writeFile(join(directory, 'ti.lbl'), label('TI', 16));
    await writeFile(join(directory, 'ti_mask.img'), mask);
    await writeFile(join(directory, 'mask.lbl'), label('TI_MASK', 8));
    const grid = await loadPds3Grid(directory, { id: 'ti', format: 'pds3-grid', path: 'ti.img', labelPath: 'ti.lbl', sampling: 'nearest',
      grid: { width, height, pixelsPerDegree: 0.05, firstCentreLongitude: -170, firstCentreLatitude: 80, labelExtent: 'edges',
        datasetId: 'TEST-TI', productId: 'TI', noData: 0, noDataEvidence: 'catalogue: values outside the derived range are not computed' },
      mask: { path: 'ti_mask.img', labelPath: 'mask.lbl', productId: 'TI_MASK', withholdWhere: [0], evidence: 'mask value 0 marks interpolated cells' } });
    assert.equal(grid.sample(-170, 80), 10);
    assert.equal(grid.sample(-150, 80), null, 'the null value 0 is missing');
    assert.equal(grid.sample(-130, 80), null, 'a cell the mask marks as interpolated is withheld');
    assert.equal(grid.sample(170, -80), 10 + width * height - 1);
    assert.equal(grid.sample(190, 80), 10, 'a global grid wraps longitude');
    assert.equal(grid.report.withheldByMask, 1);
    assert.equal(grid.report.missingCells, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('pds3-grid follows a detached pointer with a record and withholds cells beyond a stated valid latitude', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pds3-grid-'));
  try {
    // Dawn gravity labels: ^IMAGE = ("NAME.IMG",1), cell centres on the grid lines, first row at the north pole (20 degree cells here).
    const width = 18, height = 10, recordBytes = width * 8;
    const label = (record: number) => `PDS_VERSION_ID = PDS3
RECORD_TYPE = FIXED_LENGTH
RECORD_BYTES = ${recordBytes}
^IMAGE = ("GEOID.IMG",${record})
DATA_SET_ID = "TEST-GEOID"
PRODUCT_ID = "GEOID.IMG"
OBJECT = IMAGE
  LINES = ${height}
  LINE_SAMPLES = ${width}
  SAMPLE_TYPE = PC_REAL
  SAMPLE_BITS = 64
END_OBJECT = IMAGE
OBJECT = IMAGE_MAP_PROJECTION
  MAP_PROJECTION_TYPE = "SIMPLE CYLINDRICAL"
  POSITIVE_LONGITUDE_DIRECTION = "EAST"
  MAP_RESOLUTION = 0.05
  MAXIMUM_LATITUDE = 90.0 <DEGREES>
  MINIMUM_LATITUDE = -90.0 <DEGREES>
  WESTERNMOST_LONGITUDE = 0.0 <DEGREES>
  EASTERNMOST_LONGITUDE = 340.0 <DEGREES>
END_OBJECT = IMAGE_MAP_PROJECTION
END
`;
    const body = Buffer.alloc(recordBytes + width * height * 8);
    for (let i = 0; i < width * height; i++) body.writeDoubleLE(100 + i, recordBytes + i * 8);
    await writeFile(join(directory, 'GEOID.IMG'), body);
    await writeFile(join(directory, 'first.lbl'), label(1));
    await writeFile(join(directory, 'second.lbl'), label(2));
    const lens = (labelPath: string, extra = {}) => ({ id: 'geoid', format: 'pds3-grid', path: 'GEOID.IMG', labelPath, sampling: 'nearest', ...extra,
      grid: { width, height, pixelsPerDegree: 0.05, firstCentreLongitude: 0, firstCentreLatitude: 90, labelExtent: 'centres',
        datasetId: 'TEST-GEOID', productId: 'GEOID.IMG', noData: null } });
    const second = await loadPds3Grid(directory, lens('second.lbl'));
    assert.equal(second.sample(0, 90), 100, 'the image starts at the named record');
    assert.equal(second.sample(20, 10), 100 + 4 * width + 1);
    assert.equal((await loadPds3Grid(directory, lens('first.lbl'))).sample(0, 90), 0, 'record 1 starts at the first byte');
    const limited = await loadPds3Grid(directory, lens('second.lbl', { latitudeLimit: { maximumAbsolute: 60, evidence: 'valid within about 60 degrees' } }));
    assert.equal(limited.sample(0, 90), null, 'a polar row beyond the valid latitude is withheld');
    assert.equal(limited.sample(20, -50), 100 + 7 * width + 1, 'a row within the valid latitude keeps its value');
    assert.equal(limited.sample(20, -70), null);
    assert.equal(limited.report.withheldByLatitude, 4 * width);
    assert.equal('withheldByLatitude' in second.report, false, 'a lens without a limit reports as before');
    await assert.rejects(loadPds3Grid(directory, lens('second.lbl', { latitudeLimit: { maximumAbsolute: 60 } })), /latitudeLimit.evidence/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('vicar-grid reads either byte order, places the stated edges and withholds declared fills', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vicar-grid-'));
  try {
    const labelSize = 200;
    for (const [name, little] of [['le.vicar', true], ['be.vicar', false]] as const) {
      const head = Buffer.alloc(labelSize, 0x20);
      head.write(`LBLSIZE=${labelSize}  FORMAT='REAL'  TYPE='IMAGE'  ORG='BSQ'  NL=2  NS=4  NB=1  NBB=0  NLB=0  EOL=0  REALFMT='${little ? 'RIEEE' : 'IEEE'}'`, 'latin1');
      const body = Buffer.alloc(32);
      [0.85, 0.93, 0.95, 0.97, 0.91, 0.85, 0.99, 0.96].forEach((v, i) => little ? body.writeFloatLE(v, i * 4) : body.writeFloatBE(v, i * 4));
      await writeFile(join(directory, name), Buffer.concat([head, body]));
      const grid = await loadVicarGrid(directory, { id: 'dci', format: 'vicar-grid', path: name, sampling: 'nearest',
        grid: { width: 4, height: 2, pixelsPerDegree: 4 / 360, westEdgeLongitude: -180, northEdgeLatitude: 90, noData: [0.85],
          noDataEvidence: 'constant polar fill', georeferenceEvidence: 'catalogue record' } });
      assert.equal(grid.sample(-170, 80), null, `${name}: the fill is missing`);
      assert.ok(Math.abs(grid.sample(-80, 10)! - 0.93) < 1e-6, `${name}: second column`);
      assert.ok(Math.abs(grid.sample(45, -10)! - 0.99) < 1e-6, `${name}: south row, third column`);
      assert.ok(Math.abs(grid.sample(280, 10)! - 0.93) < 1e-6, `${name}: longitude wraps`);
      assert.equal(grid.report.fillCells, 2);
    }
    await assert.rejects(loadVicarGrid(directory, { id: 'dci', format: 'vicar-grid', path: 'le.vicar', grid: { width: 4, height: 1, pixelsPerDegree: 4 / 360,
      westEdgeLongitude: -180, northEdgeLatitude: 90, georeferenceEvidence: 'x' } }), /NL 2/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
