import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFileAddress, parseSourceCatalog, sourceCitationUrl, sourceResolver, parseSourceBinding, parseSourceCitation } from './catalog.js';
const record = (id = 'work') => ({id,title:'Published work',kind:'data-product',identityLevel:'work',identifiers:[],links:[{role:'landing',url:'https://example.org/product',label:'Provider'}],
  evidence:[{path:'source/record.json',locator:'/product'}],relations:[],statements:[]});
const catalog = () => ({schema:'cssearth-source-catalog@1',records:[record()]});
test('canonical identity, releases and claim-local citations remain distinct', () => {
  const c = parseSourceCatalog({...catalog(),records:[record(),{...record('release'),identityLevel:'release',version:'2',relations:[{kind:'version-of',catalogueId:'work',evidence:'Provider release statement'}]}]});
  const sources = sourceResolver(c);
  assert.equal(sources.work.identityLevel,'work'); assert.equal(sources.release.version,'2');
  assert.ok(Object.isFrozen(c.records[0].links));
  assert.deepEqual(parseSourceCitation({catalogueId:'release',checkedOn:'2024-02-29',locator:'Table 2'},sources),{catalogueId:'release',checkedOn:'2024-02-29',locator:'Table 2'});
  assert.equal('checkedOn' in sources.release,false);
});
test('invalid identities, unsafe links, ambiguous versions and relation cycles fail', () => {
  for (const changed of [
    {...record(),id:'Unsafe ID'}, {...record(),evidence:[]}, {...record(),identityLevel:'release'},
    {...record(),links:[{role:'landing',url:'javascript:alert(1)',label:'Bad'}]},
    {...record(),links:[{role:'landing',url:'https://user:secret@example.org/',label:'Bad'}]},
    {...record(),relations:[{kind:'part-of',catalogueId:'missing',evidence:'Reference'}]},
  ]) assert.throws(() => parseSourceCatalog({...catalog(),records:[changed]}));
  assert.throws(() => parseSourceCatalog({...catalog(),records:[record(),record()]}),/Duplicate/);
  assert.throws(() => parseSourceCatalog({...catalog(),records:[{...record(),relations:[{kind:'part-of',catalogueId:'second',evidence:'Reference'}]},{...record('second'),relations:[{kind:'derived-from',catalogueId:'work',evidence:'Reference'}]}]}),/Cyclic/);
});
test('bindings never infer an identity from a URL, local file hash, credit or capture', () => {
  const sources = sourceResolver(parseSourceCatalog(catalog()));
  for (const raw of [{kind:'catalogued',references:[]},{kind:'catalogued',references:[{catalogueId:'missing',role:'material',evidence:'Record'}]},
    {kind:'local'},{kind:'unresolved',label:'Unknown',evidence:'Record'}, {kind:'catalogued',url:'https://example.org/product'}]) assert.throws(() => parseSourceBinding(raw,sources));
  assert.equal(parseSourceBinding({kind:'local',reason:'Authored recipe'}).kind,'local');
  assert.throws(() => parseSourceCitation({catalogueId:'work',checkedOn:'2023-02-29'},sources));
  assert.throws(() => parseSourceCitation({catalogueId:'missing',checkedOn:'2024-02-29'},sources));
});

test('new metadata may cite primary evidence without archiving a webpage', () => {
  const primary={url:'https://example.org/product',checkedOn:'2026-09-10',locator:'Product identity and release section'};
  assert.deepEqual(parseSourceCatalog({...catalog(),records:[{...record(),evidence:[primary]}]}).records[0].evidence,[primary]);
  assert.throws(()=>parseSourceCatalog({...catalog(),records:[{...record(),evidence:[{...primary,locator:''}]}]}));
});

test('a reader is sent to a page: a record whose reader link is a file is refused', () => {
  for (const [url, file] of [
    ['https://archive.example.org/data/shape.obj', true], ['https://archive.example.org/data/FRAME_1_CALIB.IMG', true],
    ['https://zenodo.org/records/1/files/model.nc?download=1', true], ['https://repository.example.org/bitstreams/abc/download', true],
    ['https://mast.example.org/api/Download/file?uri=mast:JWST/product/frame_i2d.fits', true],
    ['https://archive.example.org/data-server/data?RETRIEVAL_TYPE=XP_SAMPLED&ID=1&FORMAT=csv', true], ['https://archive.example.org/tap-server/tap/sync', true], ['https://archive.example.org/TAP/sync?query=select+1', true],
    ['https://simbad.example.org/simbad/sim-tap/sync', true], ['https://vizier.example.org/viz-bin/asu-tsv', true], ['https://vizier.example.org/viz-bin/VizieR?-source=J/A+A/529/A75', false],
    ['https://ssd.example.org/api/horizons.api', true], ['https://archive.example.org/archive/', false],
    ['https://api.example.org/repos/owner/repository/git/blobs/abc123', true], ['https://archive.example.org/api/access/datafile/42', true],
    ['https://news.example.org/wp-json/wp/v2/topic/7', true], ['https://arxiv.org/pdf/1612.00834', true], ['https://portal.example.org/dataPortal/file/ADP.2024-03-08T10:41:06.519', true],
    ['https://meetings.example.org/2022/pdf/program.htm#session641', false], ['https://archive.example.org/browser/#/api/collections/europa', false],
    ['https://archive.example.org/data/', false], ['https://archive.example.org/product.html#table.csv', false],
    ['https://ui.adsabs.harvard.edu/abs/2009AJ....138..323T', false], ['https://doi.org/10.1111/j.1365-2966.2010.17101.x', false], ['https://arxiv.org/abs/1807.06209', false],
    ['https://github.com/owner/repository/blob/abc123/models/rock.stl', false], ['https://commons.wikimedia.org/wiki/File:Plejades.jpg', false],
  ] as const) assert.equal(isFileAddress(url), file, url);
  const file = {role:'original',url:'https://archive.example.org/data/shape.obj',label:'Shape file'}, page = {role:'landing',url:'https://archive.example.org/data/',label:'Archive folder'};
  assert.throws(() => parseSourceCatalog({...catalog(),records:[{...record(),links:[{...file,role:'landing'}]}]}), /Source work sends its reader to a file, https:\/\/archive\.example\.org\/data\/shape\.obj/);
  assert.throws(() => parseSourceCatalog({...catalog(),records:[{...record(),links:[file]}]}), /sends its reader to a file/, 'with no landing link the first citation link is the reader link');
  assert.equal(sourceCitationUrl(parseSourceCatalog({...catalog(),records:[{...record(),links:[file,page]}]}).records[0]), page.url);
});
