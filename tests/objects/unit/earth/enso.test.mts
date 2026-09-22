import {shape,array,text,number} from '../../../../tools/objects/geographic-pages/source-records.mts';
// A no-data witness records a null interval.
const nullableText = (value: unknown): string | null => value === null ? null : text(value);
import {parseMurReceipt} from '../../../../tools/objects/paged-ellipsoid/source-contract.mts';
import {earthPreparationConfig as config} from './prepared-fixture.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { sha256 } from '../../../../src/platform/sha256.mts';
import { murEnsoContent, murEnsoText, parseMurCapabilities, parseMurColors, verifyMurTile } from '../../../../tools/objects/paged-ellipsoid/mur-imagery.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readCoraltempAnomaly, anomalyColor } from '../../../../tools/objects/paged-ellipsoid/sst-anomaly.mts';
import { newestCoraltemp, parseEnsoAdvisory } from '../../../../tools/objects/paged-ellipsoid/refresh-earth-enso.mts';

const source = resolve('src/objects/earth/source');
const map=required(config.surface.maps.find(map=>map.name==='earth-enso'));
const scientific=map.scientific;
assert.ok(scientific?.kind==='gibs-mur-imagery');
const coraltempRecipe = {"kind": "coraltemp-anomaly", "filename": "ct5km_ssta_v3.1-clim19912020-v1_20260907.nc", "date": "2026-09-07", "baseline": "1991–2020", "checked": "2026-09-09T03:15:04.081Z", "minimum": -5, "maximum": 5, "palette": [[5, 48, 97], [33, 102, 172], [67, 147, 195], [146, 197, 222], [247, 247, 247], [244, 165, 130], [214, 96, 77], [178, 24, 43], [103, 0, 31]], "missingColor": [62, 68, 73], "advisory": {"date": "13 August 2026", "status": "El Niño Advisory", "url": "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml"}};


test('latest acquisition crosses years and excludes checksum-only placeholders and future data', () => {
  const file = (day: string) => `ct5km_ssta_v3.1-clim19912020-v1_${day}.nc`;
  const link = (day: string) => `<a href="${file(day)}">${file(day)}</a>`;
  const listings = [link('20251231'), link('20260101'), link('20260103'),
    `<a href="${file('20260102')}.md5">${file('20260102')}.md5</a>`];
  assert.equal(newestCoraltemp(listings, '2026-01-02').filename, file('20260101'));
  assert.equal(newestCoraltemp(listings, '2025-12-31').filename, file('20251231'));
  assert.throws(() => newestCoraltemp([required(listings.at(-1))], '2026-01-02'), /No published NOAA/);
});

test('extracts the NOAA issue date and status and preserves their separate source record', async () => {
  // Selected headline fields from the 13 August 2026 NOAA CPC advisory.
  const headline = '<p>issued by CLIMATE PREDICTION CENTER 13 August 2026</p>'
    + '<p>ENSO Alert System Status: El Ni&ntilde;o Advisory</p><p>Synopsis:</p>';
  const expected = { date: '13 August 2026', status: 'El Niño Advisory',
    url: 'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml' };
  assert.deepEqual(parseEnsoAdvisory(headline), expected);
  assert.deepEqual(scientific.advisory, expected);
  assert.throws(() => parseEnsoAdvisory('new format'), /format changed/);
  const content = shape({lenses:shape({controls:array(shape({id:text}))})})(JSON.parse((await readFile(resolve(source, 'content/object.json'))).toString('utf8')));
  assert.deepEqual(content.lenses.controls.find((lens: { id: string; }) => lens.id === 'enso'), murEnsoContent(scientific));
  // The refresh writes the dated reader text beside object.json; the published entry is that builder's.
  assert.deepEqual(JSON.parse(await readFile(resolve(source, '../text.json'), 'utf8')).datasets.enso, murEnsoText(scientific));
});

test('NOAA signed anomalies retain orientation, physical units, and the fill mask', async () => {
  const decoded = await readCoraltempAnomaly(resolve(source, 'science/coraltemp-latest.nc'), coraltempRecipe);
  assert.equal(decoded.receipt.valid + decoded.receipt.missing, 7200 * 3600);
  const pixel = (longitude: number, latitude: number) => {
    const x = Math.floor((longitude + 180) * 20), y = Math.floor((90 - latitude) * 20);
    return [...decoded.data.subarray((y * 7200 + x) * 3, (y * 7200 + x) * 3 + 3)];
  };
  // Independently read from the pinned netCDF sea_surface_temperature_anomaly array at the listed NOAA
  // cell centers (raw signed int16), not sampled through the raster producer.
  // Requalify these witnesses when refreshing the source date.
  assert.equal(coraltempRecipe.filename, 'ct5km_ssta_v3.1-clim19912020-v1_20260907.nc');
  for (const [longitude, latitude, value] of [
    [-149.975, -.025, 3.83], [-99.975, -.025, 5.86], [150.025, -.025, .33],
    [-149.975, -30.025, -.08], [-39.975, 39.975, .19], [-179.975, -.025, .91],
    [-83.975, 8.975, 1.11], [-84.975, 8.975, 1.4],
  ]) assert.deepEqual(pixel(longitude, latitude), anomalyColor(value, coraltempRecipe));
  for (const [longitude, latitude] of [[10.025, 24.975], [-39.975, 74.975], [.025, 88.975], [-79.975, -80.025]]) {
    assert.deepEqual(pixel(longitude, latitude), coraltempRecipe.missingColor);
    assert.notDeepEqual(pixel(longitude, latitude), anomalyColor(-327.68, coraltempRecipe));
  }
  await assert.rejects(() => readCoraltempAnomaly(resolve(source, 'science/coraltemp-latest.nc'), { ...coraltempRecipe, date: '2015-11-15' }), /date differs/);
  await assert.rejects(() => readCoraltempAnomaly(resolve(source, 'science/coraltemp-latest.nc'), { ...coraltempRecipe, baseline: '1971–2000' }), /climatology differs/);
  assert.equal(decoded.receipt.maskCounts.water, decoded.receipt.valid);
  assert.ok(decoded.receipt.maskCounts.ice > 0 && decoded.receipt.maskCounts.missing > 0);
  assert.deepEqual(anomalyColor(0, coraltempRecipe), [247,247,247]);
  assert.deepEqual(anomalyColor(-100, coraltempRecipe), coraltempRecipe.palette[0]);
  assert.deepEqual(anomalyColor(100, coraltempRecipe), coraltempRecipe.palette.at(-1));
});


test('NASA imagery rejects date substitution, future dates, and changed grids', async () => {
  const xml = await readFile(resolve(source, 'science/mur-gibs-layer.xml'), 'utf8');
  assert.equal(parseMurCapabilities(xml, '2026-09-09').date, '2026-09-07');
  assert.throws(() => parseMurCapabilities(xml.replace('<Default>2026-09-07</Default>', '<Default>2026-09-10</Default>'), '2026-09-09'), /future/);
  assert.throws(() => parseMurCapabilities(xml.replace('<MatrixWidth>80</MatrixWidth>', '<MatrixWidth>81</MatrixWidth>')), /grid changed/);
  const layer = 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies_v4.1_STD';
  verifyMurTile('2026-09-07T00:00:00Z', layer, '2026-09-07');
  assert.throws(() => verifyMurTile('2026-09-06T00:00:00Z', layer, '2026-09-07'), /another date/);
  assert.throws(() => verifyMurTile(null, null, '2026-09-07'), /another date/);
  verifyMurTile(null, null, '2026-09-07', true);
});

test('NASA full coverage, published bins, and independently decoded pixels survive preparation', async () => {
  const receipt = parseMurReceipt(JSON.parse((await readFile(resolve(source, 'science/mur-gibs-receipt.json'))).toString('utf8')));
  assert.equal(receipt.date, scientific.date); assert.equal(receipt.complete, true);
  assert.equal(receipt.tiles.length, 3200);
  assert.equal(new Set(receipt.tiles.map(t => `${t.row}/${t.col}`)).size, 3200);
  for (const tile of receipt.tiles) verifyMurTile(tile.actualTime, tile.actualLayer, receipt.date, tile.empty);
  const colors = parseMurColors(await readFile(resolve(source, 'science/mur-gibs-colormap.xml'), 'utf8'));
  assert.equal(colors.bins.length, 60);
  assert.deepEqual(colors.under.rgb, [107, 0, 219]); assert.deepEqual(colors.over.rgb, [128, 0, 0]);
  const bytes = await readFile(resolve(source, 'science/mur-gibs.png'));
  assert.equal(sha256(bytes), receipt.mosaic.sha256);
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 16384); assert.equal(info.height, 8192);
  const witnesses = shape({records:array(shape({outputPixel:array(number),expectedMosaicRgb:array(number),name:text,intervalCelsius:nullableText}))})(JSON.parse((await readFile('tests/objects/fixtures/earth-enso/mur-native-witnesses.json')).toString('utf8')));
  for (const witness of witnesses.records) {
    const [x, y] = witness.outputPixel, offset: number = (y * info.width + x) * 3;
    assert.deepEqual([...data.subarray(offset, offset + 3)], witness.expectedMosaicRgb, witness.name);
    if (witness.intervalCelsius) assert.ok(colors.entries.some(e => e.range === witness.intervalCelsius && JSON.stringify(e.rgb) === JSON.stringify(witness.expectedMosaicRgb)));
  }
  assert.equal(receipt.mosaic.covered + receipt.mosaic.missing, info.width * info.height);
});
