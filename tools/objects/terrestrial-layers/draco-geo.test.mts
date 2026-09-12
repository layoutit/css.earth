import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DRACO_GEO_PLANES, DRACO_PLANE_DESCRIPTIONS, decodeDracoGeo } from './draco-geo.mts';

const size = 8, fileName = 'dart_0401930040_12262_01_geo.fits', planeBytes = size * size * 4;
const units: Record<string, string> = { xcoord: 'km', ycoord: 'km', zcoord: 'km', latitude: 'deg', longitude: 'deg', radius: 'km', incidence: 'deg', emission: 'deg', phase: 'deg',
  horizpixscale: 'm', vertpixscale: 'm', slope: 'deg', elevation: 'm', gravacc: 'm/s**2', gravpot: 'J/kg' };
const card = (key: string, value: string | number | boolean) =>
  `${key.padEnd(8)}= ${typeof value === 'string' ? `'${value}'` : value === true ? 'T' : value === false ? 'F' : String(value)}`.padEnd(80);

/** A tiny cube in the archived layout: geometry planes at -999 off the body, I/F not applicable outside the readout window. */
const identity: Record<string, string | number | boolean> = { MISSION: 'DART', INSTRUME: 'DRACO', TARGET: '(65803) Didymos I (Dimorphos)', BADIMAGE: 'FALSE', IOVERF: 'PERFORM', RADIANCE: 'PERFORM',
  CALIB: 'ON', BINNING: 'ON', IMGTMSEC: '401930040', IMGTMSUB: '12262', ACQ_UTC: '2022-09-26T23:14:12.737', MISPXVAL: '1E10', PXOUTWIN: '-1E10', SATPXVAL: '1E09', GEOINVAL: '-999',
  SHAPREF1: 'didymos_g_1165mm_spc_obj_0000n00000_v003.obj', SHAPREF2: 'dimorphos_g_0243mm_spc_obj_0000n00000_v004.obj', SRCFILE: 'dart_0401930040_12262_01.fits', METAKRNL: 'dart_v02.tm',
  PSCRNG: '7.0413e+01', PXMRAD: '4.95', PSUBLAT: '-9.30', PSUBLON: '280.18',
  ...Object.fromEntries(DRACO_GEO_PLANES.map((name, index) => [`PLANE${String(index + 1).padStart(2, '0')}`, DRACO_PLANE_DESCRIPTIONS[name]])) };
const headerLength = Math.ceil((Object.keys(identity).length + 7) * 80 / 2880) * 2880;

function cube(overrides: Record<string, string | number | boolean> = {}, mutate?: (planes: Record<string, Float32Array>) => void) {
  const header = { SIMPLE: true, BITPIX: -32, NAXIS: 3, NAXIS1: size, NAXIS2: size, NAXIS3: 16, ...identity, ...overrides };
  const headerBytes = Buffer.from([...Object.entries(header).map(([key, value]) => card(key, value)), 'END'.padEnd(80)].join('').padEnd(headerLength), 'ascii');
  const planes: Record<string, Float32Array> = Object.fromEntries(DRACO_GEO_PLANES.map(name => [name, new Float32Array(size * size).fill(name === 'ioverf' ? -1e10 : -999)]));
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) {
    const i = y * size + x;
    Object.assign(planes, {});
    planes.ioverf[i] = 0.02 + x * 0.001; planes.xcoord[i] = 0.01 * x; planes.ycoord[i] = 0.01 * y; planes.zcoord[i] = 0.08;
    planes.latitude[i] = 10; planes.longitude[i] = 20 + x; planes.radius[i] = 0.085; planes.incidence[i] = 30; planes.emission[i] = 10 + x; planes.phase[i] = 59;
    planes.horizpixscale[i] = 0.35; planes.vertpixscale[i] = 0.35; planes.slope[i] = 5; planes.elevation[i] = 1; planes.gravacc[i] = 1e-5; planes.gravpot[i] = -1;
  }
  mutate?.(planes);
  const data = Buffer.alloc(Math.ceil(planeBytes * 16 / 2880) * 2880);
  DRACO_GEO_PLANES.forEach((name, k) => { for (let i = 0; i < size * size; i++) data.writeFloatBE(planes[name][i], k * planeBytes + i * 4); });
  return Buffer.concat([headerBytes, data]);
}

function label(edit: (xml: string) => string = xml => xml, order: readonly string[] = DRACO_GEO_PLANES) {
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
    `</Observing_System><Target_Identification><name>(65803) Didymos I (Dimorphos)</name><type>Satellite</type></Target_Identification><Mission_Area><dart:DRACO_Instrument_Attributes>` +
    `<dart:imaging_mode>GLOBAL</dart:imaging_mode><dart:observation_type>TERMINAL</dart:observation_type><dart:exposure_time>4.985619E-0003</dart:exposure_time>` +
    `<dart:window2_x_start>166</dart:window2_x_start><dart:window2_y_start>451</dart:window2_y_start><dart:window2_x_end>678</dart:window2_x_end><dart:window2_y_end>963</dart:window2_y_end>` +
    `</dart:DRACO_Instrument_Attributes><geom:Geometry><geom:SPICE_Kernel_Identification><geom:spice_kernel_file_name>naif0012.tls</geom:spice_kernel_file_name></geom:SPICE_Kernel_Identification>` +
    `<geom:SPICE_Kernel_Identification><geom:spice_kernel_file_name>dimorphos_g_00243mm_spc_0000n00000_v004.bds</geom:spice_kernel_file_name></geom:SPICE_Kernel_Identification></geom:Geometry>` +
    `</Mission_Area></Observation_Area><File_Area_Observational><File><file_name>${fileName}</file_name></File><Header><offset unit="byte">0</offset>` +
    `<object_length unit="byte">${headerLength}</object_length><parsing_standard_id>FITS 3.0</parsing_standard_id></Header>${arrays.join('')}</File_Area_Observational></Product_Observational>`);
}

test('decodes the labelled DRACO cube into kilometre intercepts, radian angles and I/F', () => {
  const frame = decodeDracoGeo(cube(), label(), { fileName });
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
  assert.equal(frame.qualityReport.minimumEmissionDegrees, 12);
  assert.equal(frame.qualityReport.minimumEmissionLongitudeDegrees, 22);
  assert.equal(frame.qualityReport.sourceSubSpacecraftLongitudeDegrees, 280.18);
  assert.equal(frame.qualityReport.sourceRangeKm, 70.413);
  assert.ok(Math.abs((frame.qualityReport.nadirPixelFootprintMeters ?? 0) - 10) < 1e-6, 'adjacent intercepts 0.01 km apart');
  assert.ok(Math.abs((frame.qualityReport.archivedPixelScaleRatio ?? 0) - 0.035) < 1e-6);
  assert.equal(frame.qualityReport.sourceCalibratedFile, 'dart_0401930040_12262_01.fits');
  assert.equal('PIXEL_SCALE_IMAGE' in frame.planes, false);
  assert.equal(frame.qualityReport.exposureSeconds, 0.004985619);
  assert.deepEqual(frame.qualityReport.readoutWindow, { xStart: 166, yStart: 451, xEnd: 678, yEnd: 963 });
});

test('saturation keeps geometry but fails quality; missing I/F or invalid intercepts drop the pixel', () => {
  const frame = decodeDracoGeo(cube({}, planes => { planes.ioverf[2 * size + 2] = 1e9; planes.ioverf[2 * size + 3] = 1e10; planes.xcoord[2 * size + 4] = -999; }), label(), { fileName });
  assert.equal(frame.valid(2 * size + 2), true);
  assert.equal(frame.acceptPixel(2 * size + 2), false);
  assert.equal(frame.valid(2 * size + 3), false);
  assert.equal(frame.valid(2 * size + 4), false);
  assert.equal(frame.qualityReport.geometryPixels, 14);
  assert.equal(frame.qualityReport.saturatedPixels, 1);
});

test('rejects a label or cube that does not describe this exact product layout', () => {
  assert.throws(() => decodeDracoGeo(cube(), label(), { fileName: 'dart_0401930040_12262_02_geo.fits' }), /identify this product/);
  assert.throws(() => decodeDracoGeo(cube(), label(xml => xml.replace('(65803) Didymos I (Dimorphos)', '65803 Didymos')), { fileName }), /another target/);
  assert.throws(() => decodeDracoGeo(cube(), label(xml => xml.replace('naif0012.tls', 'other.bds')), { fileName }), /one DSK/);
  assert.throws(() => decodeDracoGeo(cube(), label(undefined, [DRACO_GEO_PLANES[0], DRACO_GEO_PLANES[2], DRACO_GEO_PLANES[1], ...DRACO_GEO_PLANES.slice(3)]), { fileName }), /backplane layout: xcoord/);
  assert.throws(() => decodeDracoGeo(cube(), label(xml => xml.replace('<unit>km</unit>', '<unit>m</unit>')), { fileName }), /backplane layout: xcoord/);
  assert.throws(() => decodeDracoGeo(cube(), label(xml => xml.replace('<invalid_constant>-999</invalid_constant>', '<invalid_constant>-9999</invalid_constant>')), { fileName }), /backplane layout: xcoord/);
  assert.throws(() => decodeDracoGeo(cube(), label(xml => xml.replace(`<object_length unit="byte">${headerLength}</object_length>`, `<object_length unit="byte">${headerLength + 2880}</object_length>`)), { fileName }), /disagrees with its label/);
  assert.throws(() => decodeDracoGeo(cube({ IMGTMSUB: '12263' }), label(), { fileName }), /identify this calibrated acquisition/);
  assert.throws(() => decodeDracoGeo(cube({ ACQ_UTC: '2022-09-26T23:14:12.738' }), label(), { fileName }), /identify this calibrated acquisition/);
  assert.throws(() => decodeDracoGeo(cube({ SATPXVAL: '1E08' }), label(), { fileName }), /special values differ/);
  assert.throws(() => decodeDracoGeo(cube({ SHAPREF2: 'dimorphos_g_0243mm_spc_obj_0000n00000_v003.obj' }), label(), { fileName }), /shape reference differs/);
  assert.throws(() => decodeDracoGeo(cube({ PLANE02: 'Y coordinate of pixel center' }), label(), { fileName }), /plane 2 is not xcoord/);
  assert.throws(() => decodeDracoGeo(cube({ NAXIS3: 15 }), label(), { fileName }), /cube layout/);
  assert.throws(() => decodeDracoGeo(cube({ BSCALE: 2 }), label(), { fileName }), /cube layout/);
  assert.throws(() => decodeDracoGeo(cube().subarray(0, headerLength + 100), label(), { fileName }), /Truncated/);
  assert.throws(() => decodeDracoGeo(cube({}, planes => planes.ioverf.fill(1e10)), label(), { fileName }), /no on-body pixels/);
});
