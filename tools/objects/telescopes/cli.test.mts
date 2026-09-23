import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { resolve } from 'node:path';
import{mkdtemp,rm,writeFile}from'node:fs/promises';import{tmpdir}from'node:os';
import { formatArtifact, formatExploration, formatSession, main, outputCommand, parseCli, type ArtifactInspection, type CliIo, type CliServices } from './cli.mts';
import type { ExplorationSession } from './session.mts';
import type { Session } from './session.mts';
import { loadWwtImagery } from './wwt-catalog.mts';

const choice = { pick:1,key:'fixture-choice',state:'qualify' as const,target:'eris',telescope:'Fixture telescope',mode:'camera',observation:'obs-1',program:'eris-obs-1',
  reference:{kind:'indexed-observation' as const,telescope:'Fixture telescope',mode:'camera',observation:'obs-1',programme:'eris-obs-1'},
  familyEvidence:{schema:'cssearth-observation-family-evidence@1' as const,families:['F01' as const],status:'mapped' as const,sourceTerm:'image',vocabulary:'IVOA product-type',vocabularyVersion:'1.1',owner:{kind:'archive-adapter' as const,id:'fixture',evidence:'fixture ledger'}},
  display:{instrument:'Fixture camera',observationTime:{startIso:'2025-01-02T03:04:05.000Z',endIso:null},productKind:'image',wavelengthsMicrometres:[[2.2,2.4]] as const,advertisedKilobytes:null,metadataBasis:'indexed' as const},
  reason:'Exact source product can be qualified.',limitations:['Resolution is not established.'] };
const answer = {schema:'cssearth-telescope-exploration@1' as const,request:{target:'eris'},target:'eris',targetResolution:{status:'resolved' as const,requested:'Eris',canonical:{id:'eris',name:'Eris'},matchedBy:'name' as const},
  outcome:{selection:'available' as const,coverage:'incomplete' as const},
  choices:[choice],unresolved:[{scope:'observation' as const,code:'filter-unresolved' as const,identity:'Maybe / row',reason:'Advertised product family is unknown.'}],unsupported:[{scope:'observation' as const,code:'unsupported-observation' as const,identity:'Other / row',reason:'No supported exact access operation.'}],
  issues:[{scope:'provider' as const,code:'provider-overflow' as const,identity:'Archive',reason:'Bounded result overflowed.'}],services:[],coverage:[]};
const exploration=(directory:string):ExplorationSession&{readonly directory:string}=>({schema:'cssearth-telescope-exploration@1',createdAt:'2026-09-20T12:00:00.000Z',arguments:['eris'],target:'eris',choices:[choice],answer,directory});
const context={kind:'exploration' as const,target:'eris',discovery:{schema:'cssearth-telescope-exploration@1' as const,reference:{kind:'indexed-observation',observation:'obs-1'}},assessment:{status:'not-requested' as const}};
const inspection:ArtifactInspection={artifact:'delivery',target:'eris',source:'/tmp/run/pick-1/result.json',sourceContext:context,outputs:[
  {kind:'image',available:true,reason:'Native image coordinates; masks retained.',hdu:1,structure:'SCI',shape:[4,5,6],parameters:['plane'],unit:{value:'MJy/sr',source:'BUNIT'},spectral:{axis:0,centersMicrometres:[2.2,2.3,2.4],source:'WCS'},limitations:['Resolution is not established.']},
  {kind:'sphere',available:false,reason:'A sphere requires a registered body map.'},
]};

function mockIo(stdinIsTTY:boolean,stdoutIsTTY:boolean,answers:readonly (string|undefined)[]=[]){
  const stdout:string[]=[],stderr:string[]=[],prompts:string[]=[];let at=0,closed=false;
  const io:CliIo={stdinIsTTY,stdoutIsTTY,write:text=>stdout.push(text),error:text=>stderr.push(text),question:async prompt=>{prompts.push(prompt);return answers[at++];},close:()=>{closed=true;}};
  return {io,stdout,stderr,prompts,closed:()=>closed};
}
function mockServices(directory:string,inspected:ArtifactInspection=inspection){
  const calls={save:0,get:0,inspect:0,args:[] as readonly string[],runs:[] as {readonly kind:string;readonly args:readonly unknown[]}[]};
  const services:CliServices={
    importLocalArtifact:async()=>({directory:'/tmp/imported',manifest:'/tmp/imported/import.json',receipt:'/tmp/imported/import.product.json',value:{schema:'cssearth-telescope-local-import@1',datasetId:'fixture',limits:{maxMembers:1,maxBytes:1,maxFileBytes:1},members:[],proposedProfiles:[],issues:[]}}),
    familyCoverageLedger:()=>[{family:'F01',status:'partial',profiles:[]}],
    saveExploration:async(_root,args,out)=>{calls.save++;calls.args=args;return exploration(out??directory);},
    getSession:async()=>{calls.get++;return {resultPath:resolve(directory,'pick-1/result.json'),product:resolve(directory,'pick-1/files/image.fits'),reused:false,context};},
    listArtifactOutputs:async()=>{calls.inspect++;return inspected;},
    exportOutput:async(...args)=>{calls.runs.push({kind:'native',args});return {data:'/tmp/image.fits',figure:'/tmp/figure.png',values:'/tmp/values.csv',receipt:'/tmp/output.product.json'} as never;},
    projectOutput:async(...args)=>{calls.runs.push({kind:'body-map',args});return {map:'/tmp/map.fits',figure:'/tmp/map.png',receipt:'/tmp/map.product.json'} as never;},
    exportSphere:async(...args)=>{calls.runs.push({kind:'sphere',args});return {html:'/tmp/sphere.html',receipt:'/tmp/sphere.product.json'} as never;},
    exportSpatialObject:async(...args)=>{calls.runs.push({kind:args[1],args});return {object:'/tmp/object.json',receipt:'/tmp/object.product.json'} as never;},
    executeFamilyOperation:async(...args)=>{calls.runs.push({kind:'family',args});return{directory:String(args[2]),product:resolve(String(args[2]),'data.csv'),record:resolve(String(args[2]),'output.product.json'),operation:{id:String((args[1]as any).operationId),label:'Fixture',handlerId:'fixture',componentId:'component',owner:{module:'fixture',export:'fixture'},available:true,reason:'Fixture',fixedArguments:{},parameters:[],limitations:[]}};},
  };
  return {services,calls};
}

test('default help is concise; explicit help keeps the full command reference',async()=>{
  assert.deepEqual(parseCli([]),{command:'help',short:true});
  for(const args of [['--help'],['help'],['explore','--help']])assert.deepEqual(parseCli(args),{command:'help'});
  const brief=mockIo(false,false),full=mockIo(false,false);
  assert.equal(await main([],'/workspace',text=>brief.io.write(text),brief.io,mockServices('/tmp').services),0);
  assert.equal(await main(['--help'],'/workspace',text=>full.io.write(text),full.io,mockServices('/tmp').services),0);
  assert.match(brief.stdout.join(''),/telescope explore TARGET/u);
  assert.match(brief.stdout.join(''),/Use telescope --help/u);
  assert.doesNotMatch(brief.stdout.join(''),/--max-science-bytes/u);
  assert.match(full.stdout.join(''),/--max-science-bytes/u);
  const version=mockIo(false,false);
  assert.equal(await main(['--version'],'/workspace',text=>version.io.write(text),version.io,mockServices('/tmp').services),0);
  assert.equal(version.stdout.join(''),'0.1.0\n');
});

test('local import has one bounded data-only entry point',()=>{
  const parsed=parseCli(['import','spec.json','--out','run','--json']);assert.equal(parsed.command,'import');if(parsed.command!=='import')return;
  assert.equal(parsed.specification,resolve('spec.json'));assert.equal(parsed.directory,resolve('run'));assert.equal(parsed.json,true);
  for(const args of [['import'],['import','spec.json'],['import','spec.json','--out','a','--out','b'],['import','spec.json','other.json','--out','a']])assert.throws(()=>parseCli(args));
});

test('WWT image export has separate image numbers and an explicit bounded level',()=>{
  const parsed=parseCli(['wwt-image','run/explore.json','--pick','2','--level','1','--out','image-out','--json']);
  assert.deepEqual(parsed,{command:'wwt-image',exploration:resolve('run/explore.json'),pick:2,level:1,directory:resolve('image-out'),json:true,verbose:false});
  for(const args of [['wwt-image','run/explore.json','--pick','0','--level','1','--out','image-out'],
    ['wwt-image','run/explore.json','--pick','1','--level','4','--out','image-out'],
    ['wwt-image','run/explore.json','--pick','1','--out','image-out']])assert.throws(()=>parseCli(args));
});

test('family coverage is derived through one public command',async()=>{
  assert.deepEqual(parseCli(['families','--json']),{command:'families',json:true,verbose:false});assert.throws(()=>parseCli(['families','extra']));
  const mock=mockIo(false,false),api=mockServices('/tmp');const code=await main(['families','--json'],'/workspace',text=>mock.io.write(text),mock.io,api.services);
  assert.equal(code,3);assert.deepEqual(JSON.parse(mock.stdout[0]!),[{family:'F01',status:'partial',profiles:[]}]);assert.equal(mock.prompts.length,0);
});

test('family-run parses explicit params, rejects disagreement and has deterministic stdout',async()=>{const work=await mkdtemp(resolve(tmpdir(),'family-cli-'));try{const descriptor=resolve(work,'descriptor.json'),params=resolve(work,'params.json'),out=resolve(work,'out');await writeFile(descriptor,'{}');await writeFile(params,JSON.stringify({operationId:'dynamic-spectrum-export',selection:[0,2,0,3]}));const parsed=parseCli(['family-run',descriptor,'dynamic-spectrum-export','--params',params,'--out',out,'--json']);assert.equal(parsed.command,'family-run');if(parsed.command!=='family-run')return;assert.equal(parsed.operationId,'dynamic-spectrum-export');const mock=mockIo(false,false),api=mockServices(work);assert.equal(await main(['family-run',descriptor,'dynamic-spectrum-export','--params',params,'--out',out,'--json'],work,text=>mock.io.write(text),mock.io,api.services),0);assert.equal(api.calls.runs[0]!.kind,'family');assert.deepEqual((api.calls.runs[0]!.args[1]as any).selection,[0,2,0,3]);assert.equal(JSON.parse(mock.stdout[0]!).record,resolve(out,'output.product.json'));await writeFile(params,JSON.stringify({operationId:'dynamic-spectrum-select',selection:[0,2,0,3]}));const bad=mockIo(false,false);assert.equal(await main(['family-run',descriptor,'dynamic-spectrum-export','--params',params,'--out',out,'--json'],work,text=>bad.io.write(text),bad.io,api.services),2);assert.match(JSON.parse(bad.stdout[0]!).error,/disagrees/u);const missing=mockIo(false,false);assert.equal(await main(['family-run',descriptor,'dynamic-spectrum-export','--out',out,'--json'],work,text=>missing.io.write(text),missing.io,api.services),2);assert.match(JSON.parse(missing.stdout[0]!).error,/requires --params/u);}finally{await rm(work,{recursive:true,force:true});}});

test('explore parses optional filters without inventing strict scientific criteria',()=>{
  const parsed=parseCli(['explore','eris','--kind','cube','--wavelength','2.2,2.4','--out','runs/eris','--json']);
  assert.equal(parsed.command,'explore');if(parsed.command!=='explore')return;
  assert.deepEqual(parsed.request,{target:'eris',kind:'cube',wavelengthMicrometres:[2.2,2.4]});
  assert.equal(parsed.directory,resolve('runs/eris'));assert.equal(parsed.json,true);
  for(const args of [['explore'],['explore','eris','--out'],['explore','eris','--out','a','--out','b'],['explore','eris','--min-arcsec','1']])assert.throws(()=>parseCli(args));
});

test('human exploration and artifact screens retain unknowns, blockers, context and reproducible commands',()=>{
  const directory='/tmp/run with spaces',screen=formatExploration(exploration(directory));
  assert.match(screen,/Eris/u);assert.match(screen,/Search coverage is incomplete/u);assert.match(screen,/size unknown/u);assert.match(screen,/Resolution is not established/u);assert.match(screen,/Unresolved discoveries/u);assert.match(screen,/Unsupported discoveries/u);assert.match(screen,/Bounded result overflowed/u);assert.match(screen,/telescope get '\/tmp\/run with spaces' --pick N/u);
  const prefixed={...choice,display:{...choice.display,instrument:'Fixture telescope / camera'}};
  const prefixedScreen=formatExploration({...exploration(directory),choices:[prefixed]});
  assert.match(prefixedScreen,/1\. Fixture telescope \/ camera ·/u);
  assert.doesNotMatch(prefixedScreen,/Fixture telescope \/ Fixture telescope/u);
  const session=exploration(directory),opus={service:'https://opus.pds-rings.seti.org/api/' as const,state:'sampled' as const,scope:'OPUS fixture',reason:'fixture',opusTarget:'Kerberos',images:2292,meanRadiusKm:4.75,
    sharpest:[{instrument:'New Horizons LORRI',instrumentImages:2292,opusId:'nh-lorri-lor_0299153805',startTime:'2015-07-14T04:24:46.755',centreResolutionKmPerPixel:1.96379,pixelsAcross:4.8}]};
  assert.match(formatExploration({...session,answer:{...session.answer,services:[opus]}}),/Spacecraft images in OPUS \(2292 of Kerberos.*\n  New Horizons LORRI · 2015-07-14T04:24:46\.755 · 1\.96379 km\/px at body centre · 4\.8 px across/u);
  const artifact=formatArtifact(inspection);
  assert.match(artifact,/delivery/u);assert.match(artifact,/No scientific acceptance criteria requested/u);assert.match(artifact,/sphere: unavailable/u);assert.match(artifact,/A sphere requires a registered body map/u);assert.match(artifact,/Unit: MJy\/sr/u);assert.match(artifact,/--output image --hdu 1 --structure SCI --plane N --out DIRECTORY/u);
  assert.equal(outputCommand(inspection.source,inspection.outputs[0]!),"telescope export /tmp/run/pick-1/result.json --output image --hdu 1 --structure SCI --plane N --out DIRECTORY");
  const local=formatArtifact({...inspection,source:resolve('output/a run/result.json')});
  assert.match(local,/Source: output\/a run\/result\.json/u);
  assert.match(local,/Next: telescope export 'output\/a run\/result\.json'/u);
});

test('WWT imagery appears with credits but never becomes a numbered retrieval choice',async()=>{
  const curatedImagery=await loadWwtImagery(process.cwd(),{id:'europa',name:'Europa',aliases:[]});
  assert.equal(curatedImagery.state,'indexed');
  const session=exploration('/tmp/wwt-run'),screen=formatExploration({...session,answer:{...session.answer,curatedImagery}});
  assert.match(screen,/WWT curated imagery \(1 title\/frame match/u);
  assert.match(screen,/Europa \(Jupiter\).*Toast.*reference-frame match/u);
  assert.match(screen,/NASA\/JPL\/Space Science Institute/u);
  assert.match(screen,/Display imagery only; these are not selectable observations/u);
  assert.equal((screen.match(/^\d+\. /gmu)??[]).length,1);
});

test('query continuation quotes shell metacharacters without command substitution',()=>{
  const directory='/tmp/$(touch unsafe) with spaces';
  const session={target:'Eris',choices:[{pick:1,telescope:'Fixture',mode:'camera',observation:'obs-1',program:'program',state:'qualify'}],answer:{request:{kind:'image',wavelengthMicrometres:[1,2]},endpoint:{coverage:'bounded'},targetCoverage:[]}} as unknown as Session;
  assert.match(formatSession(session,directory),/Next: telescope get '\/tmp\/\$\(touch unsafe\) with spaces' --pick N/u);
});

test('query puts failed providers before bounded candidate blockers and preserves full verbose evidence',()=>{
  const reason='The astronomy packages are not installed: node tools/objects/astronomy-packages/toolchain.mts install';
  const candidates=Array.from({length:30},(_,index)=>({telescope:`Facility ${index}`,mode:`Mode ${index}`,selectionAssessment:{blockers:[{reason:index===29?'A final recorded reason.':`An unrelated historical note ${index}. ${'Long detail '.repeat(40)}`}]}}));
  const session={target:'fixture',choices:[],answer:{request:{kind:'spectrum',wavelengthMicrometres:[0.3,0.8]},targetResolution:{status:'resolved'},endpoint:{status:'no-selectable-candidate',coverage:'incomplete'},candidates,
    targetCoverage:[],sourceIntakeIssues:[],archiveAccess:{services:['ESO','ALMA','PSA'].map(service=>({service,state:'unavailable',reason})),records:[]}}} as unknown as Session;
  const screen=formatSession(session,'/tmp/query');
  assert.match(screen,/Search coverage is incomplete/u);
  assert.match(screen,/Provider status \(3\):\n  3 providers unavailable: The astronomy packages are not installed/u);
  assert.ok(screen.indexOf('Provider status')<screen.indexOf('Candidate mode blockers'));
  assert.match(screen,/Candidate mode blockers \(30\):/u);
  assert.match(screen,/25 more in the saved result/u);
  assert.doesNotMatch(screen,/A final recorded reason/u);
  assert.match(formatSession(session,'/tmp/query',true),/A final recorded reason/u);
  assert.equal(session.answer.candidates.length,30);
});

test('family-only artifact offers a numbered operation without an empty output section',async()=>{
  const operation={id:'spectrum-export',label:'Export spectrum',handlerId:'fixture',componentId:'spectrum',owner:{module:'fixture',export:'fixture'},available:true,reason:'Native samples stay explicit.',fixedArguments:{},parameters:[{id:'out',option:'--out',kind:'output-directory' as const,required:true,description:'New output directory.'}],limitations:[]};
  const artifact:ArtifactInspection={artifact:'delivery',source:'/tmp/descriptor.json',outputs:[],familyOperations:[operation]};
  const screen=formatArtifact(artifact);
  assert.match(screen,/1\. spectrum-export · spectrum: available/u);
  assert.doesNotMatch(screen,/Supported next operations:/u);
  assert.doesNotMatch(screen,/Owner:/u);
  assert.match(formatArtifact(artifact,true),/Owner: fixture#fixture/u);
  const mock=mockIo(true,true,['1','/tmp/spectrum-out']),api=mockServices('/tmp',artifact);
  assert.equal(await main(['outputs','/tmp/descriptor.json'],'/workspace',text=>mock.io.write(text),mock.io,api.services),0);
  assert.deepEqual(mock.prompts,['Choose an available operation number, or press Enter to exit: ','Output directory: ']);
  assert.equal(api.calls.runs.length,1);
  assert.equal(api.calls.runs[0]?.kind,'family');
  assert.equal((api.calls.runs[0]?.args[1] as {readonly componentId?:string}).componentId,'spectrum');
  assert.match(mock.stdout.join(''),/Operation: spectrum-export/u);
});

test('family-run selects one component and rejects a conflicting parameters file',async()=>{
  const work=await mkdtemp(resolve(tmpdir(),'family-component-'));
  try{
    const params=resolve(work,'params.json'),api=mockServices(work),good=mockIo(false,false),bad=mockIo(false,false);
    assert.equal(await main(['family-run','/tmp/descriptor.json','spectrum-export','--component','spectrum','--out',resolve(work,'good')],'/workspace',text=>good.io.write(text),good.io,api.services),0);
    assert.equal((api.calls.runs[0]?.args[1] as {readonly componentId?:string}).componentId,'spectrum');
    await writeFile(params,JSON.stringify({componentId:'other',range:[1,2]}));
    assert.equal(await main(['family-run','/tmp/descriptor.json','spectrum-select-range','--component','spectrum','--params',params,'--out',resolve(work,'bad'),'--json'],'/workspace',text=>bad.io.write(text),bad.io,api.services),2);
    assert.match(JSON.parse(bad.stdout[0]!).error,/componentId.*disagrees/u);
  }finally{await rm(work,{recursive:true,force:true});}
});

test('mixed native and family operations keep one stable numbered choice list',async()=>{
  const operation={id:'spectrum-export',label:'Export spectrum',handlerId:'fixture',componentId:'spectrum',owner:{module:'fixture',export:'fixture'},available:true,reason:'Ready.',fixedArguments:{},parameters:[{id:'out',option:'--out',kind:'output-directory' as const,required:true,description:'New output directory.'}],limitations:[]};
  const artifact:ArtifactInspection={...inspection,familyOperations:[operation]};
  const screen=formatArtifact(artifact);
  assert.ok(screen.indexOf('1. image')<screen.indexOf('3. spectrum-export'));
  const mock=mockIo(true,true,['3','/tmp/family-from-mixed']),api=mockServices('/tmp',artifact);
  assert.equal(await main(['outputs',inspection.source],'/workspace',text=>mock.io.write(text),mock.io,api.services),0);
  assert.equal(api.calls.runs[0]?.kind,'family');
});

test('guided family operation with required parameters can cancel before execution',async()=>{
  const operation={id:'spectrum-select-range',label:'Select range',handlerId:'fixture',componentId:'spectrum',owner:{module:'fixture',export:'fixture'},available:true,reason:'Needs a range.',fixedArguments:{},parameters:[{id:'range',option:'--params',kind:'number-list' as const,required:true,description:'Wavelength range.',count:2},{id:'out',option:'--out',kind:'output-directory' as const,required:true,description:'New output directory.'}],limitations:[]};
  const artifact:ArtifactInspection={artifact:'delivery',source:'/tmp/descriptor.json',outputs:[],familyOperations:[operation]};
  const mock=mockIo(true,true,['1','']),api=mockServices('/tmp',artifact);
  assert.equal(await main(['outputs','/tmp/descriptor.json'],'/workspace',text=>mock.io.write(text),mock.io,api.services),0);
  assert.equal(api.calls.runs.length,0);
  assert.match(mock.stdout.join(''),/Operation canceled; no output was started/u);
});

test('exploration screen bounds repeated archive diagnostics while the saved answer retains them',()=>{
  const original=exploration('/tmp/run'),repeated={...original.choices[0]!,limitations:['repeat','repeat','second','third','fourth']};
  const unsupported=Array.from({length:9},(_,index)=>({...original.answer.unsupported[0]!,identity:`issue-${index}`}));
  const session={...original,choices:[repeated],answer:{...original.answer,unsupported}};
  const screen=formatExploration(session);
  assert.equal([...screen.matchAll(/Limitation: repeat/gu)].length,1);
  assert.match(screen,/1 more distinct limitation\(s\) in the saved result/u);
  assert.match(screen,/Unsupported discoveries \(9\)/u);
  assert.match(screen,/4 more in the saved result/u);
  assert.doesNotMatch(screen,/issue-8/u);
  assert.match(formatExploration(session,true),/issue-8/u);
});

test('no-choice exploration distinguishes incomplete, unsupported, bounded-empty and unresolved target outcomes',async()=>{
  const base=exploration('/tmp/no-choice'),cases=[
    {coverage:'incomplete' as const,unsupported:[],issues:[{scope:'provider' as const,code:'provider-unavailable' as const,identity:'Archive',reason:'Astronomy packages are not installed.'}],expected:/Search incomplete; no retrievable observation was confirmed/u},
    {coverage:'bounded' as const,unsupported:base.answer.unsupported,issues:[],expected:/1 discovery record\(s\) lack a supported route/u},
    {coverage:'bounded' as const,unsupported:[],issues:[],expected:/This does not establish that no observation exists/u},
  ];
  for(const item of cases){
    const session={...base,choices:[],answer:{...base.answer,choices:[],outcome:{selection:'none' as const,coverage:item.coverage},unresolved:[],unsupported:item.unsupported,issues:item.issues}};
    const screen=formatExploration(session);
    assert.match(screen,item.expected);
    assert.doesNotMatch(screen,/No actionable observation is available/u);
    if(item.coverage==='incomplete'){
      assert.ok(screen.indexOf('Search limits and provider status')<screen.indexOf('Unresolved discoveries')||!screen.includes('Unresolved discoveries'));
      assert.match(screen,/Retry in a new directory: telescope explore eris --out NEW_DIRECTORY/u);
      const io=mockIo(true,true),api=mockServices(session.directory);
      assert.equal(await main(['explore','eris'],'/workspace',text=>io.io.write(text),io.io,{...api.services,saveExploration:async()=>session}),3);
      assert.equal(io.prompts.length,0);
      assert.match(io.stdout.join(''),/Search incomplete/u);
    }
  }
  const unresolved={...base,choices:[],answer:{...base.answer,choices:[],outcome:{selection:'none' as const,coverage:'target-unresolved' as const},targetResolution:{status:'unknown' as const,requested:'nonesuch',suggestions:[]},issues:[{scope:'target' as const,code:'unknown-target' as const,reason:'Target is unknown.'}],unresolved:[],unsupported:[]}};
  assert.match(formatExploration(unresolved),/Target unresolved; no archive search was run/u);
});

test('terminal groups a shared provider failure but keeps every provider in verbose and saved data',()=>{
  const initial=exploration('/tmp/provider-failure'),reason='Target-name query. The astronomy packages are not installed: node tools/objects/astronomy-packages/toolchain.mts install';
  const issues=['ESO','ALMA','PSA'].map(identity=>({scope:'provider' as const,code:'provider-unavailable' as const,identity,reason}));
  const session={...initial,arguments:['HD 189733','--kind','spectrum'],choices:[],answer:{...initial.answer,choices:[],issues,unresolved:[],unsupported:[],outcome:{selection:'none' as const,coverage:'incomplete' as const}}};
  const screen=formatExploration(session);
  assert.match(screen,/Search limits and provider status \(3\):/u);
  assert.match(screen,/3 providers \(ESO, ALMA, PSA\): Target-name query/u);
  assert.equal([...screen.matchAll(/The astronomy packages are not installed/gu)].length,1);
  assert.match(screen,/telescope explore 'HD 189733' --kind spectrum --out NEW_DIRECTORY/u);
  assert.equal([...formatExploration(session,true).matchAll(/The astronomy packages are not installed/gu)].length,3);
  assert.equal(session.answer.issues.length,3);
});

test('JSON and every redirected explore mode are deterministic and never prompt',async()=>{
  for(const [stdin,stdout,json] of [[true,true,true],[false,true,false],[true,false,false],[false,false,false]] as const){
    const directory=resolve('/tmp','cli-noninteractive'),mock=mockIo(stdin,stdout),api=mockServices(directory);
    const code=await main(['explore','eris','--out',directory,...(json?['--json']:[])],'/workspace',text=>mock.io.write(text),mock.io,api.services);
    assert.equal(code,0);assert.equal(mock.prompts.length,0);assert.equal(api.calls.get,0);assert.equal(api.calls.inspect,0);assert.equal(mock.stdout.length,1);
    assert.equal(mock.stderr.join('').includes('\r'),false);
    const parsed=JSON.parse(mock.stdout[0]!);assert.equal(parsed.directory,directory);assert.equal(parsed.answer.target,'eris');assert.deepEqual(api.calls.args,['eris']);assert.equal(mock.closed(),true);
  }
});

test('terminal cancellation preserves the saved exploration and starts no selected operation',async()=>{
  const directory=resolve('/tmp','cli-cancel'),mock=mockIo(true,true,['']),api=mockServices(directory);
  const code=await main(['explore','eris','--out',directory],'/workspace',text=>mock.io.write(text),mock.io,api.services);
  assert.equal(code,0);assert.equal(mock.prompts.length,1);assert.equal(api.calls.save,1);assert.equal(api.calls.get,0);assert.equal(api.calls.inspect,0);
  assert.match(mock.stdout.join(''),/Exploration saved; no observation was selected/u);
});

test('terminal exploration reports stages and flushes its choices before prompting',async()=>{
  const mock=mockIo(true,true),api=mockServices('/tmp/run');let flushed=false;
  const io:CliIo={...mock.io,stderrIsTTY:true,flush:async()=>{flushed=true;},question:async()=>{assert.equal(flushed,true);return '';}};
  const services:CliServices={...api.services,saveExploration:async(root,args,out,_api,progress)=>{progress?.('Searching archives');return api.services.saveExploration(root,args,out);}};
  assert.equal(await main(['explore','eris'],'/workspace',text=>io.write(text),io,services),0);
  assert.match(mock.stderr.join(''),/\r\| Resolving target \(0s\)/u);
  assert.match(mock.stderr.join(''),/Searching archives/u);
  assert.match(mock.stderr.join(''),/Done \(0s\)/u);
  assert.equal(mock.stdout.length,2);
});

test('terminal selection retrieves the exact saved pick and shows its artifact operations',async()=>{
  const directory=resolve('/tmp','cli-selected'),mock=mockIo(true,true,['1','']),api=mockServices(directory);
  const code=await main(['explore','eris','--out',directory],'/workspace',text=>mock.io.write(text),mock.io,api.services);
  assert.equal(code,0);assert.equal(api.calls.get,1);assert.equal(api.calls.inspect,1);
  const screen=mock.stdout.join('');assert.match(screen,/Product:/u);assert.match(screen,/No scientific acceptance criteria requested/u);assert.match(screen,/Supported next operations/u);assert.match(screen,/--plane N/u);
  assert.equal(api.calls.runs.length,0);assert.match(screen,/No operation was selected/u);
});

test('guided native image retries invalid selectors, then invokes the existing export owner',async()=>{
  const source=resolve('/tmp','delivery.json'),mock=mockIo(true,true,['1','bad','/tmp/unused','2','/tmp/native-output']),api=mockServices('/tmp');
  const code=await main(['outputs',source],'/workspace',text=>mock.io.write(text),mock.io,api.services);
  assert.equal(code,0);assert.equal(api.calls.runs.length,1);assert.equal(api.calls.runs[0]!.kind,'native');
  assert.deepEqual(api.calls.runs[0]!.args,[inspection.source,{kind:'image',hdu:1,structure:'SCI',plane:2},resolve('/tmp/native-output')]);
  assert.match(mock.stderr.join(''),/Selectors must be nonnegative whole numbers/u);
  assert.match(mock.stdout.join(''),/Data: \/tmp\/image\.fits/u);
});

test('guided output cancellation starts no export owner',async()=>{
  const source=resolve('/tmp','delivery.json'),mock=mockIo(true,true,['1','']),api=mockServices('/tmp');
  const code=await main(['outputs',source],'/workspace',text=>mock.io.write(text),mock.io,api.services);
  assert.equal(code,0);assert.equal(api.calls.runs.length,0);assert.match(mock.stdout.join(''),/Output canceled; no output was started/u);
});

test('guided stage operations prompt only for declared inputs and dispatch through their existing owners',async()=>{
  const cases=[
    {kind:'body-map',parameters:['geometry'],answers:['1','navigation.json','map-out'],owner:'body-map'},
    {kind:'sphere',answers:['1','sphere-out'],owner:'sphere'},
    {kind:'points',answers:['1','points-out'],owner:'points'},
    {kind:'volume',answers:['1','volume-out'],owner:'volume'},
  ] as const;
  for(const item of cases){
    const source=resolve('/tmp',`${item.kind}.json`),artifact:ArtifactInspection={artifact:'fixture',source,outputs:[{kind:item.kind,available:true,reason:'Ready.',...('parameters'in item?{parameters:item.parameters}:{})}]};
    const mock=mockIo(true,true,item.answers),api=mockServices('/tmp',artifact);
    assert.equal(await main(['outputs',source],'/workspace',text=>mock.io.write(text),mock.io,api.services),0);
    assert.equal(api.calls.runs.length,1);assert.equal(api.calls.runs[0]!.kind,item.owner);
    const expectedPrompts=item.kind==='body-map'?3:2;assert.equal(mock.prompts.length,expectedPrompts);
  }
});

test('JSON and redirected artifact inspection never prompt or start an output owner',async()=>{
  for(const [stdin,stdout,json] of [[true,true,true],[false,true,false],[true,false,false],[false,false,false]] as const){
    const source=resolve('/tmp','delivery.json'),mock=mockIo(stdin,stdout),api=mockServices('/tmp');
    assert.equal(await main(['outputs',source,...(json?['--json']:[])],'/workspace',text=>mock.io.write(text),mock.io,api.services),0);
    assert.equal(mock.prompts.length,0);assert.equal(api.calls.runs.length,0);
  }
});
