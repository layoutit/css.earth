import assert from 'node:assert/strict';
import { after } from 'node:test';
import { spawnSync } from 'node:child_process';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { resolve } from 'node:path';
import{mkdtemp,mkdir,rm,writeFile,readFile,readdir,realpath}from'node:fs/promises';import{tmpdir}from'node:os';
import { formatArtifact, formatExploration, formatSession, outputCommand, displayPath, shellWord, type ArtifactInspection } from './cli-format.mts';
import { savedDownload } from './cli-consent.mts';
import { main, type CliIo, type CliServices } from './cli.mts';
import { VERSION } from './version.mts';
import { parseCli } from './cli-arguments.mts';
import { saveExploration, type ExplorationSession, type Session } from './session.mts';
import { explorationSummary } from './cli-summary.mts';
import { wavelengthText } from './cli-table.mts';
import { familyCoverageLedger } from './family-handlers.mts';
import { loadWwtImagery } from './wwt/wwt-catalog.mts';
import { loadWwtFitsLeads } from './wwt/wwt-fits-leads.mts';
import { requestTransferConsent } from '@cssearth/telescope-core/node';
const originalCwd=process.cwd(),testCwd=await realpath(await mkdtemp(resolve(tmpdir(),'cli-cwd-')));
process.chdir(testCwd);
after(async()=>{process.chdir(originalCwd);await rm(testCwd,{recursive:true,force:true});});

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
const inspection:ArtifactInspection={artifact:'delivery',target:'eris',source:resolve(testCwd,'run/pick-1/result.json'),sourceContext:context,outputs:[
  {kind:'image',available:true,reason:'Native image coordinates; masks retained.',hdu:1,structure:'SCI',shape:[4,5,6],parameters:['plane'],unit:{value:'MJy/sr',source:'BUNIT'},spectral:{axis:0,centersMicrometres:[2.2,2.3,2.4],source:'WCS'},limitations:['Resolution is not established.']},
  {kind:'sphere',available:false,reason:'A sphere requires a registered body map.'},
]};

await mkdir(resolve(testCwd,'run/pick-1'),{recursive:true});
await writeFile(resolve(testCwd,'run/explore.json'),'{}');

function mockIo(stdinIsTTY:boolean,stdoutIsTTY:boolean,answers:readonly (string|undefined)[]=[]){
  const stdout:string[]=[],stderr:string[]=[],prompts:string[]=[];let at=0,closed=false;
  const io:CliIo={stdinIsTTY,stdoutIsTTY,stderrIsTTY:stdoutIsTTY,write:text=>stdout.push(text),error:text=>stderr.push(text),question:async prompt=>{prompts.push(prompt);return answers[at++];},close:()=>{closed=true;}};
  return {io,stdout,stderr,prompts,closed:()=>closed};
}
function mockServices(directory:string,inspected:ArtifactInspection=inspection){
  const calls={save:0,get:0,inspect:0,args:[] as readonly string[],runs:[] as {readonly kind:string;readonly args:readonly unknown[]}[]};
  const services:CliServices={
    getDownloadPlan:async()=>({kind:'download',bytes:0,archive:'Fixture',destination:resolve(directory,'pick-1')}),
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

test('default help is concise; help all keeps the full command reference',async()=>{
  assert.deepEqual(parseCli([]),{command:'help',short:true,topic:''});
  for(const args of [['--help'],['help']])assert.deepEqual(parseCli(args),{command:'help',short:true,topic:''});
  assert.deepEqual(parseCli(['explore','--help']),{command:'help',short:false,topic:'explore'});
  const brief=mockIo(false,false),full=mockIo(false,false);
  assert.equal(await main([],'/workspace',text=>brief.io.write(text),brief.io,mockServices('/tmp').services),0);
  assert.equal(await main(['help','all'],'/workspace',text=>full.io.write(text),full.io,mockServices('/tmp').services),0);
  assert.match(brief.stdout.join(''),/telescope explore TARGET/u);
  assert.match(brief.stdout.join(''),/telescope help COMMAND/u);
  assert.doesNotMatch(brief.stdout.join(''),/--max-science-bytes/u);
  assert.match(full.stdout.join(''),/--max-science-bytes/u);
  const version=mockIo(false,false);
  assert.equal(await main(['--version'],'/workspace',text=>version.io.write(text),version.io,mockServices('/tmp').services),0);
  assert.equal(version.stdout.join(''),`${VERSION}\n`);
});

test('packaged entrypoint recognizes the current science workspace script',()=>{
  const root=originalCwd;
  const result=spawnSync(process.execPath,['--import','tsx',resolve(root,'packages/telescope-cli/src/bin.mts'),
    '--workspace',root,'unknown-command','--json'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,2);
  assert.match(result.stdout,/Unknown telescope command/u);
  assert.doesNotMatch(result.stderr,/No css\.earth science workspace/u);
});

test('new-object bakes a spec after generating it, or objects already in the tree',()=>{
  const spec=parseCli(['new-object','stars.json','--bake']);assert.equal(spec.command,'new-object');if(spec.command!=='new-object')return;
  assert.equal(spec.spec,resolve('stars.json'));assert.equal(spec.bake,true);assert.equal(spec.ids,undefined);
  const ids=parseCli(['new-object','--bake','hd-219134','hd-219134b','--json']);assert.equal(ids.command,'new-object');if(ids.command!=='new-object')return;
  assert.deepEqual(ids.ids,['hd-219134','hd-219134b']);assert.equal(ids.spec,undefined);assert.equal(ids.json,true);
  for(const args of [['new-object','--bake'],['new-object','a.json','b.json','--check']])assert.throws(()=>parseCli(args));
  const draft=parseCli(['new-object','--from-debcat','47 Tuc V69','CM Dra','--out','spec.json']);assert.equal(draft.command,'new-object');if(draft.command!=='new-object')return;
  assert.deepEqual([draft.from,draft.names],['debcat',['47 Tuc V69','CM Dra']]);
  assert.throws(()=>parseCli(['new-object','--from-apokasc','--out','spec.json']),/--from-apokasc NAME\.\.\. --out SPEC\.json/u);
  const picture=parseCli(['new-object','--from-esa','m57=https://esawebb.org/images/weic2320c/','--out','spec.json']);assert.equal(picture.command,'new-object');if(picture.command!=='new-object')return;
  assert.deepEqual([picture.from,picture.names],['esa',['m57=https://esawebb.org/images/weic2320c/']]);
});
test('local import has one bounded data-only entry point',()=>{
  const parsed=parseCli(['import','spec.json','--out','run','--json']);assert.equal(parsed.command,'import');if(parsed.command!=='import')return;
  assert.equal(parsed.specification,resolve('spec.json'));assert.equal(parsed.directory,resolve('run'));assert.equal(parsed.json,true);
  for(const args of [['import'],['import','spec.json'],['import','spec.json','--out','a','--out','b'],['import','spec.json','other.json','--out','a']])assert.throws(()=>parseCli(args));
});

test('archive source fetch uses separate lead numbers and requires a saved exploration and defaults its output to cwd',()=>{
  assert.deepEqual(parseCli(['fetch','run/explore.json','--pick','2','--out','raw-out','--json']),
    {command:'fetch',archive:'keck',exploration:resolve('run/explore.json'),pick:2,directory:resolve('raw-out'),json:true,verbose:false});
  for(const archive of ['gemini','opus','chandra','spitzer']){
    const parsed=parseCli(['fetch','run/explore.json','--archive',archive,'--pick','1','--out','raw-out']);
    assert.equal(parsed.command,'fetch');if(parsed.command==='fetch')assert.equal(parsed.archive,archive);
  }
  for(const args of [['fetch','run/explore.json','--pick','0','--out','raw-out'],
    ['fetch','run/explore.json','--pick','1','--out','a','--out','b'],
    ['fetch','run/explore.json','--archive','unknown','--pick','1','--out','raw-out']])
    assert.throws(()=>parseCli(args));
  const lead={service:'https://koa.ipac.caltech.edu/TAP',state:'sampled' as const,scope:'public object frames',reason:'sampled',
    instruments:[{telescope:'Keck',instrument:'NIRC2',records:3,sample:'HR 8799'}],
    sources:[{table:'koa_nirc2',instrument:'NIRC2',koaid:'N2.20090805.31896.fits',targetName:'HR 8799',
      filehand:'/koadata9/NIRC2/20090805/lev0/N2.20090805.31896.fits',dateObs:'2009-08-05',evidence:'a'.repeat(64)}]};
  const session=exploration('/tmp/keck run'),screen=formatExploration({...session,answer:{...session.answer,services:[lead]}},true);
  assert.match(screen,/Keck 1\. NIRC2 · N2\.20090805\.31896\.fits/u);
  assert.match(screen,/telescope fetch '\/tmp\/keck run\/explore\.json' --archive keck --pick N --out DIRECTORY/u);
  assert.match(screen,/calibration remain unresolved/u);
});

test('WWT image export has separate image numbers and an explicit bounded level',()=>{
  const parsed=parseCli(['wwt-image','run/explore.json','--pick','2','--level','1','--out','image-out','--json']);
  assert.deepEqual(parsed,{command:'wwt-image',exploration:resolve('run/explore.json'),pick:2,level:1,directory:resolve('image-out'),json:true,verbose:false});
  for(const args of [['wwt-image','run/explore.json','--pick','0','--level','1','--out','image-out'],
    ['wwt-image','run/explore.json','--pick','1','--level','4','--out','image-out'],
    ['wwt-image','run/explore.json','--pick','1','--out','image-out']])assert.throws(()=>parseCli(args));
});

test('WWT FITS acquisition selects a named numeric imageset and one tile',()=>{
  assert.deepEqual(parseCli(['wwt-fits','src/sources/wwt/phat-fits.json','--set','PHAT-f475w','--level','0','--x','0','--y','0','--out','fits-out','--json']),
    {command:'wwt-fits',catalog:resolve('src/sources/wwt/phat-fits.json'),setName:'PHAT-f475w',level:0,x:0,y:0,directory:resolve('fits-out'),json:true,verbose:false});
  for(const args of [['wwt-fits','catalog.json','--set','Science','--level','0','--x','0','--out','fits-out'],
    ['wwt-fits','catalog.json','--set','Science','--level','-1','--x','0','--y','0','--out','fits-out'],
    ['wwt-fits','catalog.json','--set','Science','--level','0','--x','0','--y','0','--out','fits-out','--x','1']])assert.throws(()=>parseCli(args));
});

test('family coverage is derived through one public command',async()=>{
  assert.deepEqual(parseCli(['families','--json']),{command:'families',json:true,verbose:false});assert.throws(()=>parseCli(['families','extra']));
  const mock=mockIo(false,false),api=mockServices('/tmp');const code=await main(['families','--json'],'/workspace',text=>mock.io.write(text),mock.io,api.services);
  assert.equal(code,3);assert.deepEqual(JSON.parse(mock.stdout[0]!),[{family:'F01',status:'partial',profiles:[]}]);assert.equal(mock.prompts.length,0);
});

test('family-run parses explicit params, rejects disagreement and has deterministic stdout',async()=>{const work=await mkdtemp(resolve(tmpdir(),'family-cli-'));try{const descriptor=resolve(work,'descriptor.json'),params=resolve(work,'params.json'),out=resolve(work,'out');await writeFile(descriptor,'{}');await writeFile(params,JSON.stringify({operationId:'dynamic-spectrum-export',selection:[0,2,0,3]}));const parsed=parseCli(['family-run',descriptor,'dynamic-spectrum-export','--params',params,'--out',out,'--json']);assert.equal(parsed.command,'family-run');if(parsed.command!=='family-run')return;assert.equal(parsed.operationId,'dynamic-spectrum-export');const mock=mockIo(false,false),api=mockServices(work);assert.equal(await main(['family-run',descriptor,'dynamic-spectrum-export','--params',params,'--out',out,'--json'],work,text=>mock.io.write(text),mock.io,api.services),0);assert.equal(api.calls.runs[0]!.kind,'family');assert.deepEqual((api.calls.runs[0]!.args[1]as any).selection,[0,2,0,3]);assert.equal(JSON.parse(mock.stdout[0]!).record,resolve(out,'output.product.json'));await writeFile(params,JSON.stringify({operationId:'dynamic-spectrum-select',selection:[0,2,0,3]}));const bad=mockIo(false,false);assert.equal(await main(['family-run',descriptor,'dynamic-spectrum-export','--params',params,'--out',out,'--json'],work,text=>bad.io.write(text),bad.io,api.services),2);assert.match(JSON.parse(bad.stdout[0]!).error,/disagrees/u);const missing=mockIo(false,false);assert.equal(await main(['family-run',descriptor,'dynamic-spectrum-export','--out',out,'--json'],work,text=>missing.io.write(text),missing.io,api.services),2);assert.match(JSON.parse(missing.stdout[0]!).error,/requires --params/u);}finally{await rm(work,{recursive:true,force:true});}});

test('explore parses optional filters without inventing strict scientific criteria',()=>{
  const parsed=parseCli(['explore','eris','--kind','cube','--wavelength','2.2,2.4','--out','runs/eris','--json']);
  assert.equal(parsed.command==='explore'&&parsed.fresh,false);
  const fresh=parseCli(['explore','eris','--fresh']);assert.equal(fresh.command==='explore'&&fresh.fresh,true);
  assert.throws(()=>parseCli(['explore','eris','--fresh','--fresh']),/Repeated option --fresh/u);
  assert.equal(parsed.command,'explore');if(parsed.command!=='explore')return;
  assert.deepEqual(parsed.request,{target:'eris',kind:'cube',wavelengthMicrometres:[2.2,2.4]});
  assert.equal(parsed.directory,resolve('runs/eris'));assert.equal(parsed.json,true);
  for(const args of [['explore'],['explore','eris','--out'],['explore','eris','--out','a','--out','b'],['explore','eris','--min-arcsec','1']])assert.throws(()=>parseCli(args));
});

test('human exploration and artifact screens retain unknowns, blockers, context and reproducible commands',()=>{
  const directory='/tmp/run with spaces',screen=formatExploration(exploration(directory),true);
  assert.match(screen,/Eris/u);assert.match(screen,/Search coverage is incomplete/u);assert.match(screen,/size unknown/u);assert.match(screen,/Resolution is not established/u);assert.match(screen,/Unresolved discoveries/u);assert.match(screen,/Unsupported discoveries/u);assert.match(screen,/Bounded result overflowed/u);assert.match(screen,/telescope get '\/tmp\/run with spaces' --pick N/u);
  assert.match(screen,/A same-filter retry cannot extend a bounded sample.*--from ISO --to ISO/u);
  assert.doesNotMatch(screen,/Retry in a new directory:/u);
  const prefixed={...choice,display:{...choice.display,instrument:'Fixture telescope / camera'}};
  const prefixedScreen=formatExploration({...exploration(directory),choices:[prefixed]},true);
  assert.match(prefixedScreen,/1\. Fixture telescope \/ camera ·/u);
  assert.doesNotMatch(prefixedScreen,/Fixture telescope \/ Fixture telescope/u);
  const session=exploration(directory),opus={service:'https://opus.pds-rings.seti.org/api/' as const,state:'sampled' as const,scope:'OPUS fixture',reason:'fixture',opusTarget:'Kerberos',images:2292,meanRadiusKm:4.75,
    sharpest:[{instrument:'New Horizons LORRI',instrumentImages:2292,opusId:'nh-lorri-lor_0299153805',startTime:'2015-07-14T04:24:46.755',centreResolutionKmPerPixel:1.96379,pixelsAcross:4.8}]};
  assert.match(formatExploration({...session,answer:{...session.answer,services:[opus]}},true),/Spacecraft images in OPUS \(2292 of Kerberos.*\n  OPUS 1\. New Horizons LORRI · 2015-07-14T04:24:46\.755 · 1\.96379 km\/px at body centre · 4\.8 px across/u);
  const artifact=formatArtifact(inspection,true);
  assert.match(artifact,/delivery/u);assert.match(artifact,/No scientific acceptance criteria requested/u);assert.match(artifact,/sphere: unavailable/u);assert.match(artifact,/A sphere requires a registered body map/u);assert.match(artifact,/Unit: MJy\/sr/u);assert.match(artifact,/--output image --hdu 1 --structure SCI --plane N --out DIRECTORY/u);
  assert.equal(outputCommand(inspection.source,inspection.outputs[0]!),`telescope export ${shellWord(displayPath(inspection.source))} --output image --hdu 1 --structure SCI --plane N --out DIRECTORY`);
  const local=formatArtifact({...inspection,source:resolve('output/a run/result.json')});
  assert.ok(local.includes(`Source: ${displayPath(resolve('output/a run/result.json'))}`));
  assert.ok(local.includes(`Next: telescope export ${shellWord(displayPath(resolve('output/a run/result.json')))}`));
});

test('WWT imagery appears with credits but never becomes a numbered retrieval choice',async()=>{
  const curatedImagery=await loadWwtImagery(originalCwd,{id:'europa',name:'Europa',aliases:[]});
  assert.equal(curatedImagery.state,'indexed');
  const session=exploration('/tmp/wwt-run'),screen=formatExploration({...session,answer:{...session.answer,curatedImagery}},true);
  assert.match(screen,/WWT curated imagery \(1 title\/frame match/u);
  assert.match(screen,/Europa \(Jupiter\).*Toast.*reference-frame match/u);
  assert.match(screen,/NASA\/JPL\/Space Science Institute/u);
  assert.match(screen,/Display imagery only; these are not selectable observations/u);
  assert.equal((screen.match(/^\d+\. /gmu)??[]).length,1);
});

test('target-linked WWT FITS tiles appear as unresolved source leads with a saved-choice command',async()=>{
  const wwtFits=await loadWwtFitsLeads(originalCwd,{id:'m31',name:'Andromeda Galaxy',aliases:['M31']});
  assert.equal(wwtFits.state,'indexed');
  const session=exploration('/tmp/m31-run'),screen=formatExploration({...session,answer:{...session.answer,target:'m31',wwtFits}},true);
  assert.match(screen,/WWT-hosted FITS source leads for m31 \(2; target association only\)/u);
  assert.match(screen,/WWT FITS 1\. PHAT-f475w/u);
  assert.match(screen,/telescope wwt-fits \/tmp\/m31-run\/explore\.json --pick N --level 0 --x 0 --y 0 --out DIRECTORY/u);
  assert.match(screen,/Tile units, uncertainty, celestial WCS and original exposure identity remain unresolved/u);
});

test('query continuation quotes shell metacharacters without command substitution',()=>{
  const directory='/tmp/$(touch unsafe) with spaces';
  const session={target:'Eris',choices:[{pick:1,telescope:'Fixture',mode:'camera',observation:'obs-1',program:'program',state:'qualify'}],answer:{request:{kind:'image',wavelengthMicrometres:[1,2]},endpoint:{coverage:'bounded'},targetCoverage:[]}} as unknown as Session;
  assert.match(formatSession(session,directory),/Next: telescope get '\/tmp\/\$\(touch unsafe\) with spaces' --pick N/u);
});

test('query puts failed providers before bounded candidate blockers and preserves full verbose evidence',()=>{
  const reason='The astronomy packages are not installed: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts astroquery install';
  const candidates=Array.from({length:30},(_,index)=>({telescope:`Facility ${index}`,mode:`Mode ${index}`,selectionAssessment:{blockers:[{reason:index===29?'A final recorded reason.':`An unrelated historical note ${index}. ${'Long detail '.repeat(40)}`}]}}));
  const session={target:'fixture',choices:[],answer:{request:{kind:'spectrum',wavelengthMicrometres:[0.3,0.8]},targetResolution:{status:'resolved'},endpoint:{status:'no-selectable-candidate',coverage:'incomplete'},candidates,
    targetCoverage:[],sourceIntakeIssues:[],archiveAccess:{services:['ESO','ALMA','PSA'].map(service=>({service,state:'unavailable',reason})),records:[]}}} as unknown as Session;
  const screen=formatSession(session,'/tmp/query',true);
  assert.match(screen,/Search coverage is incomplete/u);
  assert.match(screen,/Provider status \(3\):\n  ESO: unavailable. The astronomy packages are not installed/u);
  assert.ok(screen.indexOf('Provider status')<screen.indexOf('Candidate mode blockers'));
  assert.match(screen,/Candidate mode blockers \(30\):/u);
  assert.match(screen,/A final recorded reason/u);
  assert.doesNotMatch(formatSession(session,'/tmp/query'),/A final recorded reason/u);
  assert.match(formatSession(session,'/tmp/query'),/3 provider\/source notes/u);
  assert.match(formatSession(session,'/tmp/query',true),/A final recorded reason/u);
  assert.equal(session.answer.candidates.length,30);
});

test('family-only artifact offers a numbered operation without an empty output section',async()=>{
  const operation={id:'spectrum-export',label:'Export spectrum',handlerId:'fixture',componentId:'spectrum',owner:{module:'fixture',export:'fixture'},available:true,reason:'Native samples stay explicit.',fixedArguments:{},parameters:[{id:'out',option:'--out',kind:'output-directory' as const,required:true,description:'New output directory.'}],limitations:[]};
  const artifact:ArtifactInspection={artifact:'delivery',source:'/tmp/descriptor.json',outputs:[],familyOperations:[operation]};
  const screen=formatArtifact(artifact);
  assert.match(screen,/1\. spectrum-export\s+spectrum\s+available/u);
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
  assert.doesNotMatch(screen,/Limitation: repeat/u);
  assert.match(screen,/9 unsupported · 2 notes · 4 limitations/u);
  assert.equal([...formatExploration(session,true).matchAll(/Limitation: repeat/gu)].length,1);
  assert.doesNotMatch(screen,/issue-8/u);
  assert.match(formatExploration(session,true),/issue-8/u);
});

test('no-choice exploration distinguishes incomplete, unsupported, bounded-empty and unresolved target outcomes',async()=>{
  const base=exploration('/tmp/no-choice'),cases=[
    {coverage:'incomplete' as const,unsupported:[],issues:[{scope:'provider' as const,code:'provider-unavailable' as const,identity:'Archive',reason:'Astronomy packages are not installed.'}],expected:/Search incomplete; no retrievable observation was confirmed/u},
    {coverage:'bounded' as const,unsupported:base.answer.unsupported,issues:[],expected:/1 unsupported/u},
    {coverage:'bounded' as const,unsupported:[],issues:[],expected:/This does not establish that no observation exists/u},
  ];
  for(const item of cases){
    const session={...base,choices:[],answer:{...base.answer,choices:[],outcome:{selection:'none' as const,coverage:item.coverage},unresolved:[],unsupported:item.unsupported,issues:item.issues}};
    const screen=formatExploration(session);
    assert.match(screen,item.expected);
    assert.doesNotMatch(screen,/No actionable observation is available/u);
    if(item.coverage==='incomplete'){
      assert.ok(screen.indexOf('Search limits and provider status')<screen.indexOf('Unresolved discoveries')||!screen.includes('Unresolved discoveries'));
      assert.match(screen,/details: --verbose\nSaved: \/tmp\/no-choice\/explore\.json/u);
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
  const initial=exploration('/tmp/provider-failure'),reason='Target-name query. The astronomy packages are not installed: node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts astroquery install';
  const issues=['ESO','ALMA','PSA'].map(identity=>({scope:'provider' as const,code:'provider-unavailable' as const,identity,reason}));
  const session={...initial,arguments:['HD 189733','--kind','spectrum'],choices:[],answer:{...initial.answer,choices:[],issues,unresolved:[],unsupported:[],outcome:{selection:'none' as const,coverage:'incomplete' as const}}};
  const screen=formatExploration(session);
  assert.match(screen,/0 unsupported · 3 notes/u);
  assert.doesNotMatch(screen,/The astronomy packages are not installed/u);
  assert.match(formatExploration(session,true),/telescope explore 'HD 189733' --kind spectrum --out NEW_DIRECTORY/u);
  assert.equal([...formatExploration(session,true).matchAll(/The astronomy packages are not installed/gu)].length,3);
  assert.equal(session.answer.issues.length,3);
});

test('JSON and every redirected explore mode are deterministic and never prompt',async()=>{
  for(const [stdin,stdout,json] of [[true,true,true],[false,true,false],[true,false,false],[false,false,false]] as const){
    const directory=resolve('/tmp','cli-noninteractive'),mock=mockIo(stdin,stdout),api=mockServices(directory);
    const code=await main(['explore','eris','--out',directory,...(json?['--json']:[])],'/workspace',text=>mock.io.write(text),mock.io,api.services);
    assert.equal(code,0);assert.equal(mock.prompts.length,0);assert.equal(api.calls.get,0);assert.equal(api.calls.inspect,0);assert.equal(mock.stdout.length,1);
    assert.equal(mock.stderr.join('').includes('\r'),false);
    const parsed=JSON.parse(mock.stdout[0]!);assert.equal(parsed.savedPath,resolve(directory,'explore.json'));assert.equal(parsed.target,'eris');assert.equal(parsed.schema,'cssearth-telescope-explore-summary@1');assert.equal(parsed.answer,undefined);assert.deepEqual(api.calls.args,['eris']);assert.equal(mock.closed(),true);
  }
});

test('network failures retain their actionable cause in human and JSON errors',async()=>{
  const failed=new Error('fetch failed',{cause:new Error('getaddrinfo ENOTFOUND data1.wwtassets.org')});
  const api=mockServices('/tmp');
  for(const args of [['explore','eris'],['explore','eris','--json']]){
    const io=mockIo(false,false);
    assert.equal(await main(args,'/workspace',text=>io.io.write(text),io.io,{...api.services,saveExploration:async()=>{throw failed;}}),1);
    assert.match(io.stderr.join(''),/fetch failed: getaddrinfo ENOTFOUND data1\.wwtassets\.org/u);
    if(args.includes('--json'))assert.match(JSON.parse(io.stdout.join('')).error,/ENOTFOUND data1\.wwtassets\.org/u);
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
  const services:CliServices={
    ...api.services,saveExploration:async(root,args,out,_api,progress)=>{progress?.('Searching archives');return api.services.saveExploration(root,args,out);}};
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


test('compact exploration bounds default rows, preserves picks with --all, rounds and truncates cells',async()=>{
  const base=exploration('/tmp/table'),choices=Array.from({length:23},(_,index)=>({...choice,pick:index+1,key:`choice-${index}`,display:{...choice.display,
    instrument:'Long instrument name '.repeat(10),wavelengthsMicrometres:[[1234.5678912345678,2345.6789123456789]] as const}}));
  const session={...base,choices,answer:{...base.answer,choices}},screen=formatExploration(session);
  assert.equal(screen.split('\n').filter(line=>/^\d+\s{2,}/u.test(line)).length,10);
  assert.match(screen,/13 more · telescope explore eris --all/u);
  assert.match(screen,/1.23–2.35 mm/u);assert.doesNotMatch(screen,/1234.567891/u);
  assert.ok(screen.split('\n').filter(line=>/^\d+\s{2,}/u.test(line)).every(line=>Array.from(line).length<=100));
  assert.match(screen,/…/u);assert.doesNotMatch(screen,/Limitation:/u);
  const all=formatExploration(session,false,true);
  assert.equal(all.split('\n').filter(line=>/^\d+\s{2,}/u.test(line)).length,23);assert.doesNotMatch(all,/13 more/u);
  assert.match(formatExploration(session,true),/Limitation: Resolution is not established/u);
  assert.equal(wavelengthText([[0.123456789,0.234567891]]),'0.123–0.235 µm');
  const io=mockIo(true,true,['']),api=mockServices('/tmp/table');
  assert.equal(await main(['explore','eris','--all'],'/workspace',text=>io.io.write(text),io.io,{...api.services,saveExploration:async()=>session}),0);
  assert.equal(io.stdout.join('').split('\n').filter(line=>/^\d+\s{2,}/u.test(line)).length,23);assert.deepEqual(api.calls.args,[]);
});

test('explore JSON is one versioned compact document while real session persistence keeps full evidence',async()=>{
  const work=await mkdtemp(resolve(tmpdir(),'compact-explore-'));
  try{
    const io=mockIo(true,true),api=mockServices(work);
    const full={...answer,choices:[{...choice,reason:'Needs qualification.\nRetains raw metadata.'}]};
    const save:CliServices['saveExploration']=async(root,args,out,_api,progress)=>saveExploration(root,args,out,{load:async()=>{throw new Error('unused load');},qualify:async()=>{throw new Error('unused qualify');},explore:async()=>{progress?.('Fixture progress');return full;}},progress);
    assert.equal(await main(['explore','eris','--out',resolve(work,'run'),'--json'],'/workspace',text=>io.io.write(text),io.io,{...api.services,saveExploration:save}),0);
    assert.equal(io.stdout.length,1);assert.equal(io.prompts.length,0);
    const summary=JSON.parse(io.stdout.join('')),saved=JSON.parse(await readFile(summary.savedPath,'utf8'));
    assert.equal(summary.schema,'cssearth-telescope-explore-summary@1');assert.equal(summary.counts.observations,1);
    assert.deepEqual(Object.keys(summary.choices[0]),['pick','archive','telescope','instrument','mode','kind','date','wavelengthsMicrometres','state','reason']);
    assert.equal(summary.choices[0].date,'2025-01-02');assert.equal(summary.choices[0].reason,'Needs qualification. Retains raw metadata.');
    assert.equal(summary.answer,undefined);assert.equal(summary.choices[0].limitations,undefined);assert.equal(summary.choices[0].reference,undefined);
    assert.deepEqual(saved.answer,full);assert.deepEqual(saved.choices[0].limitations,choice.limitations);assert.deepEqual(saved.choices[0].reference,choice.reference);
    assert.match(io.stderr.join(''),/Fixture progress/u);assert.doesNotMatch(io.stdout.join(''),/Fixture progress/u);
    const ready=explorationSummary({...exploration(work),choices:[{...choice,state:'ready'}]});assert.equal('reason' in ready.choices[0]!,false);
  }finally{await rm(work,{recursive:true,force:true});}
});

test('core flow JSON stays single-document and noninteractive even with TTY input and noisy services',async()=>{
  const work=await mkdtemp(resolve(tmpdir(),'core-json-'));
  try{
    await mkdir(resolve(work,'inspection'));
    await writeFile(resolve(work,'result.json'),'{}');
    for(const args of [['get',work,'--pick','1'],['outputs',resolve(work,'result.json'),'--out',resolve(work,'inspection')],['export',inspection.source,'--output','image','--hdu','1','--plane','0','--out',resolve(work,'image')]]){
      const io=mockIo(true,true),api=mockServices(work);
      const services={...api.services,getSession:async(...params:Parameters<CliServices['getSession']>)=>{process.stdout.write('noisy native tool\n');params[3]('Downloading fixture');return api.services.getSession(...params);}};
      assert.equal(await main([...args,'--json'],'/workspace',text=>io.io.write(text),io.io,services),0);
      assert.equal(io.stdout.length,1);assert.equal(io.prompts.length,0);const summary=JSON.parse(io.stdout.join(''));
      if(args[0]==='get'){assert.equal(summary.schema,'cssearth-telescope-get-summary@1');assert.equal(summary.context,undefined);assert.match(summary.resultPath,/result.json$/u);}
      if(args[0]==='outputs'){assert.equal(summary.savedPath,resolve(await realpath(work),'inspection/outputs.json'));assert.deepEqual(JSON.parse(await readFile(summary.savedPath,'utf8')),inspection);}
      if(args[0]==='export')assert.equal(summary.data,'/tmp/image.fits');
    }
  }finally{await rm(work,{recursive:true,force:true});}
});


test('exhausted download hides raw nested transport errors and saves them for JSON and verbose inspection',async()=>{
  const message='Download interrupted at 400.2 of 401.4 MB after 3 attempts. Run the same command again to retry.';
  const interrupted=Object.assign(new Error(message),{rawMessage:'Connection broken: IncompleteRead(400248320 bytes read)'});
  const api=mockServices('/tmp'),fail=new Error(`${message} Partial files remain in staging.`,{cause:interrupted});
  for(const verbose of [false,true]){
    const io=mockIo(true,true);
    assert.equal(await main(['get','/tmp/run','--pick','1','--json',...(verbose?['--verbose']:[])],'/workspace',text=>io.io.write(text),io.io,{...api.services,getSession:async()=>{throw fail;}}),1);
    const summary=JSON.parse(io.stdout.join(''));
    try{
      assert.equal(summary.error,message);assert.equal(summary.exitCode,1);assert.equal(io.prompts.length,0);
      const saved=JSON.parse(await readFile(summary.savedPath,'utf8'));assert.equal(saved.rawMessage,interrupted.rawMessage);
      if(verbose)assert.match(io.stderr.join(''),/IncompleteRead/u);else assert.doesNotMatch(io.stderr.join(''),/IncompleteRead/u);
    }finally{await rm(resolve(summary.savedPath,'..'),{recursive:true,force:true});}
  }
});


test('saved interruption diagnostics honor an explicit --out directory',async()=>{
  const work=await mkdtemp(resolve(tmpdir(),'failure-output-'));
  try{
    const io=mockIo(false,false),api=mockServices(work),interrupted=Object.assign(new Error('Download interrupted at 1.0 of 2.0 MB after 3 attempts. Run the same command again to retry.'),{rawMessage:'fixture reset'});
    assert.equal(await main(['explore','eris','--out',work,'--json'],'/workspace',text=>io.io.write(text),io.io,{...api.services,saveExploration:async()=>{throw interrupted;}}),1);
    const summary=JSON.parse(io.stdout.join(''));
    assert.ok(summary.savedPath.startsWith(work+'/'));
    assert.equal(JSON.parse(await readFile(summary.savedPath,'utf8')).rawMessage,'fixture reset');
  }finally{await rm(work,{recursive:true,force:true});}
});

test('human outputs also bounds its default rows and retains operation details under verbose',()=>{
  const outputs=Array.from({length:14},(_,index)=>({...inspection.outputs[0]!,hdu:index,limitations:[`Detail ${index}`]}));
  const artifact={...inspection,outputs},screen=formatArtifact(artifact);
  assert.equal(screen.split('\n').filter(line=>/^\d+\. /u.test(line)).length,10);assert.match(screen,/4 more · telescope outputs .* --verbose/u);
  assert.doesNotMatch(screen,/Detail 13/u);const verbose=formatArtifact(artifact,true);
  assert.equal(verbose.split('\n').filter(line=>/^\d+\. /u.test(line)).length,14);assert.match(verbose,/Detail 13/u);
});


test('the real families registry prints its complete JSON without a summary record',async()=>{
  const io=mockIo(true,true);
  const code=await main(['families','--json'],undefined,text=>io.io.write(text),io.io);
  assert.equal(io.stdout.length,1);assert.equal(io.prompts.length,0);
  const rows=familyCoverageLedger();
  assert.ok(io.stdout.join('').length>8000,'The real registry must exercise the large-result path');
  assert.deepEqual(JSON.parse(io.stdout.join('')),rows);
  assert.equal(code,rows.every(row=>row.status==='complete')?0:3);
});


test('incomplete exploration and query notices name outages, overflow and unread records separately',()=>{
  for(const item of [
    {code:'provider-unavailable' as const,scope:'provider' as const,expected:/Some archives did not answer/u},
    {code:'provider-overflow' as const,scope:'provider' as const,expected:/Too many results to list/u},
    {code:'source-unavailable' as const,scope:'indexed-source' as const,expected:/Some records unreadable/u},
  ]){
    const base=exploration('/tmp/coverage'),session={...base,answer:{...base.answer,unresolved:[],issues:[{scope:item.scope,code:item.code,reason:'Fixture cause.'}]}};
    const text=formatExploration(session);assert.match(text,item.expected);
    if(item.code!=='provider-unavailable')assert.doesNotMatch(text,/archives did not answer/u);
    const query={target:'fixture',choices:[],answer:{request:{kind:'image',wavelengthMicrometres:[1,2]},endpoint:{coverage:'incomplete',status:'no-selectable-candidate'},targetCoverage:[],
      archiveAccess:{services:item.code==='source-unavailable'?[]:[{state:item.code==='provider-overflow'?'overflow':'unavailable'}]},
      sourceIntakeIssues:item.code==='source-unavailable'?[{state:'unavailable'}]:[]}} as unknown as Session;
    const queryText=formatSession(query,'/tmp/coverage');assert.match(queryText,item.expected);
    if(item.code!=='provider-unavailable')assert.doesNotMatch(queryText,/archives did not answer/u);
  }
});

test('large export JSON names its existing product record without publishing a duplicate',async()=>{
  const work=await mkdtemp(resolve(tmpdir(),'export-summary-'));
  try{
    const savedPath=resolve(work,'output.product.json'),record={evidence:'Full source record.'};await writeFile(savedPath,JSON.stringify(record));
    const api=mockServices(work),io=mockIo(false,false),result={data:resolve(work,'image.fits'),figure:resolve(work,'figure.png'),values:resolve(work,'values.csv'),receipt:savedPath,sourceContext:{detail:'Source evidence '.repeat(1000)}};
    assert.equal(await main(['export',inspection.source,'--output','image','--hdu','1','--plane','0','--out',work,'--json'],work,text=>io.io.write(text),io.io,{...api.services,exportOutput:async()=>result as never}),0);
    const summary=JSON.parse(io.stdout.join(''));assert.equal(summary.savedPath,savedPath);
    assert.deepEqual(await readdir(work),['output.product.json']);assert.deepEqual(JSON.parse(await readFile(savedPath,'utf8')),record);
  }finally{await rm(work,{recursive:true,force:true});}
});

test('get consent guards the saved size before retrieval, cancellation publishes nothing, JSON reports destination',async()=>{
  const work=await mkdtemp(resolve(tmpdir(),'get-consent-cli-'));
  try{
    for(const [bytes,args,stdin,stdout,reply,count,code] of [
      [99_999_000,[],true,true,'n',0,0], [100_000_000,[],true,true,'n',1,1],
      [401_000_000,[],true,true,'',1,0], [null,[],true,true,'n',1,1],
      [401_000_000,['--yes'],true,true,'n',0,0], [null,['-y'],true,true,'n',0,0],
      [401_000_000,['--json'],true,true,'n',0,0], [null,[],false,true,'n',0,0], [null,[],true,false,'n',0,0],
    ] as const){
      const destination=resolve(work,'pick-1');await rm(destination,{recursive:true,force:true});
      await writeFile(resolve(work,'explore.json'),JSON.stringify({choices:[{telescope:'ALMA',display:{advertisedKilobytes:bytes===null?null:bytes/1000}}]}));
      let transferred=0;
      const io=mockIo(stdin,stdout,[reply]),services=mockServices(work).services;
      const api:CliServices={...services,getDownloadPlan:savedDownload,getSession:async()=>{
        transferred++;await mkdir(destination);await writeFile(resolve(destination,'science.fits'),'science');
        return {resultPath:resolve(destination,'result.json'),product:resolve(destination,'science.fits'),reused:false,context};
      }};
      assert.equal(await main(['get',work,'--pick','1',...args],work,io.io.write,io.io,api),code,io.stderr.join(''));
      assert.equal(io.prompts.filter(prompt=>prompt==='Continue? [Y/n] ').length,count);
      assert.equal(transferred,code===1?0:1);
      assert.match(io.stderr.join(''),/Download: .* from ALMA → .*pick-1\//u);
      if(code===1){assert.deepEqual(await readdir(work),['explore.json']);assert.match(io.stderr.join(''),/Download cancelled/u);}
      else if(args.some(arg=>arg==='--json'))assert.deepEqual(JSON.parse(io.stdout.join('')).download,{bytes,archive:'ALMA',destination});
      else assert.ok(io.stdout.join('').includes(`Files: ${displayPath(destination)}/`));
    }
  }finally{await rm(work,{recursive:true,force:true});}
});

test('implicit toolchain refusal cannot become successful incomplete exploration when a provider catches it',async()=>{
  const io=mockIo(true,true,['n']),services=mockServices('/tmp/run').services;
  const api:CliServices={...services,saveExploration:async()=>{
    try{await requestTransferConsent({kind:'toolchain',name:'astroquery',bytes:1_000_000_000,packages:['Python','Astroquery'],destination:'/tmp/user/toolchains/astroquery'});}catch{/* archive discovery records provider failures */}
    return exploration('/tmp/run');
  }};
  assert.equal(await main(['explore','eris'],'/workspace',io.io.write,io.io,api),1);
  assert.deepEqual(io.prompts,['Continue? [Y/n] ']);
  assert.match(io.stderr.join(''),/Download cancelled/u);
  assert.equal(io.stdout.length,0);
});

test('guided get also propagates an implicit toolchain refusal caught by its retrieval service',async()=>{
  const io=mockIo(true,true,['1','n']),services=mockServices('/tmp/run').services;
  const api:CliServices={...services,getSession:async(...args)=>{
    try{await requestTransferConsent({kind:'toolchain',name:'astroquery',bytes:1_000_000_000,packages:['Python'],destination:'/tmp/user/toolchains/astroquery'});}catch{/* a provider may preserve the issue */}
    return services.getSession(...args);
  }};
  assert.equal(await main(['explore','eris'],'/workspace',io.io.write,io.io,api),1);
  assert.deepEqual(io.prompts,['Choose an observation number, or press Enter to exit: ','Continue? [Y/n] ']);
  assert.match(io.stderr.join(''),/Download cancelled/u);
  assert.doesNotMatch(io.stdout.join(''),/Product:/u);
});
