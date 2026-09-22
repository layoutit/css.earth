import {shape,array,text,number} from '../../../../tools/objects/paged-ellipsoid/geographic/source-records.mts';
import {earthPreparationConfig as config} from './prepared-fixture.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { decodeElevationDods, readElevationGrid, elevationColor, prepareElevationMap } from '../../../../tools/objects/paged-ellipsoid/elevation.mts';

const sourceDirectory = resolve('src/objects/earth/source');
const selectedMap=required(config.surface.maps.find(map=>map.name==='earth-topography'));
assert.ok(selectedMap.scientific?.kind==='gebco-elevation');
const map={...selectedMap,scientific:selectedMap.scientific};

function fixture(rows = 2, rowOffset = 0) {
  const grid = { width: 4, height: 2, firstIndex: 10799, stride: 21600, nativeCellDegrees: 1 / 240 };
  const header = Buffer.from(`Dataset { Grid { ARRAY: Int16 elevation[lat = ${rows}][lon = 4]; MAPS: Float64 lat[lat = ${rows}]; Float64 lon[lon = 4]; } elevation; } bodc/gebco/global/gebco_2026/ice_surface_elevation/netcdf/GEBCO_2026.nc;\nData:\n`);
  const data = Buffer.alloc(24 + rows * 4 * 4 + (rows + 4) * 8); let offset = 0;
  const array = (values: readonly number[], size: number) => {
    data.writeUInt32BE(values.length, offset); data.writeUInt32BE(values.length, offset + 4); offset += 8;
    for (const value of values) { size === 4 ? data.writeInt32BE(value, offset) : data.writeDoubleBE(value, offset); offset += size; }
  };
  array([-3000, -2000, -1000, 0, 1000, 2000, 3000, 4000].slice(rowOffset * 4, (rowOffset + rows) * 4), 4);
  array([-45 - 1 / 480, 45 - 1 / 480].slice(rowOffset, rowOffset + rows), 8);
  array([-135 - 1 / 480, -45 - 1 / 480, 45 - 1 / 480, 135 - 1 / 480], 8);
  return { bytes: Buffer.concat([header, data]), grid, dataOffset: header.length };
}

test('signed DAP2 heights preserve axes, interpolate scalars and wrap the dateline', () => {
  const { bytes, grid } = fixture(), decoded = decodeElevationDods(bytes, grid);
  const d = 1 / 480;
  assert.equal(decoded.sample(-135 - d, -45 - d), -3000);
  assert.equal(decoded.sample(135 - d, 45 - d), 4000);
  assert.ok(Math.abs(required(decoded.sample(-90 - d, -d)) + 500) < 1e-8);
  assert.ok(Math.abs(required(decoded.sample(-180, 0)) - required(decoded.sample(180, 0))) < 1e-8);
  assert.equal(decoded.sample(0, 91), null);
  assert.equal(decoded.sample(NaN, 0), null);
});

test('height decoder rejects shifted axes, missing values and incomplete transfers', () => {
  const { bytes, grid, dataOffset } = fixture();
  assert.throws(() => decodeElevationDods(bytes.subarray(0, -1), grid), /truncated/);
  const axis = Buffer.from(bytes); axis.writeDoubleBE(90, dataOffset + 8 + 32 + 8);
  assert.throws(() => decodeElevationDods(axis, grid), /coordinate/);
  const fill = Buffer.from(bytes); fill.writeInt32BE(-32768, dataOffset + 8);
  assert.throws(() => decodeElevationDods(fill, grid), /invalid height/);
  const count = Buffer.from(bytes); count.writeUInt32BE(7, dataOffset);
  assert.throws(() => decodeElevationDods(count, grid), /count/);
});

test('land height and ocean depth use a single signed scale with explicit deep saturation', () => {
  const recipe = map.scientific;
  assert.deepEqual(elevationColor(-11000, recipe), [9, 29, 70]);
  assert.deepEqual(elevationColor(-4000, recipe), [38, 120, 173]);
  assert.deepEqual(elevationColor(0, recipe), [98, 140, 73]);
  assert.deepEqual(elevationColor(4000, recipe), [165, 125, 105]);
  assert.deepEqual(elevationColor(5000, recipe), [176, 152, 136]);
});

test('latitude blocks assemble exactly once and partial or overlapping globes fail closed', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-elevation-blocks-'));
  try {
    await writeFile(resolve(directory, 'metadata.das'), await readFile(resolve(sourceDirectory, map.scientific.metadata)));
    for (let row = 0; row < 2; row++) await writeFile(resolve(directory, `${row}.gz`), gzipSync(fixture(1, row).bytes));
    const sampleMap = { path: '0.gz', scientific: { ...map.scientific, metadata: 'metadata.das', grid: fixture().grid,
      blocks: [{ path: '0.gz', rowOffset: 0, rows: 1 }, { path: '1.gz', rowOffset: 1, rows: 1 }] } };
    const decoded = await readElevationGrid(directory, sampleMap);
    assert.deepEqual([...decoded.values], [-3000, -2000, -1000, 0, 1000, 2000, 3000, 4000]);
    await assert.rejects(() => readElevationGrid(directory, { ...sampleMap,
      scientific: { ...sampleMap.scientific, blocks: sampleMap.scientific.blocks.slice(0, 1) } }), /incomplete global coverage/);
    await assert.rejects(() => readElevationGrid(directory, { ...sampleMap,
      scientific: { ...sampleMap.scientific, blocks: [sampleMap.scientific.blocks[0], sampleMap.scientific.blocks[0]] } }), /overlapping/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('pinned GEBCO numerical anchors agree with independently requested source cells', async () => {
  const grid = await readElevationGrid(sourceDirectory, map);
  const witnesses = shape({records:array(shape({sampleIndex:array(number),meters:number,name:text,longitude:number,latitude:number,expectedRange:array(number)}))})(JSON.parse((await readFile('tests/objects/fixtures/earth-elevation/source-witnesses.json')).toString('utf8')));
  for (const witness of witnesses.records) {
    const [row, col] = witness.sampleIndex;
    assert.equal(grid.values[row * map.scientific.grid.width + col], witness.meters, witness.name);
    assert.ok(Math.abs(required(grid.sample(witness.longitude, witness.latitude)) - witness.meters) < 1e-5, witness.name);
    assert.ok(witness.meters >= witness.expectedRange[0] && witness.meters <= witness.expectedRange[1], witness.name);
  }
});

test('numeric source interpretation also produces the shipped sidebar map and unshaded legend', async () => {
  const raster = await prepareElevationMap({ sourceDirectory, map, width: config.surface.width, height: config.surface.height });
  const minimap = await sharp(raster.data, { raw: raster.info }).resize({ width: 640, withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true }).toBuffer();
  assert.deepEqual(minimap, await readFile('src/objects/earth/prepared/minimaps/topography.webp'));
  const { data, info } = await sharp('public/scenes/earth/earth-topography-legend.png').raw().toBuffer({ resolveWithObject: true });
  for (const x of [0, 100, 310, 500, 619]) {
    const meters = -10000 + 20000 * x / (info.width - 1);
    assert.deepEqual([...data.subarray(x * 3, x * 3 + 3)], elevationColor(meters, map.scientific));
    assert.deepEqual([...data.subarray(((info.height - 1) * info.width + x) * 3, ((info.height - 1) * info.width + x) * 3 + 3)], elevationColor(meters, map.scientific));
  }
});
