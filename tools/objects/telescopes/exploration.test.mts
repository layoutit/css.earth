import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { explorationAnswer, explorationOutcome, parseExplorationArguments } from './exploration.mts';
import { canonicalTargetRequest, withRequestedTargetName } from './targets.mts';
import { associateTarget, SERVICES, targetQuery } from './vo/discovery.mts';

test('a uniquely resolved entered name reaches archives without becoming a permanent alias', () => {
  const catalogue = [{ id: 'gamma-7', name: 'Gamma 7 A', aliases: [] }, { id: 'gamma-7-b', name: 'Gamma 7 B', aliases: [] }];
  const scoped = withRequestedTargetName('Gamma 7', 'gamma-7', catalogue);
  assert.deepEqual(canonicalTargetRequest({ target: 'Gamma 7', kind: 'spectrum' }, 'gamma-7'),
    { target: 'gamma-7', kind: 'spectrum', requestedTargetName: 'Gamma 7' });
  assert.deepEqual(canonicalTargetRequest({ target: 'gamma-7', requestedTargetName: 'Gamma 7' }, 'gamma-7'),
    { target: 'gamma-7', requestedTargetName: 'Gamma 7' });
  assert.deepEqual(catalogue[0]!.aliases, []);
  const identities = scoped.map(entry => ({ id: entry.id, names: [entry.name, ...entry.aliases] }));
  const star = identities[0]!, companion = identities[1]!;
  const answer = explorationAnswer({ target: 'Gamma 7' }, { ledgers: [], capabilities: [], targetCatalogue: catalogue, targetAssociations: [], bodyMaps: [] });
  assert.deepEqual(answer.request, { target: 'gamma-7', requestedTargetName: 'Gamma 7' });
  assert.match(targetQuery(SERVICES[0]!, star.names, 50, { target: star.id, kind: 'spectrum', instrument: 'UVES' }), /target_name IN \('Gamma 7 A','Gamma 7'\)/u);
  assert.equal(associateTarget('Gamma 7', null, star, identities).status, 'confirmed');
  assert.equal(associateTarget('Gamma 7', null, companion, identities).status, 'unmatched');
  assert.equal(withRequestedTargetName('unrelated', 'gamma-7', catalogue), catalogue);
  const ambiguous = [...catalogue, { id: 'other', name: 'Gamma-7', aliases: [] }];
  assert.equal(withRequestedTargetName('Gamma 7', 'gamma-7', ambiguous), ambiguous);
  assert.equal(withRequestedTargetName('Gamma 7', 'gamma-7-b', catalogue), catalogue);
});

test('target-only exploration preserves omitted filters and archive queries add only supplied filters', () => {
  assert.deepEqual(parseExplorationArguments(['eris']), { target: 'eris' });
  const profile = SERVICES[0]!, plain = targetQuery(profile, ['Eris'], 50, { target: 'eris' });
  assert.doesNotMatch(plain, /em_min|dataproduct_type|t_min/u);
  const filtered = targetQuery(profile, ['Eris'], 50, parseExplorationArguments(['eris','--kind','cube','--wavelength','2.2,2.4','--from','2020-01-01T00:00:00Z','--to','2020-01-02T00:00:00Z']));
  assert.match(filtered, /dataproduct_type/u); assert.match(filtered, /em_min/u); assert.match(filtered, /t_min/u);
});

test('an instrument and a region reach the archive query as instrument_name and a footprint clause', () => {
  const request = parseExplorationArguments(['sgr-a-star','--instrument','ERIS','--icrs-circle','266.416816625,-29.007824972,0.000277777777778']);
  assert.equal(request.instrument, 'ERIS');
  const query = targetQuery(SERVICES[0]!, ['Sagittarius A*'], 50, request);
  assert.match(query, /instrument_name='ERIS'/u); assert.match(query, /INTERSECTS\(CIRCLE\('ICRS',266\.416816625,-29\.007824972,/u);
  assert.throws(() => parseExplorationArguments(['sgr-a-star','--instrument',' ']), /archive instrument name/u);
  assert.throws(() => targetQuery(SERVICES[0]!, ['x'], 50, { target: 'x', instrument: "ERIS\u0000" }), /Invalid instrument/u);
});

test('a bounded archive sample is taken in the service\'s declared identity order', () => {
  assert.match(targetQuery(SERVICES[0]!, ['Eris'], 50, { target: 'eris' }), / ORDER BY obs_publisher_did, obs_id$/u);
  assert.match(targetQuery(SERVICES[2]!, ['Eris'], 50, { target: 'eris' }), / ORDER BY granule_uid$/u);
});

test('wavelength-only exploration remains exploratory rather than becoming a strict capability request', () => {
  const request = parseExplorationArguments(['eris','--wavelength','2.2,2.4']);
  assert.deepEqual(request, { target: 'eris', wavelengthMicrometres: [2.2, 2.4] });
  const answer = explorationAnswer(request, { ledgers: [], capabilities: [], targetCatalogue: [{ id: 'eris', name: 'Eris', aliases: [] }], targetAssociations: [], bodyMaps: [] });
  assert.equal(answer.target, 'eris'); assert.deepEqual(answer.request, request); assert.deepEqual(answer.choices, []);
});

test('unread source headers mark exploration coverage as incomplete', () => {
  const answer = explorationAnswer({ target: 'eris' }, { ledgers: [], capabilities: [], targetCatalogue: [{ id: 'eris', name: 'Eris', aliases: [] }], targetAssociations: [], bodyMaps: [],
    sourceIntakeIssues: [
      { path: 'a.fits', state: 'unavailable', reason: 'Header retrieval requires a local source file or a previously cached header.' },
      { path: 'b.fits', state: 'unavailable', reason: 'Header retrieval requires a local source file or a previously cached header.' },
    ] });
  assert.deepEqual(answer.choices, []);
  assert.deepEqual(answer.issues.filter(issue => issue.identity === 'source manifest').map(issue => issue.reason),
    ['2 declared source file header(s) were unavailable locally and were not inspected. This source inventory is incomplete.']);
  assert.deepEqual(answer.outcome,{selection:'none',coverage:'incomplete'});
});

test('exploration outcome separates unavailable searches from bounded empty and unsupported results',()=>{
  const base={ledgers:[],capabilities:[],targetCatalogue:[{id:'eris',name:'Eris',aliases:[]}],targetAssociations:[],bodyMaps:[]};
  const service=(state:'sampled'|'overflow'|'empty-in-scope'|'unavailable')=>({records:[],services:[{service:'fixture',state,scope:'bounded name search',reason:'Fixture status.'}]});
  const empty=explorationAnswer({target:'eris'},{...base,vo:service('empty-in-scope')});
  assert.deepEqual(empty.outcome,{selection:'none',coverage:'bounded'});
  assert.deepEqual(explorationAnswer({target:'eris'},{...base,vo:service('unavailable')}).outcome,{selection:'none',coverage:'incomplete'});
  assert.deepEqual(explorationAnswer({target:'eris'},{...base,vo:service('overflow')}).outcome,{selection:'none',coverage:'incomplete'});
  const unsupported=explorationAnswer({target:'eris'},{...base,sourceIntakeIssues:[{path:'unknown.fits',state:'unsupported',reason:'No decoder.'}]});
  assert.deepEqual(unsupported.outcome,{selection:'none',coverage:'bounded'});
  assert.equal(unsupported.unsupported.length,1);
  assert.deepEqual(explorationAnswer({target:'missing'},base).outcome,{selection:'none',coverage:'target-unresolved'});
  assert.deepEqual(explorationOutcome({...empty,coverage:[{telescope:'fixture',ledger:'fixture',state:'not-searched',reason:'Index was not queried.'}]}),{selection:'none',coverage:'incomplete'});
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
  assert.deepEqual(first.outcome,{selection:'available',coverage:'incomplete'});
});

test('unknown targets return suggestions without exposing provider results', () => {
  const answer = explorationAnswer({ target: 'eriss' }, { ledgers: [], capabilities: [], targetCatalogue: [{ id: 'eris', name: 'Eris', aliases: [] }], targetAssociations: [], bodyMaps: [],
    vo: { records: [], services: [{ service: 'should-not-leak', state: 'sampled', scope: 'fixture', reason: 'fixture' }] } });
  assert.equal(answer.targetResolution.status, 'unknown'); assert.deepEqual(answer.services, []); assert.equal(answer.issues[0]!.code, 'unknown-target');
});

test('an OPUS service joins the provider list and a target unknown to OPUS stays a provider fact, not an empty result',()=>{
  const opus={service:'https://opus.pds-rings.seti.org/api/' as const,state:'unknown-target' as const,scope:'OPUS surface-geometry search.',reason:'OPUS has no surface-geometry target named Eris.'};
  const answer=explorationAnswer({target:'eris'},{ledgers:[],capabilities:[],targetCatalogue:[{id:'eris',name:'Eris',aliases:[]}],targetAssociations:[],bodyMaps:[],opus});
  assert.deepEqual(answer.services,[opus]);
  assert.deepEqual(answer.issues.map(issue=>[issue.code,issue.identity]),[['provider-target-unknown',opus.service]]);
  assert.deepEqual(answer.outcome,{selection:'none',coverage:'bounded'});
});

test('source intake failures remain actionable in exploration without hiding selectable products', () => {
  const source = { id: 'image', target: 'sun', telescope: 'Fixture', mode: 'camera', kind: 'image' as const,
    archiveProductId: 'archive-image', decoder: 'fits-image' as const, files: [], identity: { OBJECT: 'SUN' },
    units: 'counts', meaning: 'fixture', citation: 'https://example.test/', limitations: [], qualified: false, receipt: 'image.receipt' };
  const answer = explorationAnswer({ target: 'sun' }, { ledgers: [], capabilities: [], targetCatalogue: [{ id: 'sun', name: 'Sun', aliases: [] }],
    targetAssociations: [], bodyMaps: [], sourceProducts: [source], qualifiedProducts: [], sourceIntakeIssues: [
      { path: 'broken.lbl', state: 'incomplete', reason: 'PDS product identity is absent.' },
      { path: 'extensions.fits', state: 'unsupported', reason: 'Extension-only products need an explicit observation declaration.' },
    ] });
  assert.equal(answer.choices.length, 1);
  assert.equal(answer.choices[0]!.state, 'qualify');
  assert.deepEqual(answer.unresolved, [{ scope: 'indexed-source', code: 'coverage', identity: 'broken.lbl', reason: 'PDS product identity is absent.' }]);
  assert.deepEqual(answer.unsupported, [{ scope: 'indexed-source', code: 'unsupported-observation', identity: 'extensions.fits', reason: 'Extension-only products need an explicit observation declaration.' }]);
});

test('explicit family filters separate known mismatches from selectable choices',()=>{
  const source={id:'image',target:'sun',telescope:'Fixture',mode:'camera',kind:'image' as const,archiveProductId:'archive-image',decoder:'fits-image' as const,files:[],identity:{OBJECT:'SUN'},units:'counts',meaning:'fixture',citation:'https://example.test/',limitations:[],qualified:false,receipt:'image.receipt'};
  const answer=explorationAnswer({target:'sun',family:'F16'},{ledgers:[],capabilities:[],targetCatalogue:[{id:'sun',name:'Sun',aliases:[]}],targetAssociations:[],bodyMaps:[],sourceProducts:[source],qualifiedProducts:[]});
  assert.deepEqual(answer.choices,[]);assert.deepEqual(answer.unresolved,[]);assert.equal(answer.unsupported.length,1);assert.match(answer.unsupported[0]!.reason,/F01, not F16/u);
});

test('an archive-owned physical-grid profile makes a cube selectable as F16',()=>{
  const familyEvidence={schema:'cssearth-observation-family-evidence@1' as const,families:['F16' as const],status:'source' as const,sourceTerm:'spherical physical grid',vocabulary:'fixture',vocabularyVersion:'1',owner:{kind:'source-product' as const,id:'density',evidence:'archive profile'}};
  const source={id:'density',target:'sun',telescope:'STEREO-A',mode:'SECCHI/COR1 tomography',kind:'cube' as const,archiveProductId:'archive-density',decoder:'fits-image' as const,files:[],identity:{NAXIS:3},familyEvidence,units:'cm^-3',meaning:'electron density',citation:'https://example.test/',limitations:[],qualified:false,receipt:'density.receipt'};
  const answer=explorationAnswer({target:'sun',family:'F16'},{ledgers:[],capabilities:[],targetCatalogue:[{id:'sun',name:'Sun',aliases:[]}],targetAssociations:[],bodyMaps:[],sourceProducts:[source],qualifiedProducts:[]});
  assert.equal(answer.choices.length,1);assert.deepEqual(answer.choices[0]!.familyEvidence.families,['F16']);assert.equal(answer.unresolved.length,0);
});
