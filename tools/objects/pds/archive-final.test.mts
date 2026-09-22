import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { normalizeDiscoveredPdsProduct } from './archive-final.mts';

test('PDS discovery retains the complete label and data dependency set', () => {
  const row = { lid: 'urn:nasa:pds:x:y', lidvid: 'urn:nasa:pds:x:y::1.0', vid: '1.0', ref_lid_target: 'urn:nasa:pds:context:target:asteroid.x',
    'pds:Target_Identification.pds:name': 'X', 'pds:Observing_System_Component.pds:name': ['Scope', 'Camera'],
    'pds:Time_Coordinates.pds:start_date_time': '2020-01-01T00:00:00Z', 'pds:Time_Coordinates.pds:stop_date_time': '2020-01-01T00:01:00Z',
    'ops:Harvest_Info.ops:harvest_date_time': '2020-01-02T00:00:00Z', 'ops:Label_File_Info.ops:file_ref': 'https://example.test/x.xml',
    'ops:Label_File_Info.ops:file_size': '10', 'ops:Label_File_Info.ops:md5_checksum': 'a'.repeat(32),
    'ops:Data_File_Info.ops:file_ref': ['https://example.test/x.img', 'https://example.test/x.fmt'], 'ops:Data_File_Info.ops:file_size': ['20', '30'],
    'ops:Data_File_Info.ops:md5_checksum': ['b'.repeat(32), 'c'.repeat(32)] };
  const product = normalizeDiscoveredPdsProduct(row);
  assert.deepEqual(product.data.map(file => file.uri), ['https://example.test/x.img', 'https://example.test/x.fmt']);
  assert.throws(() => normalizeDiscoveredPdsProduct({ ...row, 'ops:Data_File_Info.ops:file_size': ['20'] }), /incomplete data-file set/u);
});
