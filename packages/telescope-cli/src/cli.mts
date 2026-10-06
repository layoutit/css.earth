#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { readFile } from 'node:fs/promises';
import { formatAnswer } from './query.mts';
import type { RequestSatisfaction } from './request-satisfaction.mts';
import { getSession, saveExploration, saveSession, saveFamilyRequestSession, type ExplorationSession, type Session } from './session.mts';
import { exportSpatialObject } from './spatial-handoff.mts';
import { exportOutput } from './outputs.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';
import { projectOutput } from './projection.mts';
import { exportSphere } from './sphere/sphere.mts';
import type { DeliveryContext } from './delivery-context.mts';
import { HELP, SHORT_HELP, VERSION } from './help.mts';
import { importLocalArtifact } from './local-import.mts';
import { formatPapers, formatSweep, searchPapers, sweepPapers } from './papers.mts';
import { formatSimulations, searchSimulations } from './simulations/simulations.mts';
import { formatStars, surveyStars } from './stars/stars.mts';
import { formatLeads, formatSurvey, searchLeads, surveyLeads } from './simulations/leads.mts';
import { formatAscl, matchProductSoftware, searchAscl } from './ascl.mts';
import { familyCoverageLedger } from './family-handlers.mts';
import { executeFamilyOperation, familyOperationNeedsParameters, type FamilyOperationParameters } from './family-operation.mts';
import { exportWwtImage } from './wwt/wwt-image.mts';
import { acquireWwtFits } from './wwt/wwt-fits.mts';
import { resolveWwtFitsLead } from './wwt/wwt-fits-leads.mts';
import { fetchKeckSource } from './keck-source.mts';
import { fetchGeminiSource } from './gemini-source.mts';
import { fetchOpusSource } from './opus-source.mts';
import { fetchChandraSource } from './chandra-source.mts';
import { fetchSpitzerSource } from './spitzer-source.mts';
import { runWorkspaceCommand } from './workspace-commands.mts';
import { NEW_OBJECT_COMMAND } from './workspace-commands/new-object.mts';
import { type CliOptions, parseCli } from './cli-arguments.mts';
import { type ArtifactInspection, type InspectedArtifact, artifactScreen, contextText, displayPath, formatArtifact, formatExploration, formatSession, shellWord } from './cli-format.mts';
import { WORKSPACE } from '@cssearth/telescope/node';
import { FRESH_VARIABLE } from './archives/memory.mts';

export { HELP, SHORT_HELP };

export interface CliIo {
  readonly stdinIsTTY:boolean;readonly stdoutIsTTY:boolean;readonly stderrIsTTY?:boolean;
  readonly write:(text:string)=>void;readonly error:(text:string)=>void;
  readonly question:(prompt:string)=>Promise<string|undefined>;readonly flush?:()=>Promise<void>;readonly close:()=>void;
}
export interface RetrievedResult {
  readonly resultPath:string;readonly product:string;readonly reused:boolean;
  readonly context?:DeliveryContext;readonly satisfaction?:RequestSatisfaction;
}
export interface CliServices {
  readonly importLocalArtifact:typeof importLocalArtifact;
  readonly familyCoverageLedger:typeof familyCoverageLedger;
  readonly saveExploration:typeof saveExploration;
  readonly getSession:(root:string,directory:string,pick:number,progress:(text:string)=>void,api?:undefined,options?:{readonly offline?:boolean})=>Promise<RetrievedResult>;
  readonly listArtifactOutputs:(path:string,structure?:string)=>Promise<InspectedArtifact>;
  readonly exportOutput:typeof exportOutput;
  readonly projectOutput:typeof projectOutput;
  readonly exportSphere:(recordPath:string,outputDirectory:string)=>ReturnType<typeof exportSphere>;
  readonly exportSpatialObject:typeof exportSpatialObject;
  readonly executeFamilyOperation:typeof executeFamilyOperation;
}
const defaultServices:CliServices={importLocalArtifact,familyCoverageLedger,saveExploration,getSession,listArtifactOutputs,exportOutput,projectOutput,exportSphere:async(recordPath,outputDirectory)=>exportSphere(recordPath,outputDirectory,await import(pathToFileURL(resolve(WORKSPACE,'src/platform/solar-geometry.mts')).href)),exportSpatialObject,executeFamilyOperation};
const inheritedTty=(name:string,fallback:boolean|undefined):boolean=>process.env[name]==='1'?true:process.env[name]==='0'?false:fallback===true;
function processIo(output:(text:string)=>void):CliIo {
  let terminal:ReturnType<typeof createInterface>|undefined;
  let flushId=0;
  const flush=async()=>{
    if(!process.send||!process.connected)return;
    const id=++flushId;
    await new Promise<void>(accept=>{
      const acknowledged=(message:unknown)=>{if(message&&typeof message==='object'&&'flush' in message&&message.flush===id){process.off('message',acknowledged);process.off('disconnect',disconnected);accept();}};
      const disconnected=()=>{process.off('message',acknowledged);accept();};
      process.on('message',acknowledged);process.once('disconnect',disconnected);process.send!({flush:id});
    });
  };
  return {stdinIsTTY:inheritedTty('CSSEARTH_TELESCOPE_STDIN_TTY',process.stdin.isTTY),stdoutIsTTY:inheritedTty('CSSEARTH_TELESCOPE_STDOUT_TTY',process.stdout.isTTY),stderrIsTTY:process.stderr.isTTY===true,write:output,error:text=>process.stderr.write(text),flush,
    question:async prompt=>{terminal??=createInterface({input:process.stdin,output:process.stderr,terminal:true});try{return await terminal.question(prompt);}catch{return undefined;}},close:()=>terminal?.close()};
}
export const guided = (options:{readonly json:boolean},io:Pick<CliIo,'stdinIsTTY'|'stdoutIsTTY'>):boolean => !options.json&&io.stdinIsTTY&&io.stdoutIsTTY;
function startProgress(io:CliIo,initial:string){
  const terminal=io.stderrIsTTY===true,started=Date.now(),frames=['|','/','-','\\'];
  let stage=initial,frame=0,width=0,stopped=false;
  const draw=()=>{
    const elapsed=Math.floor((Date.now()-started)/1000),line=`${frames[frame++%frames.length]} ${stage} (${elapsed}s)`;
    io.error(`\r${line}${' '.repeat(Math.max(0,width-line.length))}`);width=line.length;
  };
  if(terminal)draw();else io.error(`${stage}\n`);
  const timer=terminal?setInterval(draw,120):undefined;timer?.unref();
  return {
    update:(next:string)=>{if(stopped||next===stage)return;stage=next;if(terminal)draw();else io.error(`${stage}\n`);},
    stop:(status:'done'|'failed')=>{if(stopped)return;stopped=true;if(timer)clearInterval(timer);const elapsed=Math.floor((Date.now()-started)/1000),line=`${status==='done'?'Done':'Failed'} (${elapsed}s)`;
      if(terminal)io.error(`\r${line}${' '.repeat(Math.max(0,width-line.length))}\n`);else io.error(`${line}\n`);}
  };
}
type ExecutableOutput=Extract<CliOptions,{readonly command:'export'|'project'|'sphere'|'spatial'}>;
async function executeOutput(options:ExecutableOutput,api:CliServices):Promise<string>{
  if(options.command==='project'){
    const result=await api.projectOutput(options.result,options.geometry,options.directory);
    return `Map: ${result.map}\nFigure: ${result.figure}\nEvidence: ${result.receipt}\n`;
  }
  if(options.command==='spatial'){
    const result=await api.exportSpatialObject(options.result,options.kind,options.directory);
    return `Object: ${result.object}\nEvidence: ${result.receipt}\n`;
  }
  if(options.command==='sphere'){
    const result=await api.exportSphere(options.result,options.directory);
    return `Sphere: ${result.html}\nEvidence: ${result.receipt}\n`;
  }
  const result=await api.exportOutput(options.result,options.selection,options.directory);
  return `Data: ${result.data}\nFigure: ${result.figure}\nValues: ${result.values}\nEvidence: ${result.receipt}\n`;
}
async function runFamilyOperation(options:Extract<CliOptions,{readonly command:'family-run'}>,api:CliServices){
  let parameters:Record<string,unknown>={};
  if(options.parameters){
    const value:unknown=JSON.parse(await readFile(options.parameters,'utf8'));
    if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Family operation parameters must be a JSON object.');
    parameters=value as Record<string,unknown>;
    if(parameters.operationId!==undefined&&parameters.operationId!==options.operationId)throw new TypeError(`Parameter operationId ${String(parameters.operationId)} disagrees with ${options.operationId}.`);
    if(options.componentId&&parameters.componentId!==undefined&&parameters.componentId!==options.componentId)throw new TypeError(`Parameter componentId ${String(parameters.componentId)} disagrees with ${options.componentId}.`);
  }else if(familyOperationNeedsParameters(options.operationId))throw new TypeError(`Family operation ${options.operationId} requires --params PARAMS.json.`);
  return api.executeFamilyOperation(options.descriptor,{...parameters,operationId:options.operationId,...(options.componentId?{componentId:options.componentId}:{})} as FamilyOperationParameters,options.directory);
}
const promptLabels:Readonly<Record<string,string>>={
  plane:'Zero-based plane',pixel:'Pixel X,Y',band:'Wavelength band LO,HI (micrometres)',aperture:'Aperture X0,Y0,X1,Y1',
  background:'Background X0,Y0,X1,Y1 or none',continuum:'Continuum L0,L1,R0,R1 (micrometres)',uncertainty:'Uncertainty omit or independent',geometry:'Navigation geometry JSON file'
};
const canceled=(value:string|undefined):boolean=>value===undefined||!value.trim()||/^q(?:uit)?$/iu.test(value.trim());
async function guidedArtifact(result:ArtifactInspection,io:CliIo,api:CliServices,verbose=false):Promise<number>{
  io.write(formatArtifact(result,verbose));
  await io.flush?.();
  const available=[
    ...result.outputs.map((choice,index)=>({kind:'output' as const,choice,index:index+1})).filter(row=>row.choice.available),
    ...(result.familyOperations??[]).map((operation,index)=>({kind:'family' as const,operation,index:result.outputs.length+index+1})).filter(row=>row.operation.available),
  ];
  if(result.terminal||!available.length)return 0;
  let selected:(typeof available)[number]|undefined;
  for(;;){
    const answer=await io.question('Choose an available operation number, or press Enter to exit: ');
    if(canceled(answer)){io.write('No operation was selected.\n');return 0;}
    selected=available.find(row=>String(row.index)===answer!.trim());
    if(selected)break;
    io.error(`Choose one of ${available.map(row=>row.index).join(', ')}, or press Enter to exit.\n`);
  }
  if(selected.kind==='family'){
    const operation=selected.operation;
    const parameters=familyOperationNeedsParameters(operation.id)?await io.question('Parameters JSON file: '):undefined;
    if(familyOperationNeedsParameters(operation.id)&&canceled(parameters)){io.write('Operation canceled; no output was started.\n');return 0;}
    const directory=await io.question('Output directory: ');
    if(canceled(directory)){io.write('Operation canceled; no output was started.\n');return 0;}
    const options=parseCli(['family-run',result.source,operation.id,'--component',operation.componentId,...(parameters?['--params',parameters.trim()]:[]),'--out',directory!.trim()]);
    if(options.command!=='family-run')throw new TypeError('Selected family operation has no executable owner.');
    const output=await runFamilyOperation(options,api);
    io.write(`Product: ${output.product}\nEvidence: ${output.record}\nOperation: ${output.operation.id}\n`);
    return 0;
  }
  const choice=selected.choice;
  for(;;){
    const args=['export',result.source,'--output',choice.kind];
    if(choice.hdu!==undefined)args.push('--hdu',String(choice.hdu));
    if(choice.structure)args.push('--structure',choice.structure);
    let didCancel=false;
    for(const parameter of choice.parameters??[]){
      const value=await io.question(`${promptLabels[parameter]??parameter}: `);
      if(canceled(value)){didCancel=true;break;}
      args.push(`--${parameter}`,value!.trim());
    }
    if(didCancel){io.write('Output canceled; no output was started.\n');return 0;}
    const directory=await io.question('Output directory: ');
    if(canceled(directory)){io.write('Output canceled; no output was started.\n');return 0;}
    args.push('--out',directory!.trim());
    let options:CliOptions;
    try{
      options=parseCli(args);
    }catch(error){
      if(!(error instanceof TypeError||error instanceof RangeError))throw error;
      io.error(`${error.message}. Enter the required values again, or press Enter to cancel.\n`);
      continue;
    }
    if(options.command!=='export'&&options.command!=='project'&&options.command!=='sphere'&&options.command!=='spatial')throw new TypeError('Selected output has no executable owner');
    io.write(await executeOutput(options,api));return 0;
  }
}
async function guidedExploration(root:string,session:ExplorationSession&{readonly directory:string},io:CliIo,api:CliServices,verbose=false):Promise<number>{
  io.write(formatExploration(session,verbose));
  await io.flush?.();
  if(!session.choices.length)return 3;
  let pick:number|undefined;
  for(;;){
    const answer=(await io.question('Choose an observation number, or press Enter to exit: '))?.trim();
    if(!answer||/^q(?:uit)?$/iu.test(answer)){io.write('Exploration saved; no observation was selected.\n');return 0;}
    if(/^\d+$/u.test(answer)&&session.choices.some(choice=>choice.pick===Number(answer))){pick=Number(answer);break;}
    io.error(`Choose a number from 1 to ${session.choices.length}, or press Enter to exit.\n`);
  }
  const result=await api.getSession(root,session.directory,pick,line=>io.error(`${line}\n`));
  io.write([`Product: ${result.product}`,`Evidence: ${result.resultPath}`,contextText(result.context)??(result.satisfaction?`Scientific request: ${result.satisfaction.status}.`:''),...(result.reused?['Reused: verified existing delivery']:[])].filter(Boolean).join('\n')+'\n\n');
  return guidedArtifact(artifactScreen(await api.listArtifactOutputs(result.resultPath),result.resultPath),io,api,verbose);
}

export async function main(args: readonly string[], root = WORKSPACE, output: (text: string) => void = text => { process.stdout.write(text); }, injectedIo?:CliIo,api:CliServices=defaultServices): Promise<number> {
  const io=injectedIo??processIo(output);
  try {
    const options = parseCli(args);
    if (options.command === 'help') { io.write(options.short ? SHORT_HELP : HELP); return 0; }
    if (options.command === 'version') { io.write(`${VERSION}\n`); return 0; }
    // Instrument tools own their logging. Keep every such message off machine-readable stdout.
    const stdout = process.stdout.write;
    let text: string, code: number;
    process.stdout.write = process.stderr.write.bind(process.stderr);
    try {
      if(options.command==='wwt-fits'){
        const selected=options.pick?await resolveWwtFitsLead(root,options.exploration!,options.pick):{catalog:options.catalog!,imageset:options.setName!};
        const result=await acquireWwtFits(selected.catalog,selected.imageset,options.level,options.x,options.y,options.directory);
        text=options.json?`${JSON.stringify(result)}\n`:`Original FITS: ${result.source}\nNumeric image: ${result.data}\nValues: ${result.values}\nFigure: ${result.figure}\nEvidence: ${result.receipt}\nScientific status: ${result.status}\n${result.limitations.map(line=>`  ${line}\n`).join('')}`;code=0;
      }else if(options.command==='fetch'){
        const result=options.archive==='keck'?await fetchKeckSource(options.exploration,options.pick,options.directory)
          :options.archive==='gemini'?await fetchGeminiSource(options.exploration,options.pick,options.directory,undefined,undefined,options.resume)
          :options.archive==='opus'?await fetchOpusSource(options.exploration,options.pick,options.directory,undefined,undefined,options.resume)
          :options.archive==='chandra'?await fetchChandraSource(options.exploration,options.pick,options.directory,undefined,undefined,undefined,options.fileName,options.resume)
          :await fetchSpitzerSource(options.exploration,options.pick,options.directory,undefined,undefined,undefined,options.fileName,options.resume);
        const files='files' in result?result.files:[result.file];
        text=options.json?`${JSON.stringify(result)}\n`:`Original archive file(s): ${files.join(', ')}\nEvidence: ${result.receipt}\nScientific status: ${result.status}\nNext: telescope outputs ${shellWord(displayPath(result.receipt))}\n`;code=0;
      }else if(options.command==='wwt-image'){
        const result=await exportWwtImage(root,options.exploration,options.pick,options.level,options.directory);
        text=options.json?`${JSON.stringify(result)}\n`:`Image: ${result.image}\nSource: ${result.receipt}\nCredit: ${result.value.imageset.credits}\n`;code=0;
      }else if(options.command==='family-run'){
        const result=await runFamilyOperation(options,api);
        text=options.json?`${JSON.stringify(result)}\n`:`Product: ${result.product}\nEvidence: ${result.record}\nOperation: ${result.operation.id}\n`;code=0;
      }else if(options.command==='family-assess'){
        const artifactBytes=await readFile(options.descriptor),artifact=JSON.parse(artifactBytes.toString('utf8'));
        let descriptorPath=options.descriptor,bytes=artifactBytes;
        if(artifact?.schema!=='cssearth-telescope-product-descriptor@1'){
          const inspected=await api.listArtifactOutputs(options.descriptor);
          if(!inspected.familyOperations||typeof inspected.source!=='string')throw new TypeError(`No verified family descriptor is available for ${options.descriptor}. Run telescope outputs on the artifact to inspect its supported operations.`);
          descriptorPath=resolve(inspected.source);bytes=await readFile(descriptorPath);
        }
        const request=JSON.parse(await readFile(options.request,'utf8')),descriptor=JSON.parse(bytes.toString('utf8'));
        const saved=await saveFamilyRequestSession(options.directory,request,descriptor,{path:descriptorPath,bytes:bytes.length});
        text=options.json?`${JSON.stringify(saved)}\n`:`Descriptor compatibility: ${saved.status}\nDescriptor: ${displayPath(descriptorPath)}\nSaved: ${resolve(options.directory,'family-request.json')}\n`;
        code=saved.status==='matched'?0:saved.status==='refused'?4:3;
      }else if(options.command==='ascl'){
        const result=options.product?await matchProductSoftware(options.product):await searchAscl(options.query!);
        text=options.json?`${JSON.stringify(result)}\n`:formatAscl(result);code=result.mode==='query'&&!result.entries?.length?3:0;
      }else if(options.command==='new-object'){
        ({text,code}=await runWorkspaceCommand(root,NEW_OBJECT_COMMAND,[JSON.stringify(options)]));
      }else if(options.command==='papers'){
        const asked={...(options.instrument?{instrument:options.instrument}:{}),...(options.about?{about:options.about}:{}),...(options.fulltext?{fulltext:true}:{}),...(options.directory?{directory:options.directory}:{}),progress:(line:string)=>io.error(`${line}\n`)};
        if(options.targets.length>1){
          const result=await sweepPapers(root,{targets:options.targets,...asked});
          text=options.json?`${JSON.stringify(result)}\n`:formatSweep(result,options.directory);code=result.targets.some(entry=>entry.works.length)?0:3;
        }else{
          const result=await searchPapers(root,{target:options.targets[0]!,...(options.host?{host:options.host}:{}),...asked});
          text=options.json?`${JSON.stringify(result)}\n`:formatPapers(result,options.directory);code=result.works.length?0:3;
        }
      }else if(options.command==='simulations'){
        const result=await searchSimulations(root,{target:options.target,...(options.directory?{directory:options.directory}:{}),progress:line=>io.error(`${line}\n`)});
        text=options.json?`${JSON.stringify(result)}\n`:formatSimulations(result,options.directory);code=result.records.length?0:3;
      }else if(options.command==='stars'){
        const result=await surveyStars(root,{target:options.target,...(options.directory?{directory:options.directory}:{}),progress:line=>io.error(`${line}\n`)});
        text=options.json?`${JSON.stringify(result)}\n`:formatStars(result,options.directory);code=result.leads.length?0:3;
      }else if(options.command==='leads'){
        const shared={...(options.directory?{directory:options.directory}:{}),progress:(line:string)=>io.error(`${line}\n`)};
        if(options.archiveClass){const result=await surveyLeads(root,{archiveClass:options.archiveClass,...shared});text=options.json?`${JSON.stringify(result)}\n`:formatSurvey(result,options.directory);code=result.rows.length?0:3;}
        else{const result=await searchLeads(root,{target:options.target!,...shared});text=options.json?`${JSON.stringify(result)}\n`:formatLeads(result,options.directory);code=result.leads.length?0:3;}
      }else if(options.command==='candidates'){
        const {runCandidates,epochMjd}=await import('./sky/association.mts'),result=await runCandidates(options.system,epochMjd(options.epoch),options.directory,{...(options.figureBackground?{figureBackground:options.figureBackground}:{}),...(options.orbitDraws?{orbitDraws:options.orbitDraws}:{})});
        text=options.json?`${JSON.stringify(result.set)}\n`:`${result.set.candidates.map(candidate=>`${candidate.id}  east ${candidate.eastMas.toFixed(2)} mas  north ${candidate.northMas.toFixed(2)} mas  ${candidate.sigmaEastMas===undefined?'reference':`± ${candidate.sigmaEastMas.toFixed(2)}, ${candidate.sigmaNorthMas!.toFixed(2)} mas (${candidate.predictedFrom!.tool} ${candidate.predictedFrom!.planet})`}`).join('\n')}\nSaved: ${options.directory}\n`;code=0;
      }else if(options.command==='associate'){
        const {runAssociation}=await import('./sky/association.mts'),result=await runAssociation(options.measurements,options.system,options.directory,{...(options.figureBackground?{figureBackground:options.figureBackground}:{}),...(options.orbitDraws?{orbitDraws:options.orbitDraws}:{}),fitAstrometry:options.fitAstrometry,fitOrbits:options.fitOrbits});
        text=options.json?`${JSON.stringify(result.rows)}\n`:`${result.rows.map(({association,chart})=>`${association.measurement.id}: closest ${association.closest}\n${association.tests.map(test=>`  ${test.id}  R ${test.mahalanobis.toFixed(2)}  ${test.sigma===null?test.log10P===null?'beyond double precision':`log10 p ${test.log10P.toFixed(0)}`:`${test.sigma.toFixed(1)}σ`}`).join('\n')}\n  chart ${chart}`).join('\n')}\nSaved: ${options.directory}\n`;code=0;
      }else       if(options.command==='families'){
        const rows=api.familyCoverageLedger();text=options.json?`${JSON.stringify(rows)}\n`:`${rows.map(row=>`${row.family}  ${row.status}  ${row.profiles.length?row.profiles.map(profile=>profile.profileId).join(', '):'no registered profile'}`).join('\n')}\n`;code=rows.every(row=>row.status==='complete')?0:3;
      }else if(options.command==='import'){
        const spec=JSON.parse(await readFile(options.specification,'utf8'));
        const result=await api.importLocalArtifact(spec,options.directory);
        text=options.json?`${JSON.stringify(result)}\n`:`Imported: ${result.manifest}\n${result.descriptor?`Descriptor: ${result.descriptor}\n`:''}Evidence: ${result.receipt}\nProfiles proposed: ${result.value.proposedProfiles.length}\n`;
        code=0;
      }else if(options.command==='explore'){
        // --fresh: every archive is asked again; without it an answer saved in the last day stands (archives/memory.mts).
        if(options.fresh)process.env[FRESH_VARIABLE]='1';
        const progress=startProgress(io,'Resolving target');
        let session:ExplorationSession&{readonly directory:string};
        try{session=await api.saveExploration(root,options.requestArgs,options.directory,undefined,progress.update);progress.stop('done');}
        catch(error){progress.stop('failed');throw error;}
        if(guided(options,io)){process.stdout.write=stdout;return await guidedExploration(root,session,io,api,options.verbose);}
        text=`${JSON.stringify(session)}\n`;code=session.choices.length?0:3;
      }else if(options.command==='project'){
        const result=await api.projectOutput(options.result,options.geometry,options.directory);text=options.json?JSON.stringify(result)+'\n':`Map: ${result.map}\nFigure: ${result.figure}\nEvidence: ${result.receipt}\n`;code=0;
      }else if(options.command==='spatial'){
        const result=await api.exportSpatialObject(options.result,options.kind,options.directory);text=options.json?JSON.stringify(result)+'\n':`Object: ${result.object}\nEvidence: ${result.receipt}\n`;code=0;
      }else if(options.command==='sphere'){
        const result=await api.exportSphere(options.result,options.directory);text=options.json?JSON.stringify(result)+'\n':`Sphere: ${result.html}\nEvidence: ${result.receipt}\n`;code=0;
      }else if(options.command==='outputs'){
        const result=await api.listArtifactOutputs(options.result,options.structure);
        if(guided(options,io)){process.stdout.write=stdout;return await guidedArtifact(artifactScreen(result,options.result),io,api,options.verbose);}
        text=options.json?`${JSON.stringify(result)}\n`:formatArtifact(artifactScreen(result,options.result),options.verbose);code=0;
      }else if(options.command==='export'){
        const result=await api.exportOutput(options.result,options.selection,options.directory);
        text=options.json?`${JSON.stringify(result)}\n`:`Data: ${result.data}\nFigure: ${result.figure}\nValues: ${result.values}\nEvidence: ${result.receipt}\n`;code=0;
      }else if (options.command === 'query') {
        const progress=startProgress(io,'Reading local evidence');
        let session:Session;
        try{session=await saveSession(root, options.requestArgs, options.directory, undefined, progress.update);progress.stop('done');}
        catch(error){progress.stop('failed');throw error;}
        text = options.json ? `${JSON.stringify(session)}\n` : formatSession(session, options.directory, options.verbose) + (options.verbose ? `\n${formatAnswer(session.answer)}` : '');
        code = session.choices.length ? 0 : 3;
      } else {
        const result = await api.getSession(root, options.directory, options.pick, line => io.error(`${line}\n`), undefined, { offline: options.offline });
        const status=result.satisfaction?.status??(result.context?.kind==='exploration'?'not requested':'unknown');
        text = options.json ? `${JSON.stringify(result)}\n` : [`Product: ${result.product}`, `Evidence: ${result.resultPath}`, `Request: ${status}`,
          ...(result.reused ? ['Reused: verified existing delivery'] : []),
          ...Object.entries(result.satisfaction?.constraints??{}).filter(([, v]) => v.answer !== 'yes').map(([name, v]) => `Remaining ${name}: ${v.answer}. ${v.reason}`),
          `Next: telescope outputs ${shellWord(displayPath(result.resultPath))}`].join('\n') + '\n';
        code = result.context?.kind==='exploration'?0:status === 'fulfilled' ? 0 : status === 'refused' ? 4 : 3;
      }
    } finally { process.stdout.write = stdout; }
    io.write(text); return code;
  } catch (error) {
    const code = error instanceof TypeError || error instanceof RangeError ? 2 : 1;
    const summary = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error.cause : undefined;
    const detail = cause instanceof Error ? cause.message : undefined;
    const message = detail && detail !== summary ? `${summary}: ${detail}` : summary;
    if (args.includes('--json')) io.write(`${JSON.stringify({ error: message, exitCode: code })}\n`);
    io.error(`${args.includes('--verbose') && error instanceof Error ? error.stack : message}\n`);
    return code;
  }finally{io.close();}
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.send) process.exitCode = await main(process.argv.slice(2), undefined, text => { process.send!({ text }); });
  else {
    // Give reducers and every inherited Python/native subprocess stderr at the descriptor level.
    // The single final response crosses IPC, so stdout remains parseable even for noisy tools.
    const worker = fork(fileURLToPath(import.meta.url), process.argv.slice(2), { stdio: ['inherit', 2, 2, 'ipc'],env:{...process.env,
      CSSEARTH_TELESCOPE_STDIN_TTY:process.stdin.isTTY?'1':'0',
      CSSEARTH_TELESCOPE_STDOUT_TTY:process.stdout.isTTY?'1':'0'} });
    let pendingOutput:Promise<void>=Promise.resolve();
    worker.on('message', (message: unknown) => {
      if (message && typeof message === 'object' && 'text' in message && typeof message.text === 'string') {
        const text=message.text;
        pendingOutput=pendingOutput.then(()=>new Promise(accept=>process.stdout.write(text,()=>accept())));
      }
      else if(message&&typeof message==='object'&&'flush' in message&&typeof message.flush==='number')void pendingOutput.then(()=>worker.send({flush:message.flush}));
    });
    const forward = (signal: NodeJS.Signals) => worker.kill(signal);
    process.on('SIGINT', forward); process.on('SIGTERM', forward);
    process.exitCode = await new Promise<number>((accept, reject) => { worker.once('error', reject); worker.once('exit', (code, signal) => accept(code ?? (signal === 'SIGINT' ? 130 : 143))); });
    process.off('SIGINT', forward); process.off('SIGTERM', forward);
  }
}
