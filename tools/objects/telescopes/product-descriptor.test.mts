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

test('descriptor retains planetary depth meaning and refuses unsupported conversions or coverage',()=>{
  const value=descriptor(),component={...value.components[0]!,representation:{kind:'physical-field' as const,topology:'grid' as const,samples:60},axes:[
    {id:'x',index:0,length:4,role:'projected-x',unit:'m',coordinates:{kind:'linear' as const,referenceValue:0,referenceIndex:0,increment:100},reference:'Mars north polar stereographic projection',derivation:{state:'archive-derived' as const,assumptions:[]}},
    {id:'y',index:1,length:5,role:'projected-y',unit:'m',coordinates:{kind:'linear' as const,referenceValue:0,referenceIndex:0,increment:100},reference:'Mars north polar stereographic projection',derivation:{state:'archive-derived' as const,assumptions:[]}},
    {id:'delay',index:2,length:3,role:'delay',unit:'us',coordinates:{kind:'linear' as const,referenceValue:0,referenceIndex:0,increment:.0375},reference:'SHARAD two-way delay',derivation:{state:'observed' as const,assumptions:[]}},
  ],support:{class:'published-reconstruction' as const,domain:{kind:'full-grid' as const,description:'Archive-published reconstruction.',memberIds:['science']},unsupportedRegions:[{kind:'mask' as const,description:'Archive missing-value cells remain unsupported.',memberId:'science'}]},depth:{coordinate:'delay' as const,positiveDirection:'down' as const,datum:'surface echo',conversion:{state:'unavailable' as const,parameters:[],uncertainty:'No dielectric model selected.'}},observability:{measurementOperator:'radar-propagation' as const,coverage:{kind:'tracks' as const,description:'Crossing source tracks.',memberIds:['response']},localization:'inversion-dependent' as const},sampling:{axes:[{axisId:'x',kind:'regular' as const,interval:100,unit:'m',basis:'archive coordinate spacing'}]},resolution:{state:'estimated' as const,elements:[{axisId:'x',range:[300,3000] as const,unit:'m',description:'published effective horizontal resolution'}],basis:'published resolution analysis',memberIds:['response']},inference:{kind:'archive-published' as const,method:'archive reconstruction',assumptions:['processing assumptions retained by source'],validation:'archive publication and processing record',memberIds:['response']}};
  const parsed=parseProductDescriptor({...value,components:[component]});assert.equal(parsed.components[0]?.depth?.coordinate,'delay');assert.equal(parsed.components[0]?.support?.class,'published-reconstruction');assert.equal(parsed.components[0]?.axes[2]?.derivation?.state,'observed');assert.equal(parsed.components[0]?.sampling?.axes[0]?.interval,100);assert.equal(parsed.components[0]?.resolution?.elements[0]?.range?.[1],3000);assert.equal(parsed.components[0]?.inference?.kind,'archive-published');
  assert.throws(()=>parseProductDescriptor({...value,components:[{...component,depth:{...component.depth,coordinate:'geometric-depth'}}]}),/no matching axis/u);
  assert.throws(()=>parseProductDescriptor({...value,components:[{...component,depth:{...component.depth,conversion:{state:'derived',parameters:[],uncertainty:'unknown'}}}]}),/requires a method/u);
  assert.throws(()=>parseProductDescriptor({...value,components:[{...component,support:{...component.support,domain:{...component.support.domain,memberIds:['missing']}}}]}),/support references missing member/u);
  assert.throws(()=>parseProductDescriptor({...value,components:[{...component,inference:undefined}]}),/requires inference method/u);
  assert.throws(()=>parseProductDescriptor({...value,components:[{...component,resolution:{...component.resolution,elements:[{axisId:'missing',value:1,unit:'m',description:'bad'}]}}]}),/resolution references missing axis/u);
});
