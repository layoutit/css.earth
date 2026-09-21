import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  assertSharadRecordMatchesLabel, openSharadPds4Volume, parseSharadPds4Label, parseSharadProductRecords, readSharadDelayFrame, readSharadPlane,
  sharadExpectedBytes, sharadFileSource, sharadFrameRange, sharadPlanetaryGridQualification, sharadPlaneCost,
  type SharadByteSource, type SharadPds4Label,
} from './f16-sharad-pds4.mts';

/** The fixture mirrors the published label element for element, including both `description` elements and the cartography block. */
const label = ({ shape = [2, 3, 4], extra = '' }: { shape?: readonly [number, number, number]; extra?: string } = {}) => `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<Product_Observational xmlns="http://pds.nasa.gov/pds4/pds/v1" xmlns:mro="http://pds.nasa.gov/pds4/mission/mro/v1" xmlns:cart="http://pds.nasa.gov/pds4/cart/v1">
  <Identification_Area>
    <logical_identifier>urn:nasa:pds:mro_sharad_3d:data:synthetic_time</logical_identifier>
    <version_id>1.0</version_id>
    <title>SYNTHETIC_TIME</title>
    <product_class>Product_Observational</product_class>
    <Modification_History><Modification_Detail><modification_date>2025-10-09</modification_date><version_id>1.0</version_id><description>Migration to PDS4</description></Modification_Detail></Modification_History>
  </Identification_Area>
  <Observation_Area>
    <Time_Coordinates><start_date_time>2007-03-24T13:17:45.086Z</start_date_time><stop_date_time>2020-05-23T05:08:23.939Z</stop_date_time></Time_Coordinates>
    <Observing_System><Observing_System_Component><name>Fixture instrument</name><Internal_Reference><lid_reference>urn:nasa:pds:context:instrument:sharad.mro</lid_reference></Internal_Reference></Observing_System_Component></Observing_System>
    <Target_Identification><name>Mars</name><Internal_Reference><lid_reference>urn:nasa:pds:context:target:planet.mars</lid_reference></Internal_Reference></Target_Identification>
    <Mission_Area><mro:MRO_Parameters><mro:SHARAD_Parameters>
      <mro:Array_Sampled><mro:name>X</mro:name><mro:array_interval>475</mro:array_interval><mro:array_unit>METER</mro:array_unit><mro:array_first_value>-303762.5</mro:array_first_value><mro:array_scale>Linear</mro:array_scale></mro:Array_Sampled>
      <mro:Array_Sampled><mro:name>Y</mro:name><mro:array_interval>475</mro:array_interval><mro:array_unit>METER</mro:array_unit><mro:array_first_value>-337012.5</mro:array_first_value><mro:array_scale>Linear</mro:array_scale></mro:Array_Sampled>
      <mro:Array_Sampled><mro:name>DELAY_TIME</mro:name><mro:array_interval>0.0375</mro:array_interval><mro:array_unit>MICROSECOND</mro:array_unit><mro:array_first_value>0.0</mro:array_first_value><mro:array_scale>Linear</mro:array_scale></mro:Array_Sampled>
    </mro:SHARAD_Parameters></mro:MRO_Parameters></Mission_Area>
    <Discipline_Area><cart:Cartography>
      <cart:Spatial_Domain><cart:Bounding_Coordinates><cart:west_bounding_coordinate unit="deg">35.0</cart:west_bounding_coordinate><cart:east_bounding_coordinate unit="deg">45.0</cart:east_bounding_coordinate><cart:north_bounding_coordinate unit="deg">47.0</cart:north_bounding_coordinate><cart:south_bounding_coordinate unit="deg">37.0</cart:south_bounding_coordinate></cart:Bounding_Coordinates></cart:Spatial_Domain>
      <cart:Spatial_Reference_Information><cart:Horizontal_Coordinate_System_Definition><cart:Planar>
        <cart:Map_Projection><cart:map_projection_name>Transverse Mercator</cart:map_projection_name><cart:Transverse_Mercator><cart:scale_factor_at_central_meridian>1</cart:scale_factor_at_central_meridian><cart:longitude_of_central_meridian unit="deg">30.0</cart:longitude_of_central_meridian><cart:latitude_of_projection_origin unit="deg">42.0</cart:latitude_of_projection_origin></cart:Transverse_Mercator></cart:Map_Projection>
        <cart:Planar_Coordinate_Information><cart:Coordinate_Representation><cart:pixel_resolution_x unit="m/pixel">475.0</cart:pixel_resolution_x><cart:pixel_resolution_y unit="m/pixel">475.0</cart:pixel_resolution_y></cart:Coordinate_Representation></cart:Planar_Coordinate_Information>
        <cart:Geo_Transformation><cart:upperleft_corner_x unit="m">-337012.5</cart:upperleft_corner_x><cart:upperleft_corner_y unit="m">303762.5</cart:upperleft_corner_y></cart:Geo_Transformation>
      </cart:Planar><cart:Geodetic_Model><cart:latitude_type>Planetocentric</cart:latitude_type><cart:spheroid_name>Mars</cart:spheroid_name><cart:a_axis_radius unit="km">3396.0</cart:a_axis_radius><cart:b_axis_radius unit="km">3396.0</cart:b_axis_radius><cart:c_axis_radius unit="km">3376.0</cart:c_axis_radius><cart:longitude_direction>Positive East</cart:longitude_direction></cart:Geodetic_Model></cart:Horizontal_Coordinate_System_Definition></cart:Spatial_Reference_Information>
    </cart:Cartography></Discipline_Area>
  </Observation_Area>
  <File_Area_Observational>
    <File><file_name>synthetic_time.dat</file_name><local_identifier>array</local_identifier></File>
    <Array_3D>
      <name>3D RADAR VOLUME</name>
      <offset unit="byte">0</offset>
      <axes>3</axes>
      <axis_index_order>Last Index Fastest</axis_index_order>
      <description>
        The first and second (X and Y) axes are projected distances corresponding
        to LINE and SAMPLE pixel directions. The third axis, DELAY_TIME, is
        referenced to the areoid + 10.125 km. A FRAME consists of all values
        along the third axis for a given X and Y location.
        BACKSCATTER STRENGTH is the square root of backscatter power.
      </description>
      <Element_Array><data_type>IEEE754LSBSingle</data_type></Element_Array>
      <Axis_Array><axis_name>X</axis_name><elements>${shape[0]}</elements><sequence_number>1</sequence_number></Axis_Array>
      <Axis_Array><axis_name>Y</axis_name><elements>${shape[1]}</elements><sequence_number>2</sequence_number></Axis_Array>
      <Axis_Array><axis_name>DELAY_TIME</axis_name><elements>${shape[2]}</elements><sequence_number>3</sequence_number></Axis_Array>
      <Object_Statistics><maximum>0.218038</maximum><minimum>-0.097937</minimum><description>BACKSCATTER STRENGTH RELATIVE TO FRAME MEAN</description></Object_Statistics>
    </Array_3D>
  </File_Area_Observational>
  <File_Area_Observational_Supplemental><File><file_name>synthetic_time.lbl</file_name></File><Stream_Text><offset unit="byte">0</offset><parsing_standard_id>PDS3</parsing_standard_id></Stream_Text></File_Area_Observational_Supplemental>
  ${extra}
</Product_Observational>`;

const bytes = () => {
  const data = Buffer.alloc(2 * 3 * 4 * 4);
  for (let x = 0; x < 2; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 4; z++) data.writeFloatLE(x === 1 && y === 0 && z === 0 ? Number.NaN : 100 * x + 10 * y + z, ((x * 3 + y) * 4 + z) * 4);
  return data;
};
const record = (overrides: Record<string, unknown> = {}) => ({
  schema: 'cssearth-bounded-archive-product@1', target: 'mars',
  products: [{
    id: 'mro-sharad-3d-synthetic-time', telescope: 'Mars Reconnaissance Orbiter', mode: 'SHARAD/3-D delay-time radargram',
    lidvid: 'urn:nasa:pds:mro_sharad_3d:data:synthetic_time::1.0', reader: 'mro-sharad-3d-array@1',
    boundedMember: { role: 'science', origin: 'https://example.invalid/data/synthetic_time.dat', advertisedBytes: 2 * 3 * 4 * 4, advertisedBytesCheckedOn: '2026-09-21', digest: 'none-published', acquisition: 'Range reads of label-defined offsets only.' },
    pinnedInputs: [{ input: 'fixture-label', role: 'label' }, { input: 'fixture-observations', role: 'response' }],
    units: 'dimensionless ratio to the frame mean', meaning: 'Fixture record.', citation: 'Fixture citation.', license: 'Fixture license.', credit: 'Fixture credit.',
    limitations: ['Fixture limitation.'], ...overrides,
  }],
});
const counting = (label: SharadPds4Label): SharadByteSource & { reads: number } => ({
  identity: 'counting', size: sharadExpectedBytes(label), reads: 0,
  read() { this.reads++; throw new Error('the bounds must refuse before any byte is read'); },
  close: () => Promise.resolve(),
});

test('SHARAD reader keeps the published label facts: identity, native shape, scalar order, statistics and cartography', () => {
  const parsed = parseSharadPds4Label(label());
  assert.equal(parsed.lidvid, 'urn:nasa:pds:mro_sharad_3d:data:synthetic_time::1.0');
  assert.equal(parsed.title, 'SYNTHETIC_TIME');
  assert.equal(parsed.dataFile, 'synthetic_time.dat');
  assert.equal(parsed.supplementalFile, 'synthetic_time.lbl');
  assert.equal(parsed.dataOffset, 0);
  assert.deepEqual(parsed.shape, [2, 3, 4]);
  assert.deepEqual(parsed.axes.map(axis => [axis.axisName, axis.role, axis.unit, axis.elements, axis.start, axis.increment]),
    [['X', 'projected-x', 'm', 2, -303762.5, 475], ['Y', 'projected-y', 'm', 3, -337012.5, 475], ['DELAY_TIME', 'delay', 'us', 4, 0, .0375]]);
  assert.equal(parsed.statistics.quantity, 'BACKSCATTER STRENGTH RELATIVE TO FRAME MEAN');
  assert.deepEqual([parsed.statistics.minimum, parsed.statistics.maximum], [-0.097937, 0.218038]);
  assert.match(parsed.arrayDescription, /DELAY_TIME, is referenced to the areoid \+ 10\.125 km/u);
  assert.equal(parsed.cartography.projection, 'Transverse Mercator');
  assert.deepEqual([parsed.cartography.centralMeridianDegrees, parsed.cartography.projectionOriginLatitudeDegrees, parsed.cartography.scaleFactorAtCentralMeridian], [30, 42, 1]);
  assert.deepEqual(parsed.cartography.radiiKm, [3396, 3396, 3376]);
  assert.deepEqual(parsed.cartography.pixelSpacingMetres, [475, 475]);
  assert.deepEqual(parsed.cartography.upperLeftCornerMetres, [-337012.5, 303762.5]);
  assert.deepEqual(parsed.cartography.boundingDegrees, { west: 35, east: 45, north: 47, south: 37 });
  assert.deepEqual([parsed.startIso, parsed.stopIso], ['2007-03-24T13:17:45.086Z', '2020-05-23T05:08:23.939Z']);
});

test('SHARAD reader preserves native little-endian last-index-fastest planes and contiguous delay frames', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'sharad-pds4-'));
  try {
    const parsed = parseSharadPds4Label(label()), path = resolve(root, parsed.dataFile);
    await writeFile(path, bytes());
    const volume = openSharadPds4Volume(await sharadFileSource(path), parsed);
    try {
      assert.deepEqual(sharadFrameRange(parsed, 1, 2), { position: 80, length: 16 });
      const x = await readSharadPlane(volume, 'projected-x', 1);
      assert.deepEqual(x.values, [null, 101, 102, 103, 110, 111, 112, 113, 120, 121, 122, 123]);
      assert.deepEqual([x.shape, x.axes, x.cost], [[3, 4], ['projected-y', 'delay'], { reads: 1, bytes: 48 }]);
      const y = await readSharadPlane(volume, 'projected-y', 2);
      assert.deepEqual(y.values, [20, 21, 22, 23, 120, 121, 122, 123]);
      assert.deepEqual([y.shape, y.axes, y.cost], [[2, 4], ['projected-x', 'delay'], { reads: 2, bytes: 32 }]);
      const delay = await readSharadPlane(volume, 'delay', 3);
      assert.deepEqual(delay.values, [3, 13, 23, 103, 113, 123]);
      assert.deepEqual([delay.shape, delay.axes, delay.cost], [[2, 3], ['projected-x', 'projected-y'], { reads: 6, bytes: 24 }]);
      const frame = await readSharadDelayFrame(volume, 1, 2);
      assert.deepEqual(frame.values, [120, 121, 122, 123]);
      assert.deepEqual([frame.range, frame.delayStartMicroseconds, frame.delayIncrementMicroseconds], [{ position: 80, length: 16 }, 0, .0375]);
    } finally { await volume.source.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('archive-scale reads stay bounded: one contiguous X plane, one read per frame for Y, and a refused constant-delay plane', async () => {
  const parsed = parseSharadPds4Label(label({ shape: [1280, 1420, 3600] }));
  assert.equal(sharadExpectedBytes(parsed), 26_173_440_000);
  assert.deepEqual(sharadPlaneCost(parsed, 'projected-x'), { reads: 1, bytes: 20_448_000 });
  assert.deepEqual(sharadPlaneCost(parsed, 'projected-y'), { reads: 1280, bytes: 18_432_000 });
  assert.deepEqual(sharadPlaneCost(parsed, 'delay'), { reads: 1_817_600, bytes: 7_270_400 });
  assert.deepEqual(sharadFrameRange(parsed, 2, 3), { position: (2 * 1420 + 3) * 14_400, length: 14_400 });
  const source = counting(parsed), volume = openSharadPds4Volume(source, parsed);
  await assert.rejects(readSharadPlane(volume, 'delay', 0), /1817600 reads, exceeding the bounded read limit/u);
  await assert.rejects(readSharadPlane(volume, 'projected-x', 0, { maximumBytes: 1 << 20, maximumReads: 4 }), /20448000 bytes, exceeding the bounded read limit/u);
  assert.equal(source.reads, 0);
});

test('SHARAD reader refuses changed scalar encoding, axis order, missing semantics, out-of-grid frames, and byte-length mismatch', async () => {
  assert.throws(() => parseSharadPds4Label(label().replace('IEEE754LSBSingle', 'IEEE754MSBSingle')), /little-endian float32/u);
  assert.throws(() => parseSharadPds4Label(label().replace('Last Index Fastest', 'First Index Fastest')), /last-index-fastest/u);
  assert.throws(() => parseSharadPds4Label(label().replace('referenced to the areoid + 10.125 km', 'referenced to an unstated datum')), /areoid-reference semantics/u);
  assert.throws(() => parseSharadPds4Label(label().replace('<axis_name>DELAY_TIME</axis_name>', '<axis_name>DEPTH</axis_name>')), /X, Y, DELAY_TIME/u);
  assert.throws(() => parseSharadPds4Label(label().replace('Transverse Mercator', 'Polar Stereographic')), /Transverse Mercator/u);
  assert.throws(() => parseSharadPds4Label(label().replace('<cart:latitude_type>Planetocentric</cart:latitude_type>', '<cart:latitude_type>Planetographic</cart:latitude_type>')), /planetocentric/u);
  assert.throws(() => parseSharadPds4Label(label().replace('<offset unit="byte">0</offset>', '<offset unit="byte">0</offset><scaling_factor>2</scaling_factor>')), /unqualified array scaling/u);
  const root = await mkdtemp(resolve(tmpdir(), 'sharad-pds4-refusal-'));
  try {
    const parsed = parseSharadPds4Label(label()), path = resolve(root, parsed.dataFile);
    await writeFile(path, bytes().subarray(0, -4));
    const short = await sharadFileSource(path);
    try { assert.throws(() => openSharadPds4Volume(short, parsed), /length 92 disagrees with label length 96/u); } finally { await short.close(); }
    await writeFile(path, bytes());
    const source = await sharadFileSource(path), volume = openSharadPds4Volume(source, parsed);
    try {
      await assert.rejects(readSharadDelayFrame(volume, 2, 0), /outside the native grid/u);
      await assert.rejects(readSharadPlane(volume, 'delay', 4), /outside the native grid/u);
    } finally { await source.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the bounded product record must agree with its label before any read, and publishes the F16 qualification', () => {
  const parsed = parseSharadPds4Label(label()), product = parseSharadProductRecords(record()).products[0]!;
  assert.equal(product.boundedMember.digest, 'none-published');
  assert.doesNotThrow(() => assertSharadRecordMatchesLabel(product, parsed));
  assert.throws(() => assertSharadRecordMatchesLabel(parseSharadProductRecords(record({ lidvid: 'urn:nasa:pds:mro_sharad_3d:data:synthetic_time::2.0' })).products[0]!, parsed), /LIDVID/u);
  assert.throws(() => assertSharadRecordMatchesLabel(parseSharadProductRecords(record({ boundedMember: { ...record().products[0]!.boundedMember, advertisedBytes: 97 } })).products[0]!, parsed), /advertised length 97 disagrees with the label length 96/u);
  assert.throws(() => assertSharadRecordMatchesLabel(parseSharadProductRecords(record({ boundedMember: { ...record().products[0]!.boundedMember, origin: 'https://example.invalid/data/other_time.dat' } })).products[0]!, parsed), /does not name the labelled science member/u);
  assert.throws(() => parseSharadProductRecords(record({ boundedMember: { ...record().products[0]!.boundedMember, digest: 'a'.repeat(64) } })), /publishes no digest/u);
  assert.throws(() => parseSharadProductRecords(record({ pinnedInputs: [{ input: 'fixture-observations', role: 'response' }] })), /pinned PDS4 label/u);
  const qualification = sharadPlanetaryGridQualification(parsed, product);
  assert.equal(qualification.source.archiveIdentity, parsed.lidvid);
  assert.deepEqual(qualification.axes.map(axis => [axis.fitsAxis, axis.role, axis.physicalType, axis.unit]), [[1, 'projected-x', 'length', 'm'], [2, 'projected-y', 'length', 'm'], [3, 'delay', 'time', 'us']]);
  assert.equal(qualification.quantity.name, 'BACKSCATTER STRENGTH RELATIVE TO FRAME MEAN');
  assert.equal(qualification.depth.coordinate, 'delay');
  assert.equal(qualification.depth.conversion.state, 'unavailable');
  assert.equal(qualification.depth.conversion.parameters.length, 0);
  assert.equal(qualification.resolution.state, 'unknown');
  assert.deepEqual(qualification.resolution.elements, []);
  assert.equal(qualification.placement, undefined);
  assert.equal(qualification.observability.measurementOperator, 'radar-propagation');
  assert.equal(qualification.observability.localization, 'inversion-dependent');
  assert.equal(qualification.uncertainty.form, 'none-supplied');
  assert.equal(qualification.inference?.kind, 'archive-published');
  assert.deepEqual(qualification.inference?.assumptions, ['Fixture limitation.']);
  assert.match(qualification.resolution.basis, /Sampling is not resolution/u);
});

test('the pinned Mars record and the pinned archive label agree on the published 26 GB product', async () => {
  const source = resolve(import.meta.dirname, '../../../../src/objects/mars/source/telescopes/mro-sharad-3d');
  const parsed = parseSharadPds4Label(await readFile(resolve(source, 'east_deuteronilus_mensae_3d_v2_time.xml'), 'utf8'));
  const records = parseSharadProductRecords(JSON.parse(await readFile(resolve(source, 'bounded-product.json'), 'utf8')));
  const product = records.products.find(entry => entry.lidvid === parsed.lidvid)!;
  assert.equal(records.target, 'mars');
  assert.equal(parsed.lidvid, 'urn:nasa:pds:mro_sharad_3d:data:east_deuteronilus_mensae_3d_v2_time::1.0');
  assert.deepEqual(parsed.shape, [1280, 1420, 3600]);
  assert.equal(sharadExpectedBytes(parsed), 26_173_440_000);
  assert.doesNotThrow(() => assertSharadRecordMatchesLabel(product, parsed));
  // The PDS3 label states the same layout a second way: one fixed-length record is one contiguous delay frame.
  const pds3 = await readFile(resolve(source, 'east_deuteronilus_mensae_3d_v2_time.lbl'), 'utf8');
  assert.match(pds3, /RECORD_BYTES\s+= 14400/u);
  assert.match(pds3, /FILE_RECORDS\s+= 1817600/u);
  assert.match(pds3, /DATA_TYPE\s+= PC_REAL/u);
  assert.equal(14_400, parsed.shape[2] * 4);
  assert.equal(1_817_600, parsed.shape[0] * parsed.shape[1]);
  // The reconstruction closure is the bundle's own list of contributing observations. That table is restored rather than
  // committed, so the tracked label carries its record count here.
  const observations = await readFile(resolve(source, 'east_deuteronilus_mensae_3d_v2_observations.xml'), 'utf8');
  assert.match(observations, /<logical_identifier>urn:nasa:pds:mro_sharad_3d:miscellaneous_index:east_deuteronilus_mensae_3d_v2_observations<\/logical_identifier>/u);
  assert.match(observations, /<records>466<\/records>/u);
  assert.ok(product.pinnedInputs.some(pin => pin.input === 'pds-mro-sharad-3d-east-deuteronilus-observations' && pin.role === 'response'));
  const qualification = sharadPlanetaryGridQualification(parsed, product);
  assert.equal(qualification.depth.conversion.state, 'unavailable');
  assert.equal(qualification.support.class, 'published-reconstruction');
  assert.equal(qualification.resolution.state, 'unknown');
  assert.equal(qualification.placement, undefined);
});
