#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { readFile } from 'node:fs/promises';
import { formatAnswer } from './query.mts';
import { assessRequest, type RequestSatisfaction } from './request-satisfaction.mts';
import { getSession, saveExploration, saveSession, saveFamilyRequestSession, type ExplorationSession, type Session } from './session.mts';
import { parseExplorationArguments, type ExplorationRequest } from './exploration.mts';

import { exportSpatialObject } from './spatial-handoff.mts';
import { exportOutput, validateOutputRequest, type OutputChoice, type OutputRequest } from './outputs.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';
import { projectOutput } from './projection.mts';
import { exportSphere } from './sphere.mts';
import type { DeliveryContext } from './delivery-context.mts';
import { HELP } from '../../../packages/telescope/src/help.mts';
import { importLocalArtifact } from './local-import.mts';
import { familyCoverageLedger } from './family-handlers.mts';
import type { FamilyOperation } from './family-handlers.mts';
import { executeFamilyOperation, familyOperationNeedsParameters, type FamilyOperationParameters } from './family-operation.mts';
export { HELP };

const queryValues = new Set(['--target', '--wavelength', '--kind', '--from', '--to', '--min-arcsec', '--min-km', '--min-elements', '--range-km', '--radius-km', '--continuum', '--accept-assumptions', '--icrs-circle', '--spectral-frame', '--max-science-bytes', '--max-metadata-bytes', '--max-link-depth', '--max-link-requests', '--max-expanded-bytes', '--max-package-members']);
export type CliOptions = {readonly command:'family-run';readonly descriptor:string;readonly operationId:string;readonly parameters?:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'family-assess';readonly request:string;readonly descriptor:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'families';readonly json:boolean;readonly verbose:boolean}|{readonly command:'import';readonly specification:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'spatial';readonly kind:'points'|'volume';readonly result:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'project';readonly result:string;readonly geometry:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'sphere';readonly result:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'outputs';readonly result:string;readonly structure?:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'export';readonly result:string;readonly directory:string;readonly selection:OutputRequest;readonly json:boolean;readonly verbose:boolean} | { readonly command: 'help' } | { readonly command: 'explore'; readonly directory?: string; readonly request: ExplorationRequest; readonly requestArgs: readonly string[]; readonly json: boolean; readonly verbose: boolean } | { readonly command: 'query'; readonly directory: string; readonly requestArgs: string[]; readonly json: boolean; readonly verbose: boolean } | { readonly command: 'get'; readonly offline?: boolean; readonly directory: string; readonly pick: number; readonly json: boolean; readonly verbose: boolean };
export function parseCli(args: readonly string[]): CliOptions {
  const command = args[0];
  if (!args.length || args.includes('--help') || args.includes('-h')) return { command: 'help' as const };
  if(command==='family-run'){const positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();for(let i=1;i<args.length;i++){const arg=args[i]!;if(!arg.startsWith('-')){positional.push(arg);continue;}if(arg==='--json'||arg==='--verbose'){if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);flags.add(arg);continue;}if(!['--params','--out'].includes(arg)||values.has(arg))throw new TypeError('Use telescope family-run DESCRIPTOR.json OPERATION --params PARAMS.json --out DIRECTORY [--json].');const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError(`Missing value for ${arg}.`);values.set(arg,value);}if(positional.length!==2||!values.has('--out'))throw new TypeError('Use telescope family-run DESCRIPTOR.json OPERATION --params PARAMS.json --out DIRECTORY [--json].');return{command,descriptor:resolve(positional[0]!),operationId:positional[1]!,...(values.has('--params')?{parameters:resolve(values.get('--params')!)}:{}),directory:resolve(values.get('--out')!),json:flags.has('--json'),verbose:flags.has('--verbose')};}
  if(command==='family-assess'){const positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();for(let i=1;i<args.length;i++){const arg=args[i]!;if(!arg.startsWith('-')){positional.push(arg);continue;}if(arg==='--json'||arg==='--verbose'){if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);flags.add(arg);continue;}if(arg!=='--out'||values.has(arg))throw new TypeError('Use telescope family-assess REQUEST.json DESCRIPTOR.json --out DIRECTORY.');const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError('Missing value for --out.');values.set(arg,value);}if(positional.length!==2||!values.has('--out'))throw new TypeError('Use telescope family-assess REQUEST.json DESCRIPTOR.json --out DIRECTORY.');return{command,request:resolve(positional[0]!),descriptor:resolve(positional[1]!),directory:resolve(values.get('--out')!),json:flags.has('--json'),verbose:flags.has('--verbose')};}
  if(command==='families'){
    const flags=new Set(args.slice(1));if([...flags].some(arg=>arg!=='--json'&&arg!=='--verbose')||flags.size!==args.length-1)throw new TypeError('Use telescope families [--json] [--verbose].');
    return {command,json:flags.has('--json'),verbose:flags.has('--verbose')};
  }
  if(command==='explore'){
    const requestArgs:string[]=[],values=new Map<string,string>(),flags=new Set<string>();
    for(let i=1;i<args.length;i++){
      const arg=args[i]!;
      if(arg==='--json'||arg==='--verbose'){if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);flags.add(arg);continue;}
      if(arg==='--out'){
        if(values.has(arg))throw new TypeError(`Repeated option ${arg}.`);
        const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError('Missing value for --out.');values.set(arg,value);continue;
      }
      requestArgs.push(arg);
    }
    const request=parseExplorationArguments(requestArgs);
    return {command,request,requestArgs,...(values.has('--out')?{directory:resolve(values.get('--out')!)}:{}),json:flags.has('--json'),verbose:flags.has('--verbose')};
  }
  if(command==='import'){
    const positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();
    for(let i=1;i<args.length;i++){
      const arg=args[i]!;
      if(!arg.startsWith('-')){positional.push(arg);continue;}
      if(arg==='--json'||arg==='--verbose'){if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);flags.add(arg);continue;}
      if(arg!=='--out'||values.has(arg))throw new TypeError(`Unknown or repeated import option ${arg}.`);
      const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError('Missing value for --out.');values.set(arg,value);
    }
    if(positional.length!==1||!values.get('--out'))throw new TypeError('Use telescope import SPEC.json --out DIRECTORY.');
    return {command,specification:resolve(positional[0]!),directory:resolve(values.get('--out')!),json:flags.has('--json'),verbose:flags.has('--verbose')};
  }
  if(command==='outputs'||command==='export'||command==='project'){
    const positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();
    for(let i=1;i<args.length;i++){
      const arg=args[i];if(!arg.startsWith('-')){positional.push(arg);continue;}
      if(['--json','--verbose'].includes(arg)){if(flags.has(arg))throw new TypeError(`Repeated option ${arg}`);flags.add(arg);continue;}
      if(!(command==='outputs'?['--structure']:command==='project'?['--geometry','--out']:['--output','--hdu','--structure','--plane','--pixel','--out','--band','--aperture','--background','--continuum','--uncertainty','--geometry']).includes(arg)||values.has(arg))throw new TypeError(`Unknown or repeated ${command} option ${arg}`);
      const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError(`Missing value for ${arg}`);values.set(arg,value);
    }
    if(positional.length!==1)throw new TypeError(`Use telescope ${command} ARTIFACT_JSON`);
    const common={result:resolve(positional[0]),json:flags.has('--json'),verbose:flags.has('--verbose')};
    if(command==='outputs')return {command,...common,...(values.has('--structure')?{structure:values.get('--structure')!}:{})};
    if(command==='project'){const geometry=values.get('--geometry'),directory=values.get('--out');if(!geometry||!directory)throw new TypeError('project requires --geometry FILE and --out DIRECTORY');return {command,...common,geometry:resolve(geometry),directory:resolve(directory)};}
    const kind=values.get('--output');if(kind==='points'||kind==='volume'){if([...values.keys()].some(k=>!['--output','--out'].includes(k))||!values.get('--out'))throw new TypeError('Spatial handoff takes only --output points|volume and --out DIRECTORY');return {command:'spatial',kind,...common,directory:resolve(values.get('--out')!)};}if(kind==='sphere'){if([...values.keys()].some(k=>!['--output','--out'].includes(k))||!values.get('--out'))throw new TypeError('Sphere takes only --output sphere and --out DIRECTORY');return {command:'sphere',...common,directory:resolve(values.get('--out')!)};}if(kind==='body-map'){if([...values.keys()].some(k=>!['--output','--geometry','--out'].includes(k))||!values.get('--geometry')||!values.get('--out'))throw new TypeError('Body map export takes --output body-map --geometry FILE and --out DIRECTORY');return {command:'project',...common,geometry:resolve(values.get('--geometry')!),directory:resolve(values.get('--out')!)};}if(kind!=='image'&&kind!=='spectrum'&&kind!=='band-image'&&kind!=='aperture-spectrum'&&kind!=='feature-map')throw new TypeError('--output takes image, spectrum, band-image, aperture-spectrum, feature-map, body-map, sphere, points or volume');
    if(values.has('--geometry'))throw new TypeError('--geometry applies only to --output body-map');
    const integer=(value:string|undefined)=>{if(value===undefined||!/^\d+$/u.test(value)||!Number.isSafeInteger(Number(value)))throw new TypeError('Selectors must be nonnegative whole numbers');return Number(value);};
    const hdu=integer(values.get('--hdu')),plane=values.has('--plane')?integer(values.get('--plane')):undefined;
    const parts=values.get('--pixel')?.split(',');if(parts&&parts.length!==2)throw new TypeError('--pixel takes X,Y');
    const pixel=parts?[integer(parts[0]),integer(parts[1])] as const:undefined;
    const directory=values.get('--out');if(!directory)throw new TypeError('export requires --out DIRECTORY');
    const numbers=(key:string)=>{const parts=values.get(key)!.split(',');if(parts.some(p=>!p.trim()||!Number.isFinite(Number(p))))throw new TypeError(`${key} requires comma-separated numbers`);return parts.map(Number);};
    const rawUncertainty=values.get('--uncertainty');if(rawUncertainty!==undefined&&rawUncertainty!=='omit'&&rawUncertainty!=='independent')throw new TypeError('--uncertainty takes omit or independent');
    const uncertainty:OutputRequest['uncertainty']=rawUncertainty==='omit'||rawUncertainty==='independent'?rawUncertainty:undefined;
    const selection:OutputRequest={kind,hdu,...(values.has('--structure')?{structure:values.get('--structure')!}:{}),...(plane===undefined?{}:{plane}),...(pixel?{pixel}:{}),
      ...(values.has('--band')?{band:numbers('--band')}:{}),...(values.has('--aperture')?{aperture:numbers('--aperture')}:{}),
      ...(values.has('--background')?{background:values.get('--background')==='none'?'none':numbers('--background')}:{}),
      ...(values.has('--continuum')?{continuum:numbers('--continuum')}:{}),...(uncertainty?{uncertainty}:{})};
    validateOutputRequest(selection);
    return {command,...common,directory:resolve(directory),selection};
  }
  if (command !== 'query' && command !== 'get') throw new TypeError('Expected explore, import, query, get, outputs, family-run, export or project. Use telescope --help.');
  const values = new Map<string, string>(), switches = new Set<string>(), positional: string[] = [], requestArgs: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) { positional.push(arg); continue; }
    if (['--json', '--verbose', ...(command === 'query' ? ['--any-time'] : ['--offline'])].includes(arg)) {
      if (switches.has(arg)) throw new TypeError(`Repeated option ${arg}.`);
      switches.add(arg); if (arg === '--any-time') requestArgs.push(arg); continue;
    }
    if (command === 'query' && arg === '--result') throw new TypeError('Saved telescope queries retrieve native products. Choose body-map, sphere, points or volume later with telescope export.');
    if (!(command === 'query' ? arg === '--out' || queryValues.has(arg) : arg === '--pick')) throw new TypeError(`Unknown ${command} option ${arg}.`);
    if (values.has(arg)) throw new TypeError(`Repeated option ${arg}.`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new TypeError(`Missing value for ${arg}.`);
    values.set(arg, value); if (queryValues.has(arg)) requestArgs.push(arg, value);
  }
  const json = switches.has('--json'), verbose = switches.has('--verbose');
  if (command === 'query') {
    if (positional.length > 1 || positional.length && values.has('--target')) throw new TypeError('Give one target, either positional or --target.');
    if (positional[0]) requestArgs.push('--target', positional[0]);
    requestArgs.push('--result', 'telescope-product');
    const directory = values.get('--out'); if (!directory) throw new TypeError('query requires --out DIRECTORY.');
    return { command, directory: resolve(directory), requestArgs, json, verbose };
  }
  const pick = Number(values.get('--pick'));
  if (positional.length !== 1 || !Number.isSafeInteger(pick) || pick < 1) throw new TypeError('Use telescope get DIRECTORY --pick N, with a positive whole number.');
  return { command, directory: resolve(positional[0]), pick, json, verbose, ...(switches.has('--offline') ? { offline: true } : {}) };
}
export function formatSession(session: Session, directory: string): string {
  const lines = [`${session.target} · ${session.answer.request.kind} · ${session.answer.request.wavelengthMicrometres.join('–')} µm`, ''];
  for (const choice of session.choices) {
    const verdict = choice.product ? assessRequest(session.answer.request, choice.product.facts) : undefined;
    lines.push(`${choice.pick}. ${choice.telescope} / ${choice.mode} / ${choice.observation}`,
      `   ${choice.state === 'ready' ? 'Data qualified' : 'Qualification required'}${verdict ? `; request ${verdict.status}` : ''}`);
    if (verdict) for (const [name, v] of Object.entries(verdict.constraints)) if (v.answer !== 'yes') lines.push(`   ${name}: ${v.answer}. ${v.reason}`);
  }
  if (!session.choices.length) {
    lines.push(`No retrievable observation. Workflow: ${session.answer.endpoint.status}.`);
    if (session.answer.targetResolution.status !== 'resolved') lines.push(formatAnswer(session.answer).trim());
    for (const candidate of session.answer.candidates) lines.push(`  ${candidate.telescope} / ${candidate.mode}: ${candidate.selectionAssessment.blockers.map(b => b.reason).join('; ') || 'No exact qualified artifact or executable qualification action.'}`);
  }
  for (const coverage of session.answer.targetCoverage) if (coverage.state !== 'observed') lines.push(`${coverage.telescope}: ${coverage.state}. ${coverage.reason}`);
  for (const issue of session.answer.sourceIntakeIssues ?? []) lines.push(`Source ${issue.state}: ${issue.path}. ${issue.reason}`);
  for (const service of session.answer.archiveAccess?.services ?? []) lines.push(`${service.service}: ${service.state}. ${service.reason}`);
  for (const record of session.answer.archiveAccess?.records ?? []) if (!record.products.length) lines.push(`Archive ${record.observation.key}: ${record.observation.target.status}. ${record.issues.join('; ')}`);
  lines.push('', `Saved: ${resolve(directory, 'query.json')}`);
  if (session.choices.length) lines.push(`Next: telescope get ${JSON.stringify(directory)} --pick N`);
  return `${lines.join('\n')}\n`;
}

const shellWord = (value:string):string => /^[A-Za-z0-9_./,:@+%=-]+$/u.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
const displayTime = (start:string|null,end:string|null):string => start === null ? 'date unknown' : end && end !== start ? `${start} to ${end}` : start;
function displayWavelengths(value:readonly (number|null)[]|readonly (readonly [number,number])[]):string {
  if(!value.length)return 'wavelength unknown';
  const ranges = Array.isArray(value[0]) ? value as readonly (readonly [number,number])[] : [value as readonly [number|null,number|null]];
  return ranges.map(range=>range[0]===null||range[1]===null?'unknown':`${range[0]}–${range[1]} µm`).join(', ');
}
export function formatExploration(session:ExplorationSession & {readonly directory:string}):string {
  const answer=session.answer,resolution=answer.targetResolution;
  const title=resolution.status==='resolved'?resolution.canonical.name:answer.target;
  const lines=[title,''];
  for(const choice of session.choices){
    const d=choice.display,size=d.advertisedKilobytes===null?'size unknown':`${d.advertisedKilobytes} kB advertised`;
    lines.push(`${choice.pick}. ${d.instrument} · ${displayTime(d.observationTime.startIso,d.observationTime.endIso)} · ${d.productKind??'product kind unknown'}`,
      `   ${choice.state==='ready'?'Qualified product available':'Retrieval and qualification available'} · ${size} · ${d.metadataBasis} metadata`,
      `   ${displayWavelengths(d.wavelengthsMicrometres)}`,
      `   ${choice.reason}`);
    for(const limitation of choice.limitations)lines.push(`   Limitation: ${limitation}`);
  }
  if(!session.choices.length)lines.push('No actionable observation is available in this bounded exploration.');
  if(answer.unsupported.length){lines.push('','Unsupported discoveries:');for(const issue of answer.unsupported)lines.push(`  ${issue.identity??issue.scope}: ${issue.reason}`);}
  if(answer.issues.length){lines.push('','Search limits and provider status:');for(const issue of answer.issues)lines.push(`  ${issue.identity??issue.scope}: ${issue.reason}`);}
  lines.push('',`Saved: ${resolve(session.directory,'explore.json')}`);
  if(session.choices.length)lines.push(`Continue explicitly: telescope get ${shellWord(session.directory)} --pick N`);
  return `${lines.join('\n')}\n`;
}

export interface ArtifactInspection {
  readonly artifact:string;readonly target?:string;readonly source:string;readonly sourceContext?:DeliveryContext;
  readonly outputs:readonly OutputChoice[];readonly terminal?:boolean;readonly profiles?:readonly {readonly handlerId:string;readonly profileId:string}[];readonly issues?:readonly string[];readonly familyOperations?:readonly FamilyOperation[];
}
interface InspectedArtifact {
  readonly artifact:string;readonly target?:unknown;readonly source:unknown;readonly sourceContext?:DeliveryContext;
  readonly outputs:readonly OutputChoice[];readonly terminal?:boolean;readonly profiles?:readonly {readonly handlerId:string;readonly profileId:string}[];readonly issues?:readonly string[];readonly familyOperations?:readonly FamilyOperation[];
}
const artifactScreen=(result:InspectedArtifact,path:string):ArtifactInspection=>({artifact:result.artifact,...(typeof result.target==='string'?{target:result.target}:{}),source:resolve(path),...(result.sourceContext?{sourceContext:result.sourceContext}:{}),outputs:result.outputs,...(result.terminal?{terminal:true}:{}),...(result.profiles?{profiles:result.profiles}:{}),...(result.issues?{issues:result.issues}:{}),...(result.familyOperations?{familyOperations:result.familyOperations}:{})});
function contextText(context:DeliveryContext|undefined):string|undefined {
  if(!context)return undefined;
  return context.kind==='exploration'?'No scientific acceptance criteria requested.':`Scientific request: ${context.assessment.status}.`;
}
export function outputCommand(source:string,choice:OutputChoice):string {
  const args=['telescope','export',source,'--output',choice.kind];
  if(choice.hdu!==undefined)args.push('--hdu',String(choice.hdu));
  if(choice.structure)args.push('--structure',choice.structure);
  for(const parameter of choice.parameters??[]){
    const placeholder={plane:'N',pixel:'X,Y',band:'LO,HI',aperture:'X0,Y0,X1,Y1',background:'none|X0,Y0,X1,Y1',continuum:'L0,L1,R0,R1',uncertainty:'omit|independent',geometry:'FILE'}[parameter];
    args.push(`--${parameter}`,placeholder??parameter.toUpperCase());
  }
  args.push('--out','DIRECTORY');
  return args.map(shellWord).join(' ');
}
export function formatArtifact(result:ArtifactInspection):string {
  const lines=[`${result.target??'Artifact'} · ${result.artifact}`,`Source: ${result.source}`];
  const context=contextText(result.sourceContext);if(context)lines.push(context);
  if(result.profiles?.length)lines.push(`Proposed profiles: ${result.profiles.map(profile=>`${profile.handlerId}/${profile.profileId}`).join(', ')}.`);
  for(const issue of result.issues??[])lines.push(`Limitation: ${issue}`);
  if(result.familyOperations?.length){lines.push('','Family operations:');for(const operation of result.familyOperations){lines.push(`${operation.id} · ${operation.componentId}: ${operation.available?'available':'unavailable'}.`, `   ${operation.reason}`,`   Owner: ${operation.owner.module}#${operation.owner.export}`);for(const limitation of operation.limitations)lines.push(`   Limitation: ${limitation}`);}}
  if(result.terminal||!result.outputs.length&&!result.familyOperations?.length)lines.push('No further supported outputs. This artifact is terminal.');
  else{
    lines.push('','Supported next operations:');
    result.outputs.forEach((choice,index)=>{
      const identity=[choice.kind,choice.hdu===undefined?undefined:`HDU ${choice.hdu}`,choice.structure,choice.shape?`shape ${choice.shape.join('×')}`:undefined].filter(Boolean).join(' · ');
      lines.push(`${index+1}. ${identity}: ${choice.available?'available':'unavailable'}.`,`   ${choice.reason}`);
      if(choice.unit)lines.push(`   Unit: ${choice.unit.value} (${choice.unit.source})`);
      if(choice.spectral?.centersMicrometres.length)lines.push(`   Wavelength coordinates: ${choice.spectral.centersMicrometres[0]}–${choice.spectral.centersMicrometres.at(-1)} µm (${choice.spectral.centersMicrometres.length} samples)`);
      for(const limitation of choice.limitations??[])lines.push(`   Limitation: ${limitation}`);
      if(choice.available)lines.push(`   Next: ${outputCommand(result.source,choice)}`);
    });
  }
  return `${lines.join('\n')}\n`;
}

export interface CliIo {
  readonly stdinIsTTY:boolean;readonly stdoutIsTTY:boolean;
  readonly write:(text:string)=>void;readonly error:(text:string)=>void;
  readonly question:(prompt:string)=>Promise<string|undefined>;readonly close:()=>void;
}
export interface RetrievedResult {
  readonly resultPath:string;readonly product:string;readonly reused:boolean;
  readonly context?:DeliveryContext;readonly satisfaction?:RequestSatisfaction;
}
export interface CliServices {
  readonly importLocalArtifact:typeof importLocalArtifact;
  readonly familyCoverageLedger:typeof familyCoverageLedger;
  readonly saveExploration:(root:string,args:readonly string[],directory?:string)=>Promise<ExplorationSession&{readonly directory:string}>;
  readonly getSession:(root:string,directory:string,pick:number,progress:(text:string)=>void,api?:undefined,options?:{readonly offline?:boolean})=>Promise<RetrievedResult>;
  readonly listArtifactOutputs:(path:string,structure?:string)=>Promise<InspectedArtifact>;
  readonly exportOutput:typeof exportOutput;
  readonly projectOutput:typeof projectOutput;
  readonly exportSphere:typeof exportSphere;
  readonly exportSpatialObject:typeof exportSpatialObject;
  readonly executeFamilyOperation:typeof executeFamilyOperation;
}
const defaultServices:CliServices={importLocalArtifact,familyCoverageLedger,saveExploration,getSession,listArtifactOutputs,exportOutput,projectOutput,exportSphere,exportSpatialObject,executeFamilyOperation};
const inheritedTty=(name:string,fallback:boolean|undefined):boolean=>process.env[name]==='1'?true:process.env[name]==='0'?false:fallback===true;
function processIo(output:(text:string)=>void):CliIo {
  let terminal:ReturnType<typeof createInterface>|undefined;
  return {stdinIsTTY:inheritedTty('CSSEARTH_TELESCOPE_STDIN_TTY',process.stdin.isTTY),stdoutIsTTY:inheritedTty('CSSEARTH_TELESCOPE_STDOUT_TTY',process.stdout.isTTY),write:output,error:text=>process.stderr.write(text),
    question:async prompt=>{terminal??=createInterface({input:process.stdin,output:process.stderr,terminal:true});try{return await terminal.question(prompt);}catch{return undefined;}},close:()=>terminal?.close()};
}
export const guided = (options:{readonly json:boolean},io:Pick<CliIo,'stdinIsTTY'|'stdoutIsTTY'>):boolean => !options.json&&io.stdinIsTTY&&io.stdoutIsTTY;
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
const promptLabels:Readonly<Record<string,string>>={
  plane:'Zero-based plane',pixel:'Pixel X,Y',band:'Wavelength band LO,HI (micrometres)',aperture:'Aperture X0,Y0,X1,Y1',
  background:'Background X0,Y0,X1,Y1 or none',continuum:'Continuum L0,L1,R0,R1 (micrometres)',uncertainty:'Uncertainty omit or independent',geometry:'Navigation geometry JSON file'
};
const canceled=(value:string|undefined):boolean=>value===undefined||!value.trim()||/^q(?:uit)?$/iu.test(value.trim());
async function guidedArtifact(result:ArtifactInspection,io:CliIo,api:CliServices):Promise<number>{
  io.write(formatArtifact(result));
  const available=result.outputs.map((choice,index)=>({choice,index:index+1})).filter(row=>row.choice.available);
  if(result.terminal||!available.length)return 0;
  let selected:typeof available[number]|undefined;
  for(;;){
    const answer=await io.question('Choose an available output number, or press Enter to exit: ');
    if(canceled(answer)){io.write('No output was selected.\n');return 0;}
    selected=available.find(row=>String(row.index)===answer!.trim());
    if(selected)break;
    io.error(`Choose one of ${available.map(row=>row.index).join(', ')}, or press Enter to exit.\n`);
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
async function guidedExploration(root:string,session:ExplorationSession&{readonly directory:string},io:CliIo,api:CliServices):Promise<number>{
  io.write(formatExploration(session));
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
  return guidedArtifact(artifactScreen(await api.listArtifactOutputs(result.resultPath),result.resultPath),io,api);
}

export async function main(args: readonly string[], root = resolve(import.meta.dirname, '../../..'), output: (text: string) => void = text => { process.stdout.write(text); }, injectedIo?:CliIo,api:CliServices=defaultServices): Promise<number> {
  const io=injectedIo??processIo(output);
  try {
    const options = parseCli(args);
    if (options.command === 'help') { io.write(HELP); return 0; }
    // Instrument tools own their logging. Keep every such message off machine-readable stdout.
    const stdout = process.stdout.write;
    let text: string, code: number;
    process.stdout.write = process.stderr.write.bind(process.stderr);
    try {
      if(options.command==='family-run'){let raw:Record<string,unknown>;if(options.parameters){const value:unknown=JSON.parse(await readFile(options.parameters,'utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Family operation parameters must be a JSON object.');raw=value as Record<string,unknown>;if(raw.operationId!==undefined&&raw.operationId!==options.operationId)throw new TypeError(`Parameter operationId ${String(raw.operationId)} disagrees with ${options.operationId}.`);}else{if(familyOperationNeedsParameters(options.operationId))throw new TypeError(`Family operation ${options.operationId} requires --params PARAMS.json.`);raw={};}const result=await api.executeFamilyOperation(options.descriptor,{...raw,operationId:options.operationId}as unknown as FamilyOperationParameters,options.directory);text=options.json?`${JSON.stringify(result)}\n`:`Product: ${result.product}\nEvidence: ${result.record}\nOperation: ${result.operation.id}\n`;code=0;
      }else if(options.command==='family-assess'){const request=JSON.parse(await readFile(options.request,'utf8')),descriptor=JSON.parse(await readFile(options.descriptor,'utf8')),saved=await saveFamilyRequestSession(options.directory,request,descriptor);text=options.json?`${JSON.stringify(saved)}\n`:`Family request: ${saved.status}\nSaved: ${resolve(options.directory,'family-request.json')}\n`;code=saved.status==='fulfilled'?0:saved.status==='refused'?4:3;
      }else       if(options.command==='families'){
        const rows=api.familyCoverageLedger();text=options.json?`${JSON.stringify(rows)}\n`:`${rows.map(row=>`${row.family}  ${row.status}  ${row.profiles.length?row.profiles.map(profile=>profile.profileId).join(', '):'no registered profile'}`).join('\n')}\n`;code=rows.every(row=>row.status==='complete')?0:3;
      }else if(options.command==='import'){
        const spec=JSON.parse(await readFile(options.specification,'utf8'));
        const result=await api.importLocalArtifact(spec,options.directory);
        text=options.json?`${JSON.stringify(result)}\n`:`Imported: ${result.manifest}\nEvidence: ${result.receipt}\nProfiles proposed: ${result.value.proposedProfiles.length}\n`;
        code=0;
      }else if(options.command==='explore'){
        io.error('Exploring observations…\n');
        const session=await api.saveExploration(root,options.requestArgs,options.directory);
        if(guided(options,io)){process.stdout.write=stdout;return await guidedExploration(root,session,io,api);}
        text=`${JSON.stringify(session)}\n`;code=session.choices.length?0:3;
      }else if(options.command==='project'){
        const result=await api.projectOutput(options.result,options.geometry,options.directory);text=options.json?JSON.stringify(result)+'\n':`Map: ${result.map}\nFigure: ${result.figure}\nEvidence: ${result.receipt}\n`;code=0;
      }else if(options.command==='spatial'){
        const result=await api.exportSpatialObject(options.result,options.kind,options.directory);text=options.json?JSON.stringify(result)+'\n':`Object: ${result.object}\nEvidence: ${result.receipt}\n`;code=0;
      }else if(options.command==='sphere'){
        const result=await api.exportSphere(options.result,options.directory);text=options.json?JSON.stringify(result)+'\n':`Sphere: ${result.html}\nEvidence: ${result.receipt}\n`;code=0;
      }else if(options.command==='outputs'){
        const result=await api.listArtifactOutputs(options.result,options.structure);
        if(guided(options,io)){process.stdout.write=stdout;return await guidedArtifact(artifactScreen(result,options.result),io,api);}
        text=options.json?`${JSON.stringify(result)}\n`:formatArtifact(artifactScreen(result,options.result));code=0;
      }else if(options.command==='export'){
        const result=await api.exportOutput(options.result,options.selection,options.directory);
        text=options.json?`${JSON.stringify(result)}\n`:`Data: ${result.data}\nFigure: ${result.figure}\nValues: ${result.values}\nEvidence: ${result.receipt}\n`;code=0;
      }else if (options.command === 'query') {
        io.error('Querying observations…\n');
        const session = await saveSession(root, options.requestArgs, options.directory);
        text = options.json ? `${JSON.stringify(session)}\n` : formatSession(session, options.directory) + (options.verbose ? `\n${formatAnswer(session.answer)}` : '');
        code = session.choices.length ? 0 : 3;
      } else {
        const result = await api.getSession(root, options.directory, options.pick, line => io.error(`${line}\n`), undefined, { offline: options.offline });
        const status=result.satisfaction?.status??(result.context?.kind==='exploration'?'not requested':'unknown');
        text = options.json ? `${JSON.stringify(result)}\n` : [`Product: ${result.product}`, `Evidence: ${result.resultPath}`, `Request: ${status}`,
          ...(result.reused ? ['Reused: verified existing delivery'] : []),
          ...Object.entries(result.satisfaction?.constraints??{}).filter(([, v]) => v.answer !== 'yes').map(([name, v]) => `Remaining ${name}: ${v.answer}. ${v.reason}`)].join('\n') + '\n';
        code = result.context?.kind==='exploration'?0:status === 'fulfilled' ? 0 : status === 'refused' ? 4 : 3;
      }
    } finally { process.stdout.write = stdout; }
    io.write(text); return code;
  } catch (error) {
    const code = error instanceof TypeError || error instanceof RangeError ? 2 : 1, message = error instanceof Error ? error.message : String(error);
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
    worker.on('message', (message: unknown) => {
      if (message && typeof message === 'object' && 'text' in message && typeof message.text === 'string') process.stdout.write(message.text);
    });
    const forward = (signal: NodeJS.Signals) => worker.kill(signal);
    process.on('SIGINT', forward); process.on('SIGTERM', forward);
    process.exitCode = await new Promise<number>((accept, reject) => { worker.once('error', reject); worker.once('exit', (code, signal) => accept(code ?? (signal === 'SIGINT' ? 130 : 143))); });
    process.off('SIGINT', forward); process.off('SIGTERM', forward);
  }
}
