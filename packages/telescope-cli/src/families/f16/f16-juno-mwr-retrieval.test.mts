import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sourceTest } from '../../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { member } from '../common.mts';
import { describeJunoMwrRetrieval, F16_JUNO_MWR_RETRIEVAL_HANDLER, inspectJunoMwrRetrieval, inspectJunoMwrTable, type JunoMwrRetrievalInput, type JunoMwrTableInput } from './f16-juno-mwr-retrieval.mts';
import { planetaryOutputPolicy } from '../../planetary-depth-policy.mts';

/** Synthetic bytes shaped exactly like JNOMWR_2100: a padded header record, comma-delimited ASCII_REAL rows, CRLF. */
const PRESSURES=[0.5,1.25,4] as const;
const LATITUDES=[-12.5,7.5] as const;
const NAMED=['12.5S','07.5N'] as const;
const ABUNDANCE=[[1.5e-7,2.5e-7],[3.5e-5,4.5e-5],[3.6e-4,3.5e-4]] as const;
const UNCERTAINTY=[[1e-8,2e-8],[3e-6,4e-6],[2e-5,1e-5]] as const;

const csv=(values:readonly (readonly number[])[])=>['pressure_bar',...LATITUDES.map(value=>`PC_lat${value<0?'':'+'}${value}`)].join(',')+'\r\n'
  +values.map((row,index)=>[PRESSURES[index],...row].join(',')).join('\r\n')+'\r\n';
const field=(number:number,name:string,description:string)=>`OBJECT                   = FIELD\n   NAME                  = "${name}"\n   DATA_TYPE             = ASCII_REAL\n   FIELD_NUMBER          = ${number}\n   BYTES                 = 25\n   DESCRIPTION           = "${description}"\n\nEND_OBJECT\n`;
const format=(kind:'A'|'U',prefixes:readonly string[])=>field(1,'pressure_bar','Pressure levels (bar)')
  +LATITUDES.map((value,index)=>field(index+2,`${prefixes[index]}_PC_lat_${NAMED[index]}`,
    `Ammonia abundance${kind==='U'?' 1 sigma uncertainty':''} at planetocentric latitude ${value<0?'':'+'}${value.toFixed(1)} degree`)).join('');
const label=(kind:'A'|'U',table:string,structure:string,body:string,overrides:Readonly<Record<string,string>>={})=>{
  const recordBytes=body.indexOf('\r\n')+2,rows=PRESSURES.length;
  const keys:Record<string,string>={PDS_VERSION_ID:'"PDS3"',RECORD_TYPE:'"STREAM"',RECORD_BYTES:String(recordBytes),FILE_RECORDS:String(rows+1),
    MD5_CHECKSUM:`"${createHash('md5').update(Buffer.from(body,'latin1')).digest('hex')}"`,
    DATA_SET_ID:'"JNO-J-MWR-5-NH3-DISTRIBUTION-V1.0"',PRODUCT_ID:`"${table}"`,STANDARD_DATA_PRODUCT_ID:`"NH3${kind}"`,PRODUCT_TYPE:`"NH3${kind}"`,
    PRODUCT_VERSION_ID:'"01"',INSTRUMENT_HOST_ID:'"JNO"',INSTRUMENT_ID:'"MWR"',INSTRUMENT_NAME:'"MICROWAVE RADIOMETER"',MISSION_NAME:'"JUNO"',
    TARGET_NAME:'"JUPITER"',PROCESSING_LEVEL_ID:'"5"',START_TIME:'2016-08-27T07:00:04.844',STOP_TIME:'2018-04-01T13:59:59.299',
    SPACECRAFT_CLOCK_START_COUNT:'"5/525553380.60452"',SPACECRAFT_CLOCK_STOP_COUNT:'"5/575863436.60452"',
    HEADER_FILE:`"${table}"`,SPREADSHEET_FILE:`"${table}"`,HEADER_BYTES:String(recordBytes),SPREADSHEET_OFFSET:String(recordBytes+1),
    ROWS:String(rows),ROW_BYTES:'40',FIELDS:String(LATITUDES.length+1),FIELD_DELIMITER:'"COMMA"',STRUCTURE:`"${structure}"`,...overrides};
  const scalars=['PDS_VERSION_ID','RECORD_TYPE','RECORD_BYTES','FILE_RECORDS','MD5_CHECKSUM','DATA_SET_ID','PRODUCT_ID','STANDARD_DATA_PRODUCT_ID','PRODUCT_TYPE','PRODUCT_VERSION_ID','INSTRUMENT_HOST_ID','INSTRUMENT_ID','INSTRUMENT_NAME','MISSION_NAME','TARGET_NAME','PROCESSING_LEVEL_ID','START_TIME','STOP_TIME','SPACECRAFT_CLOCK_START_COUNT','SPACECRAFT_CLOCK_STOP_COUNT'];
  return Buffer.from([...scalars.map(key=>`${key.padEnd(30)}= ${keys[key]}`),
    `^HEADER                       = (${keys.HEADER_FILE},1)`,'OBJECT                        = HEADER',`BYTES                         = ${keys.HEADER_BYTES}`,'HEADER_TYPE                   = "TEXT"','END_OBJECT                    = HEADER',
    `^SPREADSHEET                  = (${keys.SPREADSHEET_FILE},${keys.SPREADSHEET_OFFSET}<BYTES>)`,'OBJECT                        = SPREADSHEET',
    `ROWS                          = ${keys.ROWS}`,`ROW_BYTES                     = ${keys.ROW_BYTES}`,`FIELDS                        = ${keys.FIELDS}`,
    `FIELD_DELIMITER               = ${keys.FIELD_DELIMITER}`,`^STRUCTURE                    = ${keys.STRUCTURE}`,'END_OBJECT                    = SPREADSHEET','END',''].join('\r\n'),'latin1');
};

const ABUNDANCE_CSV=csv(ABUNDANCE),UNCERTAINTY_CSV=csv(UNCERTAINTY);
const abundanceTable=(overrides:Readonly<Record<string,string>>={},body=ABUNDANCE_CSV):JunoMwrTableInput=>({
  tableName:'MWRNH3A2016240070004_R00003_V01.CSV',table:Buffer.from(body,'latin1'),
  label:label('A','MWRNH3A2016240070004_R00003_V01.CSV','MWR_J_NH3A_V01.FMT',body,overrides),
  formatName:'MWR_J_NH3A_V01.FMT',format:Buffer.from(format('A',['NH3A','NH3A']),'latin1')});
const uncertaintyTable=(overrides:Readonly<Record<string,string>>={},body=UNCERTAINTY_CSV):JunoMwrTableInput=>({
  tableName:'MWRNH3U2016240070004_R00003_V01.CSV',table:Buffer.from(body,'latin1'),
  label:label('U','MWRNH3U2016240070004_R00003_V01.CSV','MWR_J_NH3U_V01.FMT',body,overrides),
  // The archive NH3U format file misspells its northern field names MH3U; the reader keys on FIELD_NUMBER and DESCRIPTION.
  formatName:'MWR_J_NH3U_V01.FMT',format:Buffer.from(format('U',['NH3U','MH3U']),'latin1')});
const fixture=():JunoMwrRetrievalInput=>({abundance:abundanceTable(),uncertainty:uncertaintyTable()});

const members=()=>({
  abundance:member('abundance','telescopes/juno-mwr/MWRNH3A2016240070004_R00003_V01.CSV','science',Buffer.from(ABUNDANCE_CSV,'latin1'),'text/csv'),
  uncertainty:member('uncertainty','telescopes/juno-mwr/MWRNH3U2016240070004_R00003_V01.CSV','uncertainty',Buffer.from(UNCERTAINTY_CSV,'latin1'),'text/csv'),
  abundanceLabel:member('abundance-label','telescopes/juno-mwr/MWRNH3A2016240070004_R00003_V01.LBL','label',fixture().abundance.label,'text/plain'),
  uncertaintyLabel:member('uncertainty-label','telescopes/juno-mwr/MWRNH3U2016240070004_R00003_V01.LBL','label',fixture().uncertainty.label,'text/plain'),
  abundanceFormat:member('abundance-format','telescopes/juno-mwr/MWR_J_NH3A_V01.FMT','support',fixture().abundance.format,'text/plain'),
  uncertaintyFormat:member('uncertainty-format','telescopes/juno-mwr/MWR_J_NH3U_V01.FMT','support',fixture().uncertainty.format,'text/plain'),
});

test('paired JNOMWR_2100 tables retain the archive pressure, planetocentric latitude, abundance and 1-sigma uncertainty',()=>{
  const retrieval=inspectJunoMwrRetrieval(fixture());
  assert.equal(retrieval.species,'NH3');
  assert.deepEqual(retrieval.pressureBars,[...PRESSURES]);
  assert.deepEqual(retrieval.latitudeDegrees,[...LATITUDES]);
  assert.equal(retrieval.abundance.pressureUnit,'bar');
  assert.deepEqual(retrieval.abundance.values,ABUNDANCE.map(row=>[...row]));
  assert.deepEqual(retrieval.uncertainty.values,UNCERTAINTY.map(row=>[...row]));
  assert.equal(retrieval.abundance.identity.productType,'NH3A');
  assert.equal(retrieval.uncertainty.identity.productType,'NH3U');
  assert.equal(retrieval.abundance.identity.rows,PRESSURES.length);
  assert.equal(retrieval.abundance.identity.fields,LATITUDES.length+1);
  assert.equal(retrieval.abundance.minimum,1.5e-7);
  assert.equal(retrieval.abundance.maximum,3.6e-4);
  assert.deepEqual(retrieval.abundance.misnamedFields,[]);
  assert.deepEqual(retrieval.uncertainty.misnamedFields,['MH3U_PC_lat_07.5N']);
  assert.equal(retrieval.abundance.identity.startTime,'2016-08-27T07:00:04.844');
});

test('the published descriptor keeps pressure native, pairs the uncertainty, and records the archive gaps',()=>{
  const retrieval=inspectJunoMwrRetrieval(fixture());
  const product=describeJunoMwrRetrieval({id:'juno-mwr-nh3-test',retrieval,members:members(),producingRecord:'synthetic JNOMWR_2100 fixture'});
  assert.equal(product.dataset.acquisition.identity,'JNO-J-MWR-5-NH3-DISTRIBUTION-V1.0');
  assert.deepEqual(product.dataset.profiles,[{handlerId:'f16-juno-mwr-retrieval',profileId:'juno-mwr-nh3-distribution@2024-10-22'}]);
  assert.equal(product.members.length,6);
  const abundance=product.components.find(component=>component.id==='abundance')!;
  const uncertainty=product.components.find(component=>component.id==='uncertainty')!;
  assert.deepEqual(abundance.axes.map(axis=>[axis.index,axis.role,axis.unit,axis.coordinates.kind]),[[0,'pressure','bar','lookup'],[1,'latitude','deg','lookup']]);
  assert.deepEqual(abundance.axes.map(axis=>axis.derivation?.state),['reconstruction-derived','archive-derived']);
  assert.equal(abundance.representation.kind==='physical-field'&&abundance.representation.samples,PRESSURES.length*LATITUDES.length);
  assert.equal(abundance.quantity.unit,'1');
  assert.equal(abundance.support?.class,'published-reconstruction');
  assert.equal(abundance.depth?.coordinate,'pressure');
  assert.equal(abundance.depth?.conversion.state,'native');
  assert.equal(abundance.observability?.localization,'inversion-dependent');
  assert.equal(abundance.observability?.measurementOperator,'microwave-radiative-transfer');
  assert.equal(abundance.resolution?.state,'unknown');
  assert.equal(abundance.inference?.kind,'archive-published');
  assert.deepEqual(abundance.uncertainty,{form:'standard-deviation',componentId:'uncertainty',
    basis:'Paired MWRNH3U2016240070004_R00003_V01.CSV; MWR_J_NH3U_V01.FMT states every column is the 1 sigma uncertainty of the matching abundance column.'});
  assert.equal(uncertainty.uncertainty?.form,'none-supplied');
  assert.ok(product.issues.some(issue=>issue.identity==='abundance'&&issue.state==='missing'&&/states a unit/u.test(issue.reason)));
  assert.ok(product.issues.some(issue=>issue.identity==='uncertainty-format'&&issue.state==='conflicting'&&/MH3U_PC_lat_07\.5N/u.test(issue.reason)));

  for(const component of [abundance,uncertainty]){
    const policy=planetaryOutputPolicy(component),verdict=(output:string)=>policy.find(value=>value.output===output)!;
    assert.equal(verdict('native').available,true);
    assert.equal(verdict('slice').available,true);
    assert.equal(verdict('profile').available,true);
    assert.equal(verdict('isosurface').available,false);
    assert.equal(verdict('body-attachment').available,false);
    assert.match(verdict('body-attachment').reason,/requires an explicit validated planetary placement descriptor/u);
    assert.equal(component.placement,undefined);
  }

  assert.deepEqual(F16_JUNO_MWR_RETRIEVAL_HANDLER.recognizes(product.members.map(value=>({path:value.path,prefix:Buffer.alloc(0)}))),['juno-mwr-nh3-distribution@2024-10-22']);
  assert.deepEqual(F16_JUNO_MWR_RETRIEVAL_HANDLER.recognizes([{path:'MWRNH3A2016240070004_R00548_V01.LBL',prefix:Buffer.alloc(0)}]),[]);
  const operations=F16_JUNO_MWR_RETRIEVAL_HANDLER.operations(product);
  assert.deepEqual(operations.map(value=>[value.id,value.componentId,value.available]),
    [['juno-mwr-retrieval-inspect','abundance',true],['juno-mwr-retrieval-native','abundance',true],
      ['juno-mwr-retrieval-inspect','uncertainty',true],['juno-mwr-retrieval-native','uncertainty',true]]);
  assert.deepEqual([...new Set(operations.map(value=>value.owner.export))],['inspectJunoMwrRetrieval','exportJunoMwrRetrievalNative']);
});

test('the reader refuses a label whose pointers, checksum or declared counts do not close',()=>{
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({MD5_CHECKSUM:'"'+'0'.repeat(32)+'"'}),'abundance'),/does not match the label MD5_CHECKSUM/u);
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({SPREADSHEET_FILE:'"OTHER.CSV"'}),'abundance'),/\^SPREADSHEET file must be/u);
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({HEADER_FILE:'"OTHER.CSV"'}),'abundance'),/\^HEADER file must be/u);
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({STRUCTURE:'"MWR_J_H2OA_V01.FMT"'}),'abundance'),/\^STRUCTURE must be/u);
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({SPREADSHEET_OFFSET:'999'}),'abundance'),/\^SPREADSHEET offset must be/u);
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({HEADER_BYTES:'999'}),'abundance'),/HEADER BYTES must be/u);
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({FILE_RECORDS:'9'}),'abundance'),/plus the one header record/u);
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({FIELDS:'9'}),'abundance'),/format file declares 3 fields, not the label's 9/u);
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({PROCESSING_LEVEL_ID:'"3"'}),'abundance'),/PROCESSING_LEVEL_ID must be 5/u);
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({DATA_SET_ID:'"JNO-J-MWR-3-RDR-V1.0"'}),'abundance'),/not a Juno MWR level-5 distribution dataset/u);
  assert.throws(()=>inspectJunoMwrTable(abundanceTable(),'uncertainty'),/PRODUCT_TYPE must be NH3U/u);
});

test('the reader refuses tables whose coordinates, values or format roles are wrong',()=>{
  const reordered=['pressure_bar','PC_lat-12.5','PC_lat+7.5'].join(',')+'\r\n'+[[4,1e-7,2e-7],[1.25,2e-7,3e-7],[0.5,3e-7,4e-7]].map(row=>row.join(',')).join('\r\n')+'\r\n';
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({},reordered),'abundance'),/pressures must increase strictly/u);
  const shifted=['pressure_bar','PC_lat-12.5','PC_lat+9.5'].join(',')+'\r\n'+ABUNDANCE.map((row,index)=>[PRESSURES[index],...row].join(',')).join('\r\n')+'\r\n';
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({},shifted),'abundance'),/header latitude 9\.5 does not match the format file's 7\.5/u);
  const negative=ABUNDANCE_CSV.replace('1.5e-7','-1.5e-7');
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({},negative),'abundance'),/cannot be/u);
  const quoted=ABUNDANCE_CSV.replace('1.5e-7','"1.5e-7"');
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({},quoted),'abundance'),/must not contain quoted text/u);
  const short=ABUNDANCE_CSV.split('\r\n').map((line,index)=>index===PRESSURES.length?line.split(',').slice(0,2).join(','):line).join('\r\n');
  assert.throws(()=>inspectJunoMwrTable(abundanceTable({},short),'abundance'),/has 2 fields, not the declared 3/u);
  const abundanceFormatInUncertainty={...uncertaintyTable(),format:Buffer.from(format('A',['NH3U','NH3U']),'latin1')};
  assert.throws(()=>inspectJunoMwrTable(abundanceFormatInUncertainty,'uncertainty'),/must state a 1 sigma uncertainty/u);
  const uncertaintyFormatInAbundance={...abundanceTable(),format:Buffer.from(format('U',['NH3A','NH3A']),'latin1')};
  assert.throws(()=>inspectJunoMwrTable(uncertaintyFormatInAbundance,'abundance'),/must not state a 1 sigma uncertainty/u);
});

test('the pair must be one grid from one dataset',()=>{
  const deeper=UNCERTAINTY_CSV.split('\r\n').map(line=>line.startsWith('4,')?`5,${line.slice(2)}`:line).join('\r\n');
  assert.throws(()=>inspectJunoMwrRetrieval({abundance:abundanceTable(),uncertainty:uncertaintyTable({},deeper)}),/paired pressure coordinates differ/u);
  assert.throws(()=>inspectJunoMwrRetrieval({abundance:abundanceTable(),uncertainty:uncertaintyTable({START_TIME:'2017-01-01T00:00:00.000'})}),/START_TIME differ/u);
  assert.throws(()=>inspectJunoMwrRetrieval({abundance:abundanceTable(),uncertainty:uncertaintyTable({SPACECRAFT_CLOCK_STOP_COUNT:'"5/1.0"'})}),/SPACECRAFT_CLOCK_STOP_COUNT differ/u);
});
