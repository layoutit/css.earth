import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { FILTER_COMBINATIONS, INDEX_COLUMNS, colourImages, indexNumber, parseIndex, parseIndexLine, parseProductId, parseProgram, pinProgram } from '@cssearth/telescope-cli/archives/juno/archive';
import { ellipsoidMesh } from '@cssearth/telescope-cli/archives/juno/measure';

// Two lines of JNOJNC_0024/INDEX/INDEX.TAB as the PDS serves them, and a methane image made from the second.
const EUROPA = '"JNOJNC_0024","JUNOCAM-RDR","JUNO-J-JUNOCAM-3-RDR-L1A-V1.0","JNCR_2022272_45C00001_V01",2022-09-29T09:38:05.691,2022-09-29T09:38:16.079,"3                  ","Europa                                                                                                         ",7.4133e+08 <km> ,1515.1 <km>          ,11.7571                  ,0.3597                    ,"EUROPA     ","DATA/RDR/JUPITER/ORBIT_45/JNCR_2022272_45C00001_V01.LBL",2023-02-02T20:23:40,"5a1c0c3d0e0f4a8a9b0c1d2e3f405162"';
const RAW = EUROPA.replace('JUNOCAM-RDR', 'JUNOCAM-EDR').replace('-3-RDR-L1A-', '-2-EDR-L0-').replaceAll('JNCR_', 'JNCE_').replace('/RDR/', '/EDR/');
const METHANE = EUROPA.replaceAll('45C00001', '45M00007').replace('1515.1 <km>', '9000.0 <km>');
const rows = parseIndex([EUROPA, RAW, METHANE, ''].join('\r\n'));

test('an index line keeps its sixteen fields, a quoted comma and its units', () => {
  assert.equal(rows.length, 3);
  assert.deepEqual([rows[0]!.PRODUCT_ID, rows[0]!.TARGET_NAME, rows[0]!.START_TIME, rows[0]!.FILE_SPECIFICATION_NAME], ['JNCR_2022272_45C00001_V01', 'EUROPA', '2022-09-29T09:38:05.691', 'DATA/RDR/JUPITER/ORBIT_45/JNCR_2022272_45C00001_V01.LBL']);
  assert.equal(indexNumber(rows[0]!.SPACECRAFT_ALTITUDE), 1515.1); assert.equal(indexNumber('N/A'), null);
  assert.equal(parseIndexLine(EUROPA.replace('"Europa ', '"Europa, leaving ')).RATIONALE_DESC.startsWith('Europa, leaving'), true);
  assert.throws(() => parseIndexLine(EUROPA.split(',').slice(0, 12).join(',')), new RegExp(`not ${INDEX_COLUMNS.length}`, 'u'));
});

test('a product id states its type, orbit and filter combination, and only calibrated colour images are pinned', () => {
  assert.deepEqual(parseProductId('JNCR_2022272_45C00001_V01'), { type: 'RDR', year: 2022, dayOfYear: 272, orbit: 45, filterCombination: 'C', index: 1, version: 1 });
  assert.equal(parseProductId('JNCE_2013282_00A00002_V01').type, 'EDR'); assert.deepEqual(FILTER_COMBINATIONS.A, ['RED', 'GREEN', 'BLUE', 'METHANE']);
  assert.throws(() => parseProductId('JNCR_2022272_45C0001_V01'), /Not a JunoCam product id/u);
  assert.deepEqual(colourImages(rows, 'europa').map(row => row.PRODUCT_ID), ['JNCR_2022272_45C00001_V01'], 'the raw product and the methane image are left out');
  assert.deepEqual(colourImages(rows, 'EUROPA', 44), []);
});

test('a program is pinned from the index with each file size, and refuses anything but calibrated PDS products', async () => {
  const served: Record<string, string | number> = { 'https://planetarydata.jpl.nasa.gov/img/data/juno/JNOJNC_0024/INDEX/INDEX.TAB': [EUROPA, RAW, METHANE].join('\r\n') };
  const base = 'https://planetarydata.jpl.nasa.gov/img/data/juno/JNOJNC_0024/DATA/RDR/JUPITER/ORBIT_45/JNCR_2022272_45C00001_V01';
  served[`${base}.IMG`] = 35438592; served[`${base}.LBL`] = 2500;
  const fetcher = (async (url: string, init?: RequestInit) => { const hit = served[String(url)]; if (hit === undefined) return new Response('', { status: 404 });
    return init?.method === 'HEAD' ? new Response(null, { headers: { 'content-length': String(hit) } }) : new Response(String(hit)); }) as typeof fetch;
  const program = await pinProgram('test-program', 'JNOJNC_0024', { name: 'EUROPA', naifId: 502, bodyFrame: 'IAU_EUROPA' }, ['lsk/naif0012.tls', 'pck/pck00011.tpc'], 45, fetcher);
  assert.deepEqual(program.images, [{ productId: 'JNCR_2022272_45C00001_V01', startTime: '2022-09-29T09:38:05.691Z', altitudeKm: 1515.1, url: `${base}.IMG`, bytes: 35438592, labelUrl: `${base}.LBL`, labelBytes: 2500 }]);
  await assert.rejects(pinProgram('test-program', 'JNOJNC_0024', { name: 'IO', naifId: 501, bodyFrame: 'IAU_IO' }, [], undefined, fetcher), /lists no calibrated colour image of IO/u);
  await assert.rejects(pinProgram('test-program', 'JNOJNC_24', { name: 'EUROPA', naifId: 502, bodyFrame: 'IAU_EUROPA' }, [], undefined, fetcher), /JNOJNC_nnnn/u);
  assert.throws(() => parseProgram({ ...program, images: [{ ...program.images[0], productId: 'JNCE_2022272_45C00001_V01' }] }), /calibrated products/u);
  assert.throws(() => parseProgram({ ...program, images: [{ ...program.images[0], url: 'https://example.org/JNCR_2022272_45C00001_V01.IMG' }] }), /calibrated products/u);
});

test('the reference ellipsoid has the stated semi-axes at its equator and poles', () => {
  const mesh = ellipsoidMesh([1562.6, 1560.3, 1559.5]), radius = (lon: number, lat: number) => mesh.sample(lon, lat);
  assert.ok(Math.abs(radius(0, 0)! - 1562600) < 1 && Math.abs(radius(90, 0)! - 1560300) < 1 && Math.abs(radius(0, 90)! - 1559500) < 1, `${radius(0, 0)} ${radius(90, 0)} ${radius(0, 90)}`);
  assert.throws(() => ellipsoidMesh([1560]), /no triaxial radii/u);
});

