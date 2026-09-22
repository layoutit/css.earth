import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSourceCatalog, sourceResolver, parseSourceBinding, parseSourceCitation } from './source-catalog.mts';
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
