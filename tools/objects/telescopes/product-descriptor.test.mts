import assert from 'node:assert/strict';
import test from 'node:test';
import { describeRasterCompatibility, familyCoverageLedger, familyProfile, operationsForDescriptor } from './family-handlers.mts';
import { parseProductDescriptor } from './product-descriptor.mts';

const pin=(id:string,role:'science'|'support')=>({id,path:`files/${id}.fits`,role,bytes:80,sha256:(id==='science'?'a':'b').repeat(64),mediaType:'application/fits'} as const);
const metadata={structure:'SCI',fitsHdu:1,shape:[1,3,4,5],quality:{policy:'finite zero DQ',samples:60,finite:60,usable:59,flagged:1,invalidUncertainty:0,mask:'DQ'},uncertainty:{status:'validated' as const,kind:'standard-deviation',structure:'ERR'},units:{value:'Jy',source:'BUNIT'},spectral:{axis:1,centersMicrometres:[2,2.1,2.2],binEdgesMicrometres:[1.95,2.05,2.15,2.25],source:'FITS WCS'},calibration:[{field:'CAL_VER',value:'1'}],limitations:['Beam evidence is absent.']};
const descriptor=()=>describeRasterCompatibility({dataset:{id:'fixture',target:'eris',acquisition:{kind:'local-import',identity:'fixture-import'},producingRecord:'import.product.json',sourceClassifications:[{term:'cube',vocabulary:'IVOA product-type',version:'2026-01-15',status:'mapped'}]},profile:'fits-image-array@1',members:[pin('science','science'),pin('response','support')],scienceMemberId:'science',nativeMetadata:metadata,quantity:{name:'spectral flux density',semantics:'Calibrated sampled intensity.'},calibration:{state:'archive-calibrated',basis:['FITS calibration headers were retained.']},dependencies:[{id:'response',role:'response evidence',memberIds:['response'],componentIds:[],requiredFor:['physical-flux'],evidence:'response receipt'}]});

test('descriptor@1 retains named components, meaningful singleton axes, members, semantics and scoped issues',()=>{
  const value=parseProductDescriptor(descriptor()),component=value.components[0]!;
  assert.equal(value.schema,'cssearth-telescope-product-descriptor@1');assert.deepEqual(value.dataset.families,['F02']);assert.equal(value.members.length,2);
  assert.deepEqual(value.dataset.profiles,[{handlerId:'raster-f01-f02',profileId:'fits-image-array@1'}]);
  assert.deepEqual(component.representation,{kind:'array',shape:[1,3,4,5],storageOrder:'native'});assert.equal(component.axes[0]!.length,1);assert.equal(component.axes[1]!.role,'spectral');
  assert.equal(component.quantity.unit,'Jy');assert.equal(component.calibration.state,'archive-calibrated');assert.equal(component.uncertainty?.form,'standard-deviation');assert.equal(component.flags[0]?.id,'quality-mask');
  assert.equal(value.dependencies[0]?.memberIds[0],'response');assert.match(value.issues[0]?.reason??'',/Beam evidence/u);
});

test('static raster handler owns profiles, typed operation parameters and existing owner references',()=>{
  const profile=familyProfile('fits-image-array@1');assert.equal(profile.handler.id,'raster-f01-f02');assert.deepEqual(profile.profile.families,['F01','F02']);assert.ok(profile.profile.evidence.length>0);
  const coverage=familyCoverageLedger();assert.equal(coverage.length,18);assert.equal(new Set(coverage.map(row=>row.family)).size,18);assert.deepEqual(coverage.map(row=>[row.family,row.status]),Array.from({length:18},(_,index)=>[`F${String(index+1).padStart(2,'0')}`,'complete']));assert.equal(coverage.find(row=>row.family==='F10')?.status,'complete','an optional descriptor-only profile does not erase a proven public family baseline');
  const operations=operationsForDescriptor(descriptor()),image=operations.find(operation=>operation.id==='image'),spectrum=operations.find(operation=>operation.id==='spectrum');
  assert.equal(image?.available,true);assert.deepEqual(image?.fixedArguments,{hdu:1,structure:'SCI'});assert.deepEqual(image?.parameters.map(parameter=>parameter.id),['plane','out']);
  assert.equal(spectrum?.available,true);assert.equal(spectrum?.owner.export,'exportOutput');assert.equal(spectrum?.parameters[0]?.kind,'number-list');
});

test('descriptor parser rejects embedded data and dangling member or dependency references',()=>{
  const value=descriptor();assert.throws(()=>parseProductDescriptor({...value,data:[1,2,3]}),/unsupported field data/u);
  assert.throws(()=>parseProductDescriptor({...value,components:value.components.map(component=>({...component,locations:[{memberId:'missing'}]}))}),/missing member/u);
  assert.throws(()=>parseProductDescriptor({...value,components:value.components.map(component=>({...component,dependencyIds:['missing']}))}),/missing dependency/u);
});
