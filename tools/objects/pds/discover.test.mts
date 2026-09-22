import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { inspectPdsProduct, mergePdsDiscovery, pdsTargetNameCandidates } from './discover.mts';
import { requireRecord, requireString } from '../../sources/source-values.mts';

test('PDS target-name candidates normalize a PDS3 designation without storing a target LID', () => {
  assert.deepEqual(pdsTargetNameCandidates(['Wild 2', '81P/WILD 2 (1978 A2)']), ['Wild 2', '81P/WILD 2 (1978 A2)', '81P/WILD 2', '81P/Wild 2']);
});

test('a mapped multiband PDS label becomes one product-level observation without filling its wavelength gaps', async () => {
  const path = resolve(import.meta.dirname, '../../../src/objects/charon/source/observations/nh_charon_color_mosaic.lblx');
  const bytes = await readFile(path), labelUri = 'https://example.test/nh_charon_color_mosaic.lblx';
  const result = inspectPdsProduct({ lid: 'urn:nasa:pds:nh_derived:plutosystem_composition:nh_charon_color_mosaic',
    lidvid: 'urn:nasa:pds:nh_derived:plutosystem_composition:nh_charon_color_mosaic::1.0', version: '1.0',
    targetNames: ['(134340) Pluto I (Charon)'], targetLids: ['urn:nasa:pds:context:target:satellite.134340_pluto.charon'],
    observingSystem: ['New Horizons', 'Multispectral Visible Imaging Camera'], startIso: '1965-01-01T00:00:00.000Z', stopIso: '3000-01-01T00:00:00.000Z',
    harvestIso: '2025-07-25T20:28:16Z', label: { uri: labelUri, bytes: bytes.byteLength, md5: createHash('md5').update(bytes).digest('hex') },
    data: [{ uri: 'https://example.test/nh_charon_color_mosaic.img', bytes: 116006912, md5: 'a'.repeat(32) }] }, bytes.toString('utf8'), createHash('sha256').update(bytes).digest('hex'),
    { lid: 'urn:nasa:pds:context:target:satellite.134340_pluto.charon', name: 'Charon' });
  assert.deepEqual(result.wavelengthIntervalsMicrometres, [[0.875, 0.915], [0.78, 0.96], [0.55, 0.7], [0.4, 0.55]]);
  assert.equal(result.surfaceResolutionKm, 1);
  assert.equal(result.mode, 'MVIC mapped color');
});

test('an unmapped MVIC file with one image per filter remains an image product without invented resolution', async () => {
  const bands = [['Blue', 475, 150], ['Red', 620, 160], ['NIR', 877.5, 195], ['CH4', 885, 50]] as const;
  const xml = `<Product_Observational><logical_identifier>urn:nasa:pds:nh_derived:plutosystem_composition:cube_h_color_best</logical_identifier><version_id>1.0</version_id><processing_level>Derived</processing_level>
    <title>Hydra MVIC colors</title><Observing_System_Component><name>New Horizons</name><type>Host</type></Observing_System_Component>
    <Observing_System_Component><name>Multispectral Visible Imaging Camera</name><type>Instrument</type></Observing_System_Component>
    <Internal_Reference><lid_reference>urn:nasa:pds:context:target:satellite.134340_pluto.hydra</lid_reference><reference_type>data_to_target</reference_type></Internal_Reference>
    ${bands.map(([name, center, width]) => `<img:Imaging><local_identifier_reference>${name}Image</local_identifier_reference><img:Optical_Filter><img:filter_name>${name}</img:filter_name><img:bandwidth unit="nm">${width}</img:bandwidth><img:center_filter_wavelength unit="nm">${center}</img:center_filter_wavelength></img:Optical_Filter></img:Imaging>`).join('')}
    ${bands.map(([name]) => `<Array_2D_Image><local_identifier>${name}Image</local_identifier><axes>2</axes></Array_2D_Image>`).join('')}<file_name>cube_h_color_best.fit</file_name></Product_Observational>`;
  const bytes = Buffer.from(xml);
  const product = { lid: 'urn:nasa:pds:nh_derived:plutosystem_composition:cube_h_color_best',
    lidvid: 'urn:nasa:pds:nh_derived:plutosystem_composition:cube_h_color_best::1.0', version: '1.0',
    targetNames: ['(134340) Pluto III (Hydra)'], targetLids: ['urn:nasa:pds:context:target:satellite.134340_pluto.hydra'],
    observingSystem: ['New Horizons', 'Multispectral Visible Imaging Camera'], startIso: '2015-07-14T07:36:50.008Z', stopIso: '2015-07-14T07:37:10.876Z',
    harvestIso: '2025-01-01T00:00:00Z', label: { uri: 'https://example.test/cube_h_color_best.lblx', bytes: bytes.byteLength, md5: createHash('md5').update(bytes).digest('hex') },
    data: [{ uri: 'https://example.test/cube_h_color_best.fit', bytes: 233280, md5: 'a'.repeat(32) }] };
  const result = inspectPdsProduct(product, xml, createHash('sha256').update(bytes).digest('hex'),
    { lid: 'urn:nasa:pds:context:target:satellite.134340_pluto.hydra', name: 'Hydra' });
  assert.deepEqual(result.wavelengthIntervalsMicrometres, [[0.4, 0.55], [0.54, 0.7], [0.78, 0.975], [0.86, 0.91]]);
  assert.equal(result.surfaceResolutionKm, undefined);
  assert.equal(result.mode, 'MVIC color images');
});

test('a table from an arbitrary instrument is normalized from label structure without an instrument profile', () => {
  const targetLid = 'urn:nasa:pds:context:target:comet.81p_wild_2';
  const xml = `<Product_Observational><logical_identifier>urn:nasa:pds:soho:swan:water</logical_identifier><version_id>1.0</version_id><title>Water production</title><processing_level>Derived</processing_level>
    <Observing_System_Component><name>SOlar and Heliospheric Observatory (SOHO)</name><type>Host</type></Observing_System_Component>
    <Observing_System_Component><name>Solar Wind ANisotropies (SWAN)</name><type>Instrument</type></Observing_System_Component>
    <Internal_Reference><lid_reference>${targetLid}</lid_reference><reference_type>data_to_target</reference_type></Internal_Reference>
    <Table_Character><name>Water production</name></Table_Character><file_name>water.tab</file_name></Product_Observational>`;
  const bytes = Buffer.from(xml), product = { lid: 'urn:nasa:pds:soho:swan:water', lidvid: 'urn:nasa:pds:soho:swan:water::1.0', version: '1.0',
    targetNames: ['81P/Wild 2'], targetLids: [targetLid], observingSystem: ['SOHO', 'SWAN'], startIso: '1997-01-01T00:00:00Z', stopIso: '1997-02-01T00:00:00Z',
    harvestIso: '2026-01-01T00:00:00Z', label: { uri: 'https://example.test/water.xml', bytes: bytes.length, md5: createHash('md5').update(bytes).digest('hex') },
    data: [{ uri: 'https://example.test/water.tab', bytes: 10, md5: 'a'.repeat(32) }] };
  const result = inspectPdsProduct(product, xml, createHash('sha256').update(bytes).digest('hex'), { lid: targetLid, name: 'Wild 2' });
  assert.equal(result.kind, 'table');
  assert.equal(result.mode, 'SWAN derived table');
});

test('writing a target search preserves searches for other targets and replaces a stale search for the same target', () => {
  const search = (id: string, searchedAt: string) => ({ schema: 'cssearth-pds-discovery@1' as const, searchedAt,
    package: { name: 'pds.peppi' as const, version: '1' }, target: { id, lid: `urn:${id}`, name: id },
    scope: { productClass: 'Product_Observational' as const, processingLevels: 'all' as const, complete: true as const }, registryProducts: 0,
    admittedProducts: 0, rejectedProducts: 0, rejected: [], observations: [] });
  const charon = search('charon', '2026-01-01T00:00:00Z'), staleHydra = search('hydra', '2026-01-01T00:00:00Z'), hydra = search('hydra', '2026-01-02T00:00:00Z');
  const merged = mergePdsDiscovery({ schema: 'cssearth-pds-discovery@2', searches: [charon, staleHydra] }, hydra);
  // The store keeps searches it did not author, so each merged entry crosses the boundary untyped.
  const summary = merged.searches.map(entry => {
    const search = requireRecord(entry, 'PDS discovery search');
    return [requireString(requireRecord(search.target, 'PDS discovery target').id, 'PDS target id'),
      requireString(search.searchedAt, 'PDS search time')];
  });
  assert.deepEqual(summary, [['charon', charon.searchedAt], ['hydra', hydra.searchedAt]]);
});
