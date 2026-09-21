import assert from 'node:assert/strict';
import test from 'node:test';
import { explorationAnswer, parseExplorationArguments } from './exploration.mts';
import { SERVICES, targetQuery } from './vo/discovery.mts';

test('target-only exploration preserves omitted filters and archive queries add only supplied filters', () => {
  assert.deepEqual(parseExplorationArguments(['eris']), { target: 'eris' });
  const profile = SERVICES[0]!, plain = targetQuery(profile, ['Eris'], 50, { target: 'eris' });
  assert.doesNotMatch(plain, /em_min|dataproduct_type|t_min/u);
  const filtered = targetQuery(profile, ['Eris'], 50, parseExplorationArguments(['eris','--kind','cube','--wavelength','2.2,2.4','--from','2020-01-01T00:00:00Z','--to','2020-01-02T00:00:00Z']));
  assert.match(filtered, /dataproduct_type/u); assert.match(filtered, /em_min/u); assert.match(filtered, /t_min/u);
});

test('wavelength-only exploration remains exploratory rather than becoming a strict capability request', () => {
  const request = parseExplorationArguments(['eris','--wavelength','2.2,2.4']);
  assert.deepEqual(request, { target: 'eris', wavelengthMicrometres: [2.2, 2.4] });
  const answer = explorationAnswer(request, { ledgers: [], capabilities: [], targetCatalogue: [{ id: 'eris', name: 'Eris', aliases: [] }], targetAssociations: [], bodyMaps: [] });
  assert.equal(answer.target, 'eris'); assert.deepEqual(answer.request, request); assert.deepEqual(answer.choices, []);
});

test('exploration choices are deterministic and ready products appear first while service limits remain visible', () => {
  const source = (id: string) => ({ id, target: 'eris', telescope: 'Fixture', mode: 'camera', kind: 'image' as const, archiveProductId: `archive-${id}`,
    decoder: 'fits-image' as const, files: [], identity: { OBJECT: 'ERIS' }, units: 'counts', meaning: 'fixture', citation: 'https://example.test/', limitations: ['fixture limitation'],
    qualified: id === 'b', receipt: `${id}.receipt` });
  const qualified = { target: 'eris', telescope: 'Fixture', mode: 'camera', observation: 'b', program: 'b', product: 'b.fits', receipt: 'b.receipt', productRecord: 'b.product.json', outputRoot: '.', facts: { target: 'eris', verified: true, kind: 'image' as const, result: 'telescope-product' as const } };
  const inputs = { ledgers: [], capabilities: [], targetCatalogue: [{ id: 'eris', name: 'Eris', aliases: [] }], targetAssociations: [], bodyMaps: [],
    sourceProducts: [source('a'), source('b')], qualifiedProducts: [qualified], vo: { records: [], services: [
      { service: 'overflow', state: 'overflow' as const, scope: 'bounded', reason: 'more rows' },
      { service: 'failed', state: 'unavailable' as const, scope: 'target', reason: 'transport failed' },
    ] } };
  const first = explorationAnswer({ target: 'eris' }, inputs), second = explorationAnswer({ target: 'eris' }, { ...inputs, sourceProducts: [...inputs.sourceProducts].reverse() });
  assert.equal(first.choices[0]!.state, 'ready');
  assert.deepEqual(first.choices.map(choice => choice.key), second.choices.map(choice => choice.key));
  assert.deepEqual(first.choices.map(choice => choice.pick), [1, 2]);
  assert.deepEqual(first.issues.filter(issue => issue.scope === 'provider').map(issue => issue.code), ['provider-overflow','provider-unavailable']);
});

test('unknown targets return suggestions without exposing provider results', () => {
  const answer = explorationAnswer({ target: 'eriss' }, { ledgers: [], capabilities: [], targetCatalogue: [{ id: 'eris', name: 'Eris', aliases: [] }], targetAssociations: [], bodyMaps: [],
    vo: { records: [], services: [{ service: 'should-not-leak', state: 'sampled', scope: 'fixture', reason: 'fixture' }] } });
  assert.equal(answer.targetResolution.status, 'unknown'); assert.deepEqual(answer.services, []); assert.equal(answer.issues[0]!.code, 'unknown-target');
});

test('explicit family filters separate known mismatches from selectable choices',()=>{
  const source={id:'image',target:'sun',telescope:'Fixture',mode:'camera',kind:'image' as const,archiveProductId:'archive-image',decoder:'fits-image' as const,files:[],identity:{OBJECT:'SUN'},units:'counts',meaning:'fixture',citation:'https://example.test/',limitations:[],qualified:false};
  const answer=explorationAnswer({target:'sun',family:'F16'},{ledgers:[],capabilities:[],targetCatalogue:[{id:'sun',name:'Sun',aliases:[]}],targetAssociations:[],bodyMaps:[],sourceProducts:[source],qualifiedProducts:[]});
  assert.deepEqual(answer.choices,[]);assert.deepEqual(answer.unresolved,[]);assert.equal(answer.unsupported.length,1);assert.match(answer.unsupported[0]!.reason,/F01 do not match F16/u);
});
