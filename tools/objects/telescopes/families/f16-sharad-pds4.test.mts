import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  openSharadPds4Slice, openSharadPds4Volume, parseSharadPds4Label, parseSharadQualificationSource, parseSharadSliceClaim,
  readSharadDelayFrame, readSharadPlane, sharadExpectedBytes, sharadFileSource, sharadFrameRange, sharadPlanetaryGridQualification,
  sharadPlaneCost, sharadSliceWindow, F16_SHARAD_PDS4_HANDLER, SHARAD_PDS4_PROFILE,
  type SharadByteSource, type SharadPds4Label,
} from './f16-sharad-pds4.mts';
import { parseSourceProducts } from '../source-products.mts';
import { familyProfile } from '../family-handlers.mts';

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
const qualificationSource = (overrides: Record<string, unknown> = {}) => ({
  sourceUrl: 'https://example.invalid/data/synthetic_time.dat', telescope: 'Mars Reconnaissance Orbiter', mode: 'SHARAD/3-D delay-time radargram',
  citation: 'Fixture citation.', license: 'Fixture license.', limitations: ['Fixture limitation.'], ...overrides,
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


test('a pinned slice is read as the window of the volume it claims to be, and never outside it', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'sharad-pds4-slice-'));
  try {
    const parsed = parseSharadPds4Label(label()), whole = bytes();
    const frame = sharadSliceWindow(parsed, { kind: 'delay-frame', x: 1, y: 2 });
    assert.deepEqual(frame, { position: 80, length: 16 });
    assert.deepEqual(sharadSliceWindow(parsed, { kind: 'x-plane', x: 1 }), { position: 48, length: 48 });
    const framePath = resolve(root, 'frame.dat'), planePath = resolve(root, 'plane.dat');
    await writeFile(framePath, whole.subarray(frame.position, frame.position + frame.length));
    await writeFile(planePath, whole.subarray(48, 96));
    const sliced = await openSharadPds4Slice(framePath, parsed, { kind: 'delay-frame', x: 1, y: 2 }, frame);
    try {
      // The label arithmetic is unchanged: the same call on the whole member and on its pinned slice agree.
      assert.deepEqual((await readSharadDelayFrame(sliced, 1, 2)).values, [120, 121, 122, 123]);
      await assert.rejects(readSharadDelayFrame(sliced, 0, 0), /leaves the pinned slice at 80 of 16 bytes/u);
    } finally { await sliced.source.close(); }
    const plane = await openSharadPds4Slice(planePath, parsed, { kind: 'x-plane', x: 1 });
    try {
      assert.deepEqual((await readSharadPlane(plane, 'projected-x', 1)).values, [null, 101, 102, 103, 110, 111, 112, 113, 120, 121, 122, 123]);
      assert.deepEqual((await readSharadDelayFrame(plane, 1, 2)).values, [120, 121, 122, 123]);
      await assert.rejects(readSharadPlane(plane, 'projected-x', 0), /leaves the pinned slice/u);
    } finally { await plane.source.close(); }
    // A pin that is not where the label puts that slice is refused before the file is even sized.
    await assert.rejects(openSharadPds4Slice(framePath, parsed, { kind: 'delay-frame', x: 1, y: 2 }, { position: 64, length: 16 }),
      /pinned slice at 64 of 16 bytes is not the delay-frame the label places at 80 of 16 bytes/u);
    await assert.rejects(openSharadPds4Slice(framePath, parsed, { kind: 'x-plane', x: 1 }), /slice file length 16 disagrees with the x-plane length 48/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the Mars source observations name real slices of the pinned label and publish the F16 qualification', async () => {
  const root = resolve(import.meta.dirname, '../../../..'), source = resolve(root, 'src/objects/mars/source');
  const parsed = parseSharadPds4Label(await readFile(resolve(source, 'telescopes/mro-sharad-3d/east_deuteronilus_mensae_3d_v2_time.xml'), 'utf8'));
  assert.equal(parsed.lidvid, 'urn:nasa:pds:mro_sharad_3d:data:east_deuteronilus_mensae_3d_v2_time::1.0');
  assert.deepEqual(parsed.shape, [1280, 1420, 3600]);
  assert.equal(sharadExpectedBytes(parsed), 26_173_440_000);
  const products = parseSourceProducts(
    JSON.parse(await readFile(resolve(source, 'observations.json'), 'utf8')),
    JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8')),
    'mars',
  ).filter(product => product.familyEvidence?.profileId === SHARAD_PDS4_PROFILE);
  assert.equal(products.length, 2);
  for (const product of products) {
    const science = product.files.find(file => file.role === 'science')!;
    const { claim, window } = parseSharadSliceClaim(product.identity, parsed);
    // The observation's claimed slice, the label's arithmetic and the manifest pin are the same bytes.
    assert.equal(science.bytes, window.length);
    assert.equal(science.origin, `https://pds-geosciences.wustl.edu/mro/mro-m-sharad-5-3d-v1/mrosh_3001/data/${parsed.dataFile}`);
    assert.equal(product.archiveProductId, `${parsed.lidvid}#bytes=${window.position}-${window.position + window.length - 1}`);
    assert.deepEqual(sharadSliceWindow(parsed, claim), window);
    assert.equal(product.familyEvidence?.families.join(), 'F16');
    const qualification = sharadPlanetaryGridQualification(parsed, parseSharadQualificationSource({ ...product, sourceUrl: science.origin, license: 'NASA scientific data; archive citation requested' }, parsed));
    assert.equal(qualification.source.archiveIdentity, parsed.lidvid);
    assert.equal(qualification.depth.conversion.state, 'unavailable');
    assert.equal(qualification.support.class, 'published-reconstruction');
    assert.equal(qualification.resolution.state, 'unknown');
    assert.equal(qualification.placement, undefined);
  }
  const frame = products.find(product => product.identity.SLICE_KIND === 'delay-frame')!;
  assert.deepEqual([frame.identity.BYTE_OFFSET, frame.identity.BYTE_LENGTH], [13_096_944_000, 14_400]);
  assert.throws(() => parseSharadSliceClaim({ ...frame.identity, BYTE_OFFSET: 0 }, parsed), /the label places that delay-frame at 13096944000/u);
  assert.throws(() => parseSharadSliceClaim({ ...frame.identity, LIDVID: 'urn:nasa:pds:mro_sharad_3d:data:east_deuteronilus_mensae_3d_v2_time::2.0' }, parsed), /LIDVID/u);
  assert.throws(() => parseSharadSliceClaim({ ...frame.identity, SLICE_KIND: 'y-plane' }, parsed), /unsupported slice kind/u);
  // The committed delay frame is the only radar evidence a clean checkout has, so the reader is held to it here.
  const sliced = await openSharadPds4Slice(resolve(source, 'telescopes/mro-sharad-3d/slices/frame-x0640-y0710.dat'), parsed, { kind: 'delay-frame', x: 640, y: 710 }, sharadFrameRange(parsed, 640, 710));
  try {
    const trace = await readSharadDelayFrame(sliced, 640, 710);
    assert.equal(trace.values.length, 3600);
    assert.ok(trace.values.every(value => value !== null && value >= parsed.statistics.minimum && value <= parsed.statistics.maximum));
    await assert.rejects(readSharadDelayFrame(sliced, 640, 711), /leaves the pinned slice/u);
  } finally { await sliced.source.close(); }
});

test('the SHARAD format is registered with its evidence and claims no operation yet', () => {
  const { handler, profile } = familyProfile(SHARAD_PDS4_PROFILE);
  assert.equal(handler.id, 'f16-sharad-pds4');
  assert.deepEqual(profile.families, ['F16']);
  assert.equal(profile.evidence[0]?.status, 'partial');
  assert.deepEqual(F16_SHARAD_PDS4_HANDLER.recognizes([{ path: 'east_deuteronilus_mensae_3d_v2_time.xml', prefix: new TextEncoder().encode('<logical_identifier>urn:nasa:pds:mro_sharad_3d:data:east_deuteronilus_mensae_3d_v2_time</logical_identifier>') }]), [SHARAD_PDS4_PROFILE]);
  assert.deepEqual(F16_SHARAD_PDS4_HANDLER.recognizes([{ path: 'other.xml', prefix: new TextEncoder().encode('<logical_identifier>urn:nasa:pds:other</logical_identifier>') }]), []);
});
