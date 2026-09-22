import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();import {fileURLToPath} from 'node:url';
import {APOLLO_PSE_STATIONS,CONSERT_67P_FSS_RANGING,F16_PLANETARY_COVERAGE_HANDLER,describeSparsePlanetaryCoverage,exportSparsePlanetaryCoverageCsv,exportSparsePlanetaryCoverageJson,inspectSparsePlanetaryCoverage,pairPds3AsciiRows,pds3AsciiRows,pds3GeometryUnit,readFdsnStationRows,readPds3AsciiTable,refuseSparseCoveragePromotion,sparseCoverageSamples,type SparseCoverageKind,type SparsePlanetaryCoverageInput} from './f16-planetary-coverage.mts';
import {member} from './common.mts';

const root=(path:string)=>fileURLToPath(new URL(`../../../../${path}`,import.meta.url));
const consert=(name:string)=>root(`tests/fixtures/telescope-families/consert-67p-fss/${name}`);
const consertPackage=(name:string)=>root(`src/objects/comet-67p/source/telescopes/consert/${name}`);
const apolloPse=root('src/objects/moon/source/telescopes/apollo-pse/stationxml.xa.0.sxml');
const LIMITATIONS=['Exact tracks, rays, stations, or profiles remain sparse support; no interpolation is performed.','This coverage cannot be promoted to a grid, volume, material property, interior model, or interpolated field.'];

const science=member('science','coverage.csv','science',Buffer.from('exact samples'),'text/csv'),geometry=member('geometry','geometry.json','coordinates',Buffer.from('exact geometry'),'application/json');
const input=(kind:SparseCoverageKind='track'):SparsePlanetaryCoverageInput=>({id:`fixture-${kind}`,target:kind==='ray'?'comet-67p':'moon',producingRecord:'fixture record',members:[science,geometry],scienceMemberIds:['science'],kind,
  samples:kind==='ray'
    ?[{id:'chord-1',memberId:'science',geometry:{kind:'body-fixed-ray',start:[-1,0,0],end:[1,0,0],unit:'km'},nativeCoordinate:12.5,nativeCoordinateUnit:'us'}]
    :[{id:'sample-1',memberId:'science',geometry:kind==='station'?{kind:'longitude-latitude',longitude:23,latitude:-4,unit:'deg'}:{kind:'body-fixed-point',x:1,y:2,z:3,unit:'m'},nativeCoordinate:2,nativeCoordinateUnit:kind==='profile'?'s':'m'}],
  frame:{kind:'body-fixed',name:kind==='ray'?'67P/C-G body-fixed':'Moon body-fixed'},quantity:{name:'native return',unit:'1',semantics:'fixture measurement'},calibration:{state:'archive-calibrated',basis:['fixture']},
  observability:{measurementOperator:kind==='profile'?'seismic-wave-propagation':'radar-propagation',coverage:{kind:kind==='track'?'tracks':kind==='ray'?'rays':kind==='station'?'stations':'profiles',description:'exact fixture support',memberIds:['science']},localization:'direct'},
  unsupportedRegions:[{kind:'unobserved',description:'all unsampled interior'}],coverageDescription:'exact fixture support'});

test('sparse tracks retain exact geometry, masks, and export-only outputs',()=>{
  const value=input(),inspection=inspectSparsePlanetaryCoverage(value),product=describeSparsePlanetaryCoverage(value),csv=exportSparsePlanetaryCoverageCsv(value),json=JSON.parse(exportSparsePlanetaryCoverageJson(value));
  assert.deepEqual(inspection,{kind:'track',samples:1,geometry:'body-fixed',memberIds:['science'],unsupportedRegions:1,limitations:LIMITATIONS});
  assert.equal(product.components[0]?.representation.kind,'physical-field');
  assert.equal(product.components[0]?.representation.kind==='physical-field'&&product.components[0].representation.topology,'points');
  assert.equal(product.components[0]?.axes.length,0);
  assert.match(csv,/sample-1/u);assert.equal(json.coverage.unsupportedRegions.length,1);
});

test('CONSERT-style rays and located stations retain their actual geometry',()=>{
  const ray=describeSparsePlanetaryCoverage(input('ray')),station=inspectSparsePlanetaryCoverage(input('station'));
  assert.equal(ray.components[0]?.support?.domain.kind,'rays');assert.equal(station.geometry,'located');
  assert.match(exportSparsePlanetaryCoverageCsv(input('ray')),/body-fixed-ray/u);
});

test('coverage refuses incompatible geometry and every grid or volume promotion',()=>{
  assert.throws(()=>inspectSparsePlanetaryCoverage({...input('ray'),samples:[{...input('ray').samples[0]!,geometry:{kind:'body-fixed-point',x:0,y:0,z:0,unit:'km'}}]}),/ray endpoints/u);
  for(const promotion of ['grid','volume','material-property','interior-model','interpolated-field'] as const)assert.throws(()=>refuseSparseCoveragePromotion(promotion),/cannot be promoted/u);
});

test('coverage refuses an undeclared unobserved remainder, a non-body-fixed frame, an out-of-range angle and a relabelled unit',()=>{
  assert.throws(()=>inspectSparsePlanetaryCoverage({...input(),unsupportedRegions:[{kind:'mask',description:'a mask is not the unobserved remainder'}]}),/unobserved remainder/u);
  assert.throws(()=>inspectSparsePlanetaryCoverage({...input(),frame:{kind:'sky',name:'ICRF'}}),/body-fixed frame/u);
  assert.throws(()=>inspectSparsePlanetaryCoverage({...input('station'),samples:[{id:'bad',memberId:'science',geometry:{kind:'longitude-latitude',longitude:23,latitude:-104,unit:'deg'}}]}),/latitude lies outside/u);
  assert.throws(()=>inspectSparsePlanetaryCoverage({...input('station'),samples:[{id:'bad',memberId:'science',geometry:{kind:'longitude-latitude',longitude:23,latitude:-4,unit:'km'}}]}),/must state an angle unit/u);
  assert.throws(()=>inspectSparsePlanetaryCoverage({...input(),samples:[{id:'bad',memberId:'science',geometry:{kind:'body-fixed-point',x:1,y:2,z:3,unit:'deg'}}]}),/must state a length unit/u);
  assert.throws(()=>inspectSparsePlanetaryCoverage({...input(),samples:[{id:'bad',memberId:'absent',geometry:{kind:'body-fixed-point',x:1,y:2,z:3,unit:'m'}}]}),/absent member/u);
  assert.throws(()=>inspectSparsePlanetaryCoverage({...input(),samples:[{id:'bad',memberId:'science',geometry:{kind:'body-fixed-point',x:1,y:2,z:3,unit:'m'},nativeCoordinate:1}]}),/native coordinate and unit together/u);
});

test('an archive row missing a support coordinate is refused, never completed',()=>{
  const map={memberId:'science',idColumn:'ID',idPrefix:'row',unit:'km',geometry:{kind:'body-fixed-point' as const,x:'X',y:'Y',z:'Z'}};
  assert.deepEqual(sparseCoverageSamples([{ID:'a',X:1,Y:2,Z:3}],map),[{id:'row-a',memberId:'science',geometry:{kind:'body-fixed-point',x:1,y:2,z:3,unit:'km'}}]);
  assert.throws(()=>sparseCoverageSamples([{ID:'a',X:1,Y:2}],map),/no column Z/u);
  assert.throws(()=>sparseCoverageSamples([{ID:'a',X:1,Y:2,Z:null}],map),/refuses to fill/u);
});

test('the real Apollo PSE StationXML gives five located ALSEP stations and no lunar interior',async()=>{
  const xml=await readFile(apolloPse,'utf8'),rows=readFdsnStationRows(xml);
  assert.deepEqual(rows.map(row=>row.STATION),['S11','S12','S14','S15','S16']);
  assert.deepEqual(rows[0],{NETWORK:'XA',STATION:'S11',SITE_NAME:'ALSEP 11, Mare Tranquillitatis, Moon',LATITUDE:0.67416,LONGITUDE:23.473146,ELEVATION:-1929});
  const stations=member('stations','telescopes/apollo-pse/stationxml.xa.0.sxml','coordinates',Buffer.from(xml,'utf8'),'application/xml');
  const samples=sparseCoverageSamples(rows,{memberId:stations.id,idColumn:'STATION',idPrefix:'apollo-pse',unit:'deg',geometry:{kind:'longitude-latitude',longitude:'LONGITUDE',latitude:'LATITUDE'},nativeCoordinate:{column:'ELEVATION',unit:APOLLO_PSE_STATIONS.elevationUnit},noteColumn:'SITE_NAME'});
  const value:SparsePlanetaryCoverageInput={id:'apollo-pse-stationxml-xa-0',target:'moon',producingRecord:APOLLO_PSE_STATIONS.productLid,members:[stations],scienceMemberIds:[stations.id],kind:'station',samples,
    frame:APOLLO_PSE_STATIONS.frame,quantity:{name:'ALSEP seismic station location',unit:'deg',semantics:'Archive-published station longitude and latitude with its elevation as the native coordinate.'},
    calibration:{state:'archive-calibrated',basis:[APOLLO_PSE_STATIONS.frameEvidence]},
    observability:{measurementOperator:'seismic-wave-propagation',coverage:{kind:'stations',description:'Five located ALSEP stations',memberIds:[stations.id]},localization:'direct'},
    unsupportedRegions:[{kind:'unobserved',description:'The lunar interior and every unstationed part of the surface.',memberId:stations.id}],coverageDescription:'Five located ALSEP seismic stations'};
  const inspection=inspectSparsePlanetaryCoverage(value),product=describeSparsePlanetaryCoverage(value);
  assert.deepEqual(inspection,{kind:'station',samples:5,geometry:'located',memberIds:[stations.id],unsupportedRegions:1,limitations:LIMITATIONS});
  assert.equal(product.components[0]?.support?.domain.kind,'regions');
  assert.equal(product.components[0]?.frame?.name,'DE421 Mean Earth / Rotation Axis');
  assert.match(exportSparsePlanetaryCoverageCsv(value),/apollo-pse-S16,stations,longitude-latitude,deg,15\.49649,-8\.97577,,,,,7,m,"ALSEP 16, Descartes, Moon"/u);
});

test('the real CONSERT level-4 geometry tables give exact body-fixed ray endpoints',async()=>{
  const [orbiterLabel,landerLabel]=await Promise.all([readFile(consert('cn_g_o_fssrng_f.lbl'),'utf8'),readFile(consert('cn_g_l_fssrng_f.lbl'),'utf8')]);
  const [orbiterBytes,landerBytes]=await Promise.all([readFile(consert('cn_g_o_fssrng_f.tab')),readFile(consert('cn_g_l_fssrng_f.tab'))]);
  const orbiterTable=readPds3AsciiTable(orbiterLabel),landerTable=readPds3AsciiTable(landerLabel);
  assert.equal(orbiterTable.dataSetId,CONSERT_67P_FSS_RANGING.dataSetId);assert.equal(orbiterTable.productId,'CN_G_O_FSSRNG_F');assert.equal(landerTable.productId,'CN_G_L_FSSRNG_F');
  assert.deepEqual([orbiterTable.rows,orbiterTable.columns.length,landerTable.rows,landerTable.columns.length],[11,16,11,13]);
  const columns=[...CONSERT_67P_FSS_RANGING.positionColumns];
  assert.equal(orbiterTable.columns.find(column=>column.name==='SC_POS_X')?.unit,CONSERT_67P_FSS_RANGING.positionArchiveUnit);
  const unit=pds3GeometryUnit(orbiterTable.columns.find(column=>column.name==='SC_POS_X')!);assert.equal(unit,'km');
  const rows=()=>[{prefix:'lander',rows:pds3AsciiRows(landerTable,landerBytes,columns)},{prefix:'orbiter',rows:pds3AsciiRows(orbiterTable,orbiterBytes,columns)}] as const;
  const [lander,orbiter]=rows(),paired=pairPds3AsciiRows(lander,orbiter,{utcColumn:'UTC',toleranceMs:CONSERT_67P_FSS_RANGING.pairingToleranceMs});
  const members=[member('orbiter-table','telescopes/consert/cn_g_o_fssrng_f.tab','science',orbiterBytes,'text/plain'),member('orbiter-label','telescopes/consert/cn_g_o_fssrng_f.lbl','label',Buffer.from(orbiterLabel,'latin1'),'text/plain'),
    member('lander-table','telescopes/consert/cn_g_l_fssrng_f.tab','coordinates',landerBytes,'text/plain'),member('lander-label','telescopes/consert/cn_g_l_fssrng_f.lbl','label',Buffer.from(landerLabel,'latin1'),'text/plain')];
  const samples=sparseCoverageSamples(paired,{memberId:'orbiter-table',idColumn:'orbiter_UTC',idPrefix:'consert-fssrng-f',unit,
    geometry:{kind:'body-fixed-ray',start:['lander_SC_POS_X','lander_SC_POS_Y','lander_SC_POS_Z'],end:['orbiter_SC_POS_X','orbiter_SC_POS_Y','orbiter_SC_POS_Z']}});
  const value:SparsePlanetaryCoverageInput={id:'consert-4-fss-ranging-final',target:'comet-67p',producingRecord:CONSERT_67P_FSS_RANGING.dataSetId,members,scienceMemberIds:['orbiter-table','lander-table'],kind:'ray',samples,
    frame:CONSERT_67P_FSS_RANGING.frame,quantity:{name:'CONSERT sounding path endpoints',unit,semantics:'Archive-published Philae and Rosetta positions at each sounding, retained as the two ends of the propagation path.'},
    calibration:{state:'archive-calibrated',basis:[CONSERT_67P_FSS_RANGING.frameEvidence]},
    observability:{measurementOperator:'radar-propagation',coverage:{kind:'rays',description:'Eleven CONSERT sounding paths',memberIds:['orbiter-table','lander-table']},localization:'direct'},
    unsupportedRegions:[{kind:'unobserved',description:'Every part of the nucleus that no retained path crosses.'},
      {kind:'geometric',description:'Whether a retained path crosses the nucleus at all depends on a shape model this product does not supply.'}],
    coverageDescription:'Eleven CONSERT sounding paths as exact body-fixed endpoints'};
  const inspection=inspectSparsePlanetaryCoverage(value),product=describeSparsePlanetaryCoverage(value),json=JSON.parse(exportSparsePlanetaryCoverageJson(value));
  assert.deepEqual(inspection,{kind:'ray',samples:11,geometry:'body-fixed',memberIds:['orbiter-table'],unsupportedRegions:2,limitations:LIMITATIONS});
  assert.deepEqual(samples[0],{id:'consert-fssrng-f-2014-11-14T23:42:00.235',memberId:'orbiter-table',geometry:{kind:'body-fixed-ray',start:[2.447633,-0.07692,-0.352882],end:[27.436377,-31.726165,20.442626],unit:'km'}});
  assert.equal(product.components[0]?.support?.domain.kind,'rays');assert.equal(product.components[0]?.frame?.name,'Comet Fixed Frame');
  assert.equal(json.coverage.samples.length,11);assert.equal(json.coverage.unsupportedRegions.length,2);
  assert.match(exportSparsePlanetaryCoverageCsv(value),/^consert-fssrng-f-2014-11-14T23:46:00\.124,orbiter-table,body-fixed-ray,km,2\.447633,-0\.07692,-0\.352883,26\.364328,-32\.589397,20\.480087,,,$/mu);
  // The two tables round the same instant to their own millisecond, so a zero-tolerance pairing must be refused.
  const [landerAgain,orbiterAgain]=rows();
  assert.throws(()=>pairPds3AsciiRows(landerAgain,orbiterAgain,{utcColumn:'UTC',toleranceMs:0}),/beyond the stated 0 ms/u);
});

test('the pinned full CONSERT sequence labels describe the same table structure at its real size',async()=>{
  const [orbiter,lander]=await Promise.all([readFile(consertPackage('cn_g_o_fss.lbl'),'utf8'),readFile(consertPackage('cn_g_l_fss.lbl'),'utf8')]);
  for(const [label,productId,columns] of [[orbiter,'CN_G_O_FSS',16],[lander,'CN_G_L_FSS',13]] as const){
    const table=readPds3AsciiTable(label);
    assert.equal(table.productId,productId);assert.equal(table.dataSetId,CONSERT_67P_FSS_RANGING.dataSetId);
    assert.equal(table.rows,15468);assert.equal(table.columns.length,columns);
    for(const name of ['SC_POS_X','SC_POS_Y','SC_POS_Z'])assert.equal(pds3GeometryUnit(table.columns.find(column=>column.name===name)!),'km');
  }
});

test('the handler offers export-only operations and names every refused promotion',()=>{
  const operations=F16_PLANETARY_COVERAGE_HANDLER.operations(describeSparsePlanetaryCoverage(input('ray')));
  assert.deepEqual(operations.filter(operation=>operation.available).map(operation=>operation.id),['coverage-inspect','coverage-native-csv','coverage-json']);
  const refused=operations.filter(operation=>!operation.available);
  assert.deepEqual(refused.map(operation=>operation.id),['coverage-grid','coverage-volume','coverage-material-property','coverage-interior-model','coverage-interpolated-field']);
  assert.ok(refused.every(operation=>operation.owner.export==='refuseSparseCoveragePromotion'&&/cannot be promoted/u.test(operation.reason)));
  assert.ok(operations.every(operation=>operation.limitations.length===2));
  assert.equal(F16_PLANETARY_COVERAGE_HANDLER.operations(describeSparsePlanetaryCoverage(input('station'))).length,8);
  assert.deepEqual(F16_PLANETARY_COVERAGE_HANDLER.recognizes([{path:'anything.tab',prefix:new Uint8Array()}]),[]);
});
