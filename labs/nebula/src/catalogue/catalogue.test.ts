import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { readMessierCatalogue, readMessierInventory, readArchiveQuery, readArchiveImage } from './types';
import { imageFromRow, numberValue, pendingQuery, queryWhere } from './archives';
import { readTapTable } from './tap';
import { imageSuitability, inventoryStorage } from './selection';

const catalogue = readMessierCatalogue(JSON.parse(await readFile('labs/nebula/models/messier/catalogue.json', 'utf8')));
const orion = catalogue.objects.find(o => o.id === 'm42')!;
const row = { obs_id: 'observation', obs_publisher_did: 'ivo://archive/product', obs_collection: 'HST', target_name: 'M42', calib_level: 3,
  access_url: 'https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:HST/product/example.fits', access_format: 'image/fits',
  access_estsize: '10604160', s_ra:83.82, s_dec:-5.39, s_fov:.01, s_resolution:.1, s_xel1:1024,s_xel2:1024 };
const image = imageFromRow('mast', row, 'https://mast.stsci.edu/');

test('the discovery catalogue has all 110 identities and preserves unknown extents', () => {
  assert.deepEqual(catalogue.objects.map(o => o.messier).sort((a,b) => a-b), Array.from({length:110},(_,i) => i+1));
  assert.ok(catalogue.objects.some(o => o.majorArcmin === null));
  assert.throws(() => readMessierCatalogue({...catalogue, objects: catalogue.objects.slice(1)}));
  assert.throws(() => readMessierCatalogue({...catalogue, objects: [catalogue.objects[1],...catalogue.objects.slice(1)]}));
});
test('MAST ambiguous size units stay unknown and published file URLs distinguish one observation’s products', () => {
  assert.equal(image.estimatedBytes, null);
  const second = imageFromRow('mast', {...row, access_url: `${row.access_url}.other`}, 'https://mast.stsci.edu/');
  assert.notEqual(image.id, second.id);
  assert.equal(imageFromRow('eso', row, 'https://archive.eso.org/').estimatedBytes, 10604160000);
  assert.equal(imageFromRow('irsa', {...row,access_estsize:''}, 'https://irsa.ipac.caltech.edu/').estimatedBytes, null);
  assert.equal(numberValue(''), null); assert.equal(numberValue('NaN'), null);
});
test('a high-resolution partial field remains a detail candidate', () => {
  const quality = imageSuitability(image, {...orion, majorArcmin:60});
  assert.equal(quality.role, 'detail'); assert.ok(quality.fieldRatio! < 1);
  assert.equal(imageSuitability({...image,resolutionArcsec:null},orion).role,'unrated');
});
test('archive tables validate shape, failed responses and explicit overflow across JSON formats', () => {
  assert.deepEqual(readTapTable({metadata:[{name:'Size'}],data:[[123]]}).rows,[{size:123}]);
  assert.deepEqual(readTapTable({info:[{name:'Size'}],data:[['123']]}).rows,[{size:'123'}]);
  const irsa = { VOTABLE:{RESOURCE_ARRAY:[{'<xmlattr>':{type:'results'},INFO_ARRAY:[{'<xmlattr>':{name:'QUERY_STATUS',value:'OVERFLOW'}}],
    TABLE:{FIELD_ARRAY:[{'<xmlattr>':{name:'Size'}}],DATA:{TABLEDATA:[['123']]}}}]}};
  assert.equal(readTapTable(irsa).overflow,true);
  irsa.VOTABLE.RESOURCE_ARRAY[0]!.INFO_ARRAY[0]!['<xmlattr>'].value='ERROR'; assert.throws(()=>readTapTable(irsa));
  assert.throws(()=>readTapTable({metadata:[{name:'size'}],data:[[1,2]]}));
});
test('unknown counts, duplicate file hits, and partial searches cannot produce a complete total', () => {
  const targets = catalogue.objects.map(o => ({objectId:o.id,queries:(['mast','irsa','eso'] as const).map(p=>pendingQuery(p,o))}));
  targets[0]!.queries[0] = {...targets[0]!.queries[0]!,status:'complete',queriedAt:new Date().toISOString(),matchedCount:1,images:[image]};
  targets[1]!.queries[0] = {...targets[1]!.queries[0]!,status:'truncated',queriedAt:new Date().toISOString(),images:[image]};
  const inventory = readMessierInventory({schema:'cssearth-messier-inventory@1',generatedAt:new Date().toISOString(),catalogueSha256:'a'.repeat(64),policy:'test',targets});
  assert.equal(inventoryStorage(inventory).uniqueImages,1); assert.equal(inventoryStorage(inventory).estimatedBytes,0);
  assert.equal(inventoryStorage(inventory).unknownSizes,1); assert.equal(inventoryStorage(inventory).isLowerBound,true);
  assert.throws(()=>readArchiveQuery({...targets[0]!.queries[0],matchedCount:2}));
  assert.throws(()=>readArchiveQuery({...targets[0]!.queries[0],imagesPath:'../../unsafe',imagesSha256:'a'.repeat(64),imageCount:1}));
  assert.throws(()=>readArchiveImage({...image,sourceUrl:'javascript:alert(1)'}));
});
test('MAST discovery box wraps at RA zero; query scopes keep detailed partial images', () => {
  const query=queryWhere('mast',{...orion,raDegrees:.01,decDegrees:0,majorArcmin:60});
  assert.match(query,/ OR s_ra<=/); assert.match(query,/calib_level>=2/);
  assert.doesNotMatch(query,/s_fov[><=]/); assert.match(queryWhere('eso',orion),/INTERSECTS/);
});
