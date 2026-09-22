import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { decodePds4GeometryCube } from './pds4-geometry-cube.mts';
import { parseGeometryCube } from './source-records.mts';

const size = 8, fileName = 'dart_0401930040_12262_01_geo.fits', planeBytes = size * size * 4;
const order = ['ioverf', 'xcoord', 'ycoord', 'zcoord', 'latitude', 'longitude', 'radius', 'incidence', 'emission', 'phase', 'horizpixscale', 'vertpixscale', 'slope', 'elevation', 'gravacc', 'gravpot'];
const defaultUnits: Record<string, string | null> = { ioverf: null, xcoord: 'km', ycoord: 'km', zcoord: 'km', latitude: 'deg', longitude: 'deg', radius: 'km', incidence: 'deg', emission: 'deg', phase: 'deg',
  horizpixscale: 'm', vertpixscale: 'm', slope: 'deg', elevation: 'm', gravacc: 'm/s**2', gravpot: 'J/kg' };
const descriptions: Record<string, string> = { ioverf: 'Pixel value', xcoord: 'X coordinate of pixel center', ycoord: 'Y coordinate of pixel center', zcoord: 'Z coordinate of pixel center',
  incidence: 'Solar incidence angle', emission: 'Emission angle', phase: 'Solar phase angle' };
const cube = parseGeometryCube({ collection: 'urn:nasa:pds:dart:data_dracoddp', target: '(65803) Didymos I (Dimorphos)', observingSystem: ['DART:Host', 'DRACO:Instrument'],
  shapeKernel: 'dimorphos_g_00243mm_spc_0000n00000_v004.bds', quantity: 'I/F',
  planes: { image: 'ioverf', x: 'xcoord', y: 'ycoord', z: 'zcoord', incidence: 'incidence', emission: 'emission', phase: 'phase', pixelScale: ['horizpixscale', 'vertpixscale'] },
  header: { MISSION: 'DART', INSTRUME: 'DRACO', SATPXVAL: '1E09' }, headerTime: 'ACQ_UTC', headerPlaneNames: { prefix: 'PLANE', names: descriptions } });
const card = (key: string, value: string | number | boolean) =>
  `${key.padEnd(8)}= ${typeof value === 'string' ? `'${value}'` : value === true ? 'T' : value === false ? 'F' : String(value)}`.padEnd(80);
const identity: Record<string, string | number | boolean> = { MISSION: 'DART', INSTRUME: 'DRACO', ACQ_UTC: '2022-09-26T23:14:12.737', SATPXVAL: '1E09',
  ...Object.fromEntries(order.map((name, index) => [`PLANE${String(index + 1).padStart(2, '0')}`, descriptions[name] ?? name])) };
const headerLength = Math.ceil((Object.keys(identity).length + 7) * 80 / 2880) * 2880;

/** A tiny cube in the archived layout: geometry planes at -999 off the body, image not applicable outside the readout window. */
function bytesOf(overrides: Record<string, string | number | boolean> = {}, mutate?: (planes: Record<string, Float32Array>) => void, scale: Partial<Record<string, number>> = {}) {
  const header = { SIMPLE: true, BITPIX: -32, NAXIS: 3, NAXIS1: size, NAXIS2: size, NAXIS3: 16, ...identity, ...overrides };
  const headerBytes = Buffer.from([...Object.entries(header).map(([key, value]) => card(key, value)), 'END'.padEnd(80)].join('').padEnd(headerLength), 'ascii');
  const planes: Record<string, Float32Array> = Object.fromEntries(order.map(name => [name, new Float32Array(size * size).fill(name === 'ioverf' ? -1e10 : -999)]));
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) {
    const i = y * size + x;
    planes.ioverf[i] = 0.02 + x * 0.001; planes.xcoord[i] = 0.01 * x * (scale.xcoord ?? 1); planes.ycoord[i] = 0.01 * y * (scale.ycoord ?? 1); planes.zcoord[i] = 0.08 * (scale.zcoord ?? 1);
    planes.latitude[i] = 10; planes.longitude[i] = 20 + x; planes.radius[i] = 0.085; planes.incidence[i] = 30 * (scale.incidence ?? 1); planes.emission[i] = (10 + x) * (scale.emission ?? 1); planes.phase[i] = 59 * (scale.phase ?? 1);
    planes.horizpixscale[i] = 0.35; planes.vertpixscale[i] = 0.35; planes.slope[i] = 5; planes.elevation[i] = 1; planes.gravacc[i] = 1e-5; planes.gravpot[i] = -1;
  }
  mutate?.(planes);
  const data = Buffer.alloc(Math.ceil(planeBytes * 16 / 2880) * 2880);
  order.forEach((name, k) => { for (let i = 0; i < size * size; i++) data.writeFloatBE(planes[name][i], k * planeBytes + i * 4); });
  return Buffer.concat([headerBytes, data]);
}

function label(edit: (xml: string) => string = xml => xml, units: Record<string, string | null> = defaultUnits, filter?: string) {
  const arrays = order.map((name, k) => `<Array_2D_Image><local_identifier>${name}</local_identifier><offset unit="byte">${headerLength + k * planeBytes}</offset><axes>2</axes>` +
    `<axis_index_order>Last Index Fastest</axis_index_order><Element_Array><data_type>IEEE754MSBSingle</data_type>${units[name] ? `<unit>${units[name]}</unit>` : ''}</Element_Array>` +
    `<Axis_Array><axis_name>Line</axis_name><elements>${size}</elements><sequence_number>1</sequence_number></Axis_Array>` +
    `<Axis_Array><axis_name>Sample</axis_name><elements>${size}</elements><sequence_number>2</sequence_number></Axis_Array><Special_Constants>${name === 'ioverf'
      ? '<missing_constant>1E10</missing_constant><not_applicable_constant>-1E10</not_applicable_constant><high_instrument_saturation>1E09</high_instrument_saturation>'
      : '<invalid_constant>-999</invalid_constant><not_applicable_constant>-1E10</not_applicable_constant>'}</Special_Constants></Array_2D_Image>`);
  return edit(`<?xml version="1.0" encoding="UTF-8"?><Product_Observational><Identification_Area><logical_identifier>urn:nasa:pds:dart:data_dracoddp:dart_0401930040_12262_01_geo</logical_identifier>` +
    `<version_id>1.0</version_id><product_class>Product_Observational</product_class></Identification_Area><Observation_Area><Time_Coordinates>` +
    `<start_date_time>2022-09-26T23:14:12.737Z</start_date_time><stop_date_time>2022-09-26T23:14:12.741986Z</stop_date_time></Time_Coordinates><Observing_System>` +
    `<Observing_System_Component><name>DART</name><type>Host</type></Observing_System_Component><Observing_System_Component><name>DRACO</name><type>Instrument</type></Observing_System_Component>` +
    `</Observing_System><Target_Identification><name>(65803) Didymos I (Dimorphos)</name><type>Satellite</type></Target_Identification>${filter ? `<Discipline_Area><img:Optical_Filter><img:filter_name>${filter}</img:filter_name></img:Optical_Filter></Discipline_Area>` : ''}<Mission_Area>` +
    `<geom:Geometry><geom:SPICE_Kernel_Identification><geom:spice_kernel_file_name>naif0012.tls</geom:spice_kernel_file_name></geom:SPICE_Kernel_Identification>` +
    `<geom:SPICE_Kernel_Identification><geom:spice_kernel_file_name>dimorphos_g_00243mm_spc_0000n00000_v004.bds</geom:spice_kernel_file_name></geom:SPICE_Kernel_Identification></geom:Geometry>` +
    `</Mission_Area></Observation_Area><File_Area_Observational><File><file_name>${fileName}</file_name></File><Header><offset unit="byte">0</offset>` +
    `<object_length unit="byte">${headerLength}</object_length><parsing_standard_id>FITS 3.0</parsing_standard_id></Header>${arrays.join('')}</File_Area_Observational></Product_Observational>`);
}
const decode = (bytes = bytesOf(), xml = label(), options: Partial<Parameters<typeof decodePds4GeometryCube>[2]> = {}) => decodePds4GeometryCube(bytes, xml, { fileName, cube, filter: 'unfiltered', ...options });

test('FITS storage and label data types must agree before reading geometry', () => {
  assert.throws(() => decode(bytesOf(), label(xml => xml.replace('IEEE754MSBSingle', 'IEEE754LSBSingle'))), /disagrees with FITS storage/);
  assert.throws(() => decode(bytesOf({ BITPIX: 32 })), /disagrees with FITS storage/);
  assert.throws(() => decode(bytesOf({ NAXIS: 2 })), /layout/);
});

test('selects a target using a native geometry plane before fitting, retaining valid dark image pixels', () => {
  const selection = { plane: 'radius', unit: 'km', minimum: 0.2, maximum: 0.5, interpretation: 'Separate disjoint body radii.' };
  const i = 3 * size + 4, dark = 3 * size + 5;
  const bytes = bytesOf({}, p => { p.radius[i] = 0.4; p.radius[dark] = 0.4; p.ioverf[dark] = 0; });
  const frame = decode(bytes, label(), { cube: { ...cube, geometrySelection: selection } });
  assert.equal(frame.valid(i), true);
  assert.equal(frame.valid(dark), true);
  assert.equal(frame.valid(2 * size + 2), false);
  assert.equal(frame.qualityReport.geometryPixels, 2);
  assert.equal(frame.qualityReport.geometrySelection?.excludedGeometryPixels, 14);
  assert.equal(frame.planes.IMAGE[dark], 0);
  assert.throws(() => decode(bytes, label(), { cube: { ...cube, geometrySelection: { ...selection, unit: 'm' } } }), /selection plane/);
  assert.throws(() => decode(bytes, label(), { cube: { ...cube, geometrySelection: { ...selection, minimum: 0.5, maximum: 0.2 } } }), /selection plane/);
  assert.throws(() => decode(bytes, label(), { cube: { ...cube, geometrySelection: { ...selection, plane: 'ioverf', unit: '' } } }), /selection plane/);
  assert.throws(() => decode(bytesOf({}, p => { p.radius.fill(-999); }), label(), { cube: { ...cube, geometrySelection: selection } }), /no on-body/);
});

test('decodes the declared planes into kilometre intercepts, radian angles and image values', () => {
  const frame = decode();
  assert.equal(frame.width, size);
  assert.equal(frame.startTime, '2022-09-26T23:14:12.737Z');
  assert.equal(frame.filter, 'unfiltered');
  assert.equal(frame.shapeKernel, 'dimorphos_g_00243mm_spc_0000n00000_v004.bds');
  const i = 3 * size + 4;
  assert.deepEqual(frame.xyz(i).map(n => Math.round(n * 1e6) / 1e6), [0.04, 0.03, 0.08]);
  assert.ok(Math.abs(frame.planes.EMISSION_ANGLE_IMAGE[i] - 14 * Math.PI / 180) < 1e-6);
  assert.ok(Math.abs(frame.planes.IMAGE[i] - 0.024) < 1e-6);
  assert.equal(frame.valid(i), true);
  assert.equal(frame.valid(0), false);
  assert.equal(frame.valid(-1), false);
  assert.equal(frame.acceptPixel(i), true);
  assert.equal(frame.qualityReport.geometryPixels, 16);
  assert.equal(frame.qualityReport.saturatedPixels, 0);
  assert.ok(Math.abs(frame.qualityReport.minimumEmissionDegrees - 12) < 1e-4);
  assert.ok(Math.abs((frame.qualityReport.nadirPixelFootprintMeters ?? 0) - 10) < 1e-6, 'adjacent intercepts 0.01 km apart');
  assert.ok(Math.abs((frame.qualityReport.archivedPixelScaleRatio ?? 0) - 0.035) < 1e-6);
  assert.deepEqual(frame.qualityReport.planes, { image: 'ioverf', x: 'xcoord', y: 'ycoord', z: 'zcoord', incidence: 'incidence', emission: 'emission', phase: 'phase' });
  assert.equal(frame.qualityReport.units, 'I/F');
});

test('converts metre intercepts and radian angles from the label units', () => {
  const units = { ...defaultUnits, xcoord: 'm', ycoord: 'm', zcoord: 'm', incidence: 'rad', emission: 'rad', phase: 'rad' };
  const factor = { xcoord: 1000, ycoord: 1000, zcoord: 1000, incidence: Math.PI / 180, emission: Math.PI / 180, phase: Math.PI / 180 };
  const frame = decode(bytesOf({}, undefined, factor), label(undefined, units));
  const i = 3 * size + 4;
  assert.deepEqual(frame.xyz(i).map(n => Math.round(n * 1e6) / 1e6), [0.04, 0.03, 0.08]);
  assert.ok(Math.abs(frame.planes.EMISSION_ANGLE_IMAGE[i] - 14 * Math.PI / 180) < 1e-6);
  assert.deepEqual(frame.qualityReport.planeUnits, { image: null, x: 'm', y: 'm', z: 'm', incidence: 'rad', emission: 'rad', phase: 'rad' });
});

test('saturation keeps geometry but fails quality; gap constants drop the pixel; a stated filter must match the recipe', () => {
  const frame = decode(bytesOf({}, planes => { planes.ioverf[2 * size + 2] = 1e9; planes.ioverf[2 * size + 3] = 1e10; planes.xcoord[2 * size + 4] = -999; }));
  assert.equal(frame.valid(2 * size + 2), true);
  assert.equal(frame.acceptPixel(2 * size + 2), false);
  assert.equal(frame.valid(2 * size + 3), false);
  assert.equal(frame.valid(2 * size + 4), false);
  assert.equal(frame.qualityReport.geometryPixels, 14);
  assert.equal(frame.qualityReport.saturatedPixels, 1);
  assert.throws(() => decode(bytesOf(), label(undefined, defaultUnits, 'V')), /filter differs/);
  assert.equal(decode(bytesOf(), label(undefined, defaultUnits, 'V'), { filter: 'V' }).filter, 'V');
  assert.throws(() => decode(bytesOf(), label(), { filter: 'V' }), /filter differs/);
});

test('rejects a label, declaration or cube that does not describe this exact product', () => {
  assert.throws(() => decode(bytesOf(), label(), { fileName: 'dart_0401930040_12262_02_geo.fits' }), /identify this product/);
  assert.throws(() => decode(bytesOf(), label(xml => xml.replace('(65803) Didymos I (Dimorphos)', '65803 Didymos'))), /another target/);
  assert.throws(() => decode(bytesOf(), label(xml => xml.replace('naif0012.tls', 'other.bds'))), /declared DSK/);
  assert.throws(() => decode(bytesOf(), label(), { cube: { ...cube, shapeKernel: 'dimorphos_g_00243mm_spc_0000n00000_v003.bds' } }), /declared DSK/);
  assert.throws(() => decode(bytesOf(), label(), { cube: { ...cube, planes: { ...cube.planes, x: 'nope' } } }), /lacks the x plane nope/);
  assert.throws(() => decode(bytesOf(), label(undefined, { ...defaultUnits, xcoord: 'deg' })), /Unsupported x plane unit deg/);
  assert.throws(() => decode(bytesOf(), label(xml => xml.replace('<invalid_constant>-999</invalid_constant>', '<odd_constant>-999</odd_constant>'))), /special constant odd_constant/);
  assert.throws(() => decode(bytesOf(), label(xml => xml.replace(`<object_length unit="byte">${headerLength}</object_length>`, `<object_length unit="byte">${headerLength + 2880}</object_length>`))), /disagrees with its label/);
  assert.throws(() => decode(bytesOf({ INSTRUME: 'LICIA' })), /header INSTRUME differs/);
  assert.throws(() => decode(bytesOf({ ACQ_UTC: '2022-09-26T23:14:12.738' })), /header time differs/);
  assert.throws(() => decode(bytesOf({ PLANE02: 'Y coordinate of pixel center' })), /PLANE02 is not xcoord/);
  assert.throws(() => decode(bytesOf({ NAXIS3: 15 })), /cube layout/);
  assert.throws(() => decode(bytesOf({ BSCALE: 2 })), /cube layout/);
  assert.throws(() => decode(bytesOf().subarray(0, headerLength + 100)), /Truncated.*(?:FITS|geometry cube plane)/);
  assert.throws(() => decode(bytesOf({}, planes => planes.ioverf.fill(1e10))), /no on-body pixels/);
});
