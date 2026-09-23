#!/usr/bin/env node
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { readFile } from 'node:fs/promises';
import { sha256 } from '../../../src/platform/sha256.mts';
import { formatAnswer } from './query.mts';
import { assessRequest, type RequestSatisfaction } from './request-satisfaction.mts';
import { getSession, saveExploration, saveSession, saveFamilyRequestSession, type ExplorationSession, type Session } from './session.mts';
import { parseExplorationArguments, type ExplorationRequest } from './exploration.mts';

import { exportSpatialObject } from './spatial-handoff.mts';
import { exportOutput, validateOutputRequest, type OutputChoice, type OutputRequest } from './outputs.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';
import { projectOutput } from './projection.mts';
import { exportSphere } from './sphere/sphere.mts';
import type { DeliveryContext } from './delivery-context.mts';
import { HELP, SHORT_HELP, VERSION } from '../../../packages/telescope/src/help.mts';
import { importLocalArtifact } from './local-import.mts';
import { formatPapers, searchPapers } from './papers.mts';
import { familyCoverageLedger } from './family-handlers.mts';
import type { FamilyOperation } from './family-handlers.mts';
import { executeFamilyOperation, familyOperationNeedsParameters, type FamilyOperationParameters } from './family-operation.mts';
import { requireString } from '../../sources/source-values.mts';
import { exportWwtImage, WWT_IMAGE_MAX_LEVEL } from './wwt/wwt-image.mts';
import { acquireWwtFits } from './wwt/wwt-fits.mts';
import { fetchKeckSource } from './keck-source.mts';
import { fetchGeminiSource } from './gemini-source.mts';
import { fetchOpusSource } from './opus-source.mts';
import { fetchChandraSource } from './chandra-source.mts';
import { fetchSpitzerSource } from './spitzer-source.mts';
export { HELP, SHORT_HELP };

const queryValues = new Set(['--target', '--wavelength', '--kind', '--from', '--to', '--min-arcsec', '--min-km', '--min-elements', '--range-km', '--radius-km', '--continuum', '--accept-assumptions', '--icrs-circle', '--spectral-frame', '--max-science-bytes', '--max-metadata-bytes', '--max-link-depth', '--max-link-requests', '--max-expanded-bytes', '--max-package-members']);
export type CliOptions = {readonly command:'fetch';readonly archive:'keck'|'gemini'|'opus'|'chandra'|'spitzer';readonly exploration:string;readonly pick:number;readonly fileName?:string;readonly directory:string;readonly resume?:boolean;readonly json:boolean;readonly verbose:boolean}|{readonly command:'wwt-fits';readonly catalog:string;readonly setName:string;readonly level:number;readonly x:number;readonly y:number;readonly directory:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'wwt-image';readonly exploration:string;readonly pick:number;readonly level:number;readonly directory:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'candidates';readonly system:string;readonly epoch:string;readonly directory:string;readonly figureBackground?:'transparent'|'opaque';readonly orbitDraws?:number;readonly fitAstrometry:boolean;readonly fitOrbits:boolean;readonly json:boolean;readonly verbose:boolean}|{readonly command:'associate';readonly measurements:string;readonly system:string;readonly directory:string;readonly figureBackground?:'transparent'|'opaque';readonly orbitDraws?:number;readonly fitAstrometry:boolean;readonly fitOrbits:boolean;readonly json:boolean;readonly verbose:boolean}|{readonly command:'papers';readonly target:string;readonly instrument?:string;readonly host?:string;readonly directory?:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'family-run';readonly descriptor:string;readonly operationId:string;readonly componentId?:string;readonly parameters?:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'family-assess';readonly request:string;readonly descriptor:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'families';readonly json:boolean;readonly verbose:boolean}|{readonly command:'import';readonly specification:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'spatial';readonly kind:'points'|'volume'|'volume-lens-bank';readonly result:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'project';readonly result:string;readonly geometry:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'sphere';readonly result:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'outputs';readonly result:string;readonly structure?:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'export';readonly result:string;readonly directory:string;readonly selection:OutputRequest;readonly json:boolean;readonly verbose:boolean} | { readonly command: 'help'; readonly short?: boolean } | { readonly command: 'version' } | { readonly command: 'explore'; readonly directory?: string; readonly request: ExplorationRequest; readonly requestArgs: readonly string[]; readonly json: boolean; readonly verbose: boolean } | { readonly command: 'query'; readonly directory: string; readonly requestArgs: string[]; readonly json: boolean; readonly verbose: boolean } | { readonly command: 'get'; readonly offline?: boolean; readonly directory: string; readonly pick: number; readonly json: boolean; readonly verbose: boolean };
export function parseCli(args: readonly string[]): CliOptions {
  const command = args[0];
  if (!args.length) return { command: 'help' as const, short: true };
  if (command === 'help' || args.includes('--help') || args.includes('-h')) return { command: 'help' as const };
  if (args.length === 1 && command === '--version') return { command: 'version' as const };
  if(command==='fetch'){
    const positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();
    for(let i=1;i<args.length;i++){
      const arg=args[i]!;
      if(!arg.startsWith('-')){positional.push(arg);continue;}
      if(arg==='--json'||arg==='--verbose'||arg==='--resume'){if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);flags.add(arg);continue;}
      if(!['--pick','--out','--archive','--file'].includes(arg)||values.has(arg))throw new TypeError(`Unknown or repeated fetch option ${arg}.`);
      const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError(`Missing value for ${arg}.`);values.set(arg,value);
    }
    const pick=Number(values.get('--pick'));
    if(positional.length!==1||!values.has('--out')||!/^\d+$/u.test(values.get('--pick')??'')||!Number.isSafeInteger(pick)||pick<1)
      throw new TypeError('Use telescope fetch EXPLORE.json --pick N --out DIRECTORY.');
    const archive=values.get('--archive')??'keck';
    if(!['keck','gemini','opus','chandra','spitzer'].includes(archive))throw new TypeError('--archive must be keck, gemini, opus, chandra, or spitzer.');
    if(values.has('--file')&&!['chandra','spitzer'].includes(archive))throw new TypeError('--file applies only to Chandra or Spitzer sources.');
    if(flags.has('--resume')&&archive==='keck')throw new TypeError('Keck fetch has one file and already retries its transfer; --resume applies to Gemini, OPUS, Chandra and Spitzer.');
    return {command,archive:archive as 'keck'|'gemini'|'opus'|'chandra'|'spitzer',exploration:resolve(positional[0]!),pick,...(values.has('--file')?{fileName:values.get('--file')!}:{}),directory:resolve(values.get('--out')!),...(flags.has('--resume')?{resume:true}:{}),json:flags.has('--json'),verbose:flags.has('--verbose')};
  }
  if(command==='wwt-fits'){
    const positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();
    for(let i=1;i<args.length;i++){
      const arg=args[i]!;
      if(!arg.startsWith('-')){positional.push(arg);continue;}
      if(arg==='--json'||arg==='--verbose'){if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);flags.add(arg);continue;}
      if(!['--set','--level','--x','--y','--out'].includes(arg)||values.has(arg))throw new TypeError(`Unknown or repeated wwt-fits option ${arg}.`);
      const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError(`Missing value for ${arg}.`);values.set(arg,value);
    }
    if(positional.length!==1||['--set','--level','--x','--y','--out'].some(key=>!values.has(key)))
      throw new TypeError('Use telescope wwt-fits CATALOG.json --set NAME --level N --x X --y Y --out DIRECTORY.');
    const number=(key:string)=>{const raw=values.get(key)!;if(!/^\d+$/u.test(raw)||!Number.isSafeInteger(Number(raw)))throw new TypeError(`${key} must be a nonnegative whole number.`);return Number(raw);};
    return {command,catalog:resolve(positional[0]!),setName:values.get('--set')!,level:number('--level'),x:number('--x'),y:number('--y'),directory:resolve(values.get('--out')!),json:flags.has('--json'),verbose:flags.has('--verbose')};
  }
  if(command==='wwt-image'){
    const positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();
    for(let i=1;i<args.length;i++){
      const arg=args[i]!;
      if(!arg.startsWith('-')){positional.push(arg);continue;}
      if(arg==='--json'||arg==='--verbose'){
        if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);
        flags.add(arg);continue;
      }
      if(!['--pick','--level','--out'].includes(arg)||values.has(arg))throw new TypeError(`Unknown or repeated wwt-image option ${arg}.`);
      const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError(`Missing value for ${arg}.`);
      values.set(arg,value);
    }
    if(positional.length!==1||!values.has('--pick')||!values.has('--level')||!values.has('--out'))
      throw new TypeError('Use telescope wwt-image EXPLORE.json --pick N --level 0..3 --out DIRECTORY.');
    const pick=Number(values.get('--pick')),level=Number(values.get('--level'));
    if(!Number.isSafeInteger(pick)||pick<1||!Number.isSafeInteger(level)||level<0||level>WWT_IMAGE_MAX_LEVEL)
      throw new TypeError(`WWT --pick must be positive and --level must be 0..${WWT_IMAGE_MAX_LEVEL}.`);
    return {command,exploration:resolve(positional[0]!),pick,level,directory:resolve(values.get('--out')!),json:flags.has('--json'),verbose:flags.has('--verbose')};
  }
  if(command==='family-run'){
    const positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();
    for(let i=1;i<args.length;i++){
      const arg=args[i]!;
      if(!arg.startsWith('-')){positional.push(arg);continue;}
      if(arg==='--json'||arg==='--verbose'){
        if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);
        flags.add(arg);continue;
      }
      if(!['--params','--component','--out'].includes(arg)||values.has(arg))throw new TypeError(`Unknown or repeated family-run option ${arg}.`);
      const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError(`Missing value for ${arg}.`);
      values.set(arg,value);
    }
    if(positional.length!==2||!values.has('--out'))throw new TypeError('Use telescope family-run DESCRIPTOR.json OPERATION [--component ID] [--params PARAMS.json] --out DIRECTORY.');
    return{command,descriptor:resolve(positional[0]!),operationId:positional[1]!,...(values.has('--component')?{componentId:values.get('--component')!}:{}),...(values.has('--params')?{parameters:resolve(values.get('--params')!)}:{}),directory:resolve(values.get('--out')!),json:flags.has('--json'),verbose:flags.has('--verbose')};
  }
  if(command==='family-assess'){const positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();for(let i=1;i<args.length;i++){const arg=args[i]!;if(!arg.startsWith('-')){positional.push(arg);continue;}if(arg==='--json'||arg==='--verbose'){if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);flags.add(arg);continue;}if(arg!=='--out'||values.has(arg))throw new TypeError('Use telescope family-assess REQUEST.json DESCRIPTOR.json --out DIRECTORY.');const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError('Missing value for --out.');values.set(arg,value);}if(positional.length!==2||!values.has('--out'))throw new TypeError('Use telescope family-assess REQUEST.json DESCRIPTOR.json --out DIRECTORY.');return{command,request:resolve(positional[0]!),descriptor:resolve(positional[1]!),directory:resolve(values.get('--out')!),json:flags.has('--json'),verbose:flags.has('--verbose')};}
  if(command==='papers'){
    const positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();
    for(let i=1;i<args.length;i++){
      const arg=args[i]!;
      if(!arg.startsWith('-')){positional.push(arg);continue;}
      if(arg==='--json'||arg==='--verbose'){if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);flags.add(arg);continue;}
      if(!['--instrument','--host','--out'].includes(arg)||values.has(arg))throw new TypeError(`Unknown or repeated papers option ${arg}.`);
      const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError(`Missing value for ${arg}.`);values.set(arg,value);
    }
    if(positional.length!==1)throw new TypeError('Use telescope papers OBJECT [--instrument NAME] [--host NAME] [--json] [--out DIRECTORY].');
    const instrument=values.get('--instrument'),host=values.get('--host'),directory=values.get('--out');
    return {command,target:positional[0]!,...(instrument?{instrument}:{}),...(host?{host}:{}),...(directory?{directory:resolve(directory)}:{}),json:flags.has('--json'),verbose:flags.has('--verbose')};
  }
  if(command==='candidates'||command==='associate'){
    const positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();
    for(let i=1;i<args.length;i++){
      const arg=args[i]!;
      if(!arg.startsWith('-')){positional.push(arg);continue;}
      if(arg==='--json'||arg==='--verbose'||arg==='--fit-astrometry'||arg==='--fit-orbits'){if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);flags.add(arg);continue;}
      const allowed=command==='candidates'?['--epoch','--out','--figure-background','--orbit-draws']:['--system','--out','--figure-background','--orbit-draws'];
      if(!allowed.includes(arg)||values.has(arg))throw new TypeError(`Unknown or repeated ${command} option ${arg}.`);
      const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError(`Missing value for ${arg}.`);values.set(arg,value);
    }
    const directory=values.get('--out'),background=values.get('--figure-background');
    if(background!==undefined&&background!=='transparent'&&background!=='opaque')throw new TypeError('--figure-background takes transparent or opaque');
    const draws=values.get('--orbit-draws');if(draws!==undefined&&!/^\d+$/u.test(draws))throw new TypeError('--orbit-draws takes a whole number of posterior draws');
    const common={directory:resolve(directory??''),...(background?{figureBackground:background as 'transparent'|'opaque'}:{}),...(draws?{orbitDraws:Number(draws)}:{}),fitAstrometry:flags.has('--fit-astrometry'),fitOrbits:flags.has('--fit-orbits'),json:flags.has('--json'),verbose:flags.has('--verbose')};
    if(command==='candidates'){const epoch=values.get('--epoch');if(positional.length!==1||!epoch||!directory)throw new TypeError('Use telescope candidates STAR --epoch MJD|DATE --out DIRECTORY.');return{command,system:positional[0]!,epoch,...common};}
    const system=values.get('--system');if(positional.length!==1||!system||!directory)throw new TypeError('Use telescope associate MEASUREMENTS.csv --system STAR --out DIRECTORY.');return{command,measurements:resolve(positional[0]!),system,...common};
  }
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
      if(!(command==='outputs'?['--structure']:command==='project'?['--geometry','--out']:['--output','--hdu','--structure','--plane','--pixel','--out','--band','--aperture','--background','--continuum','--uncertainty','--geometry','--figure-background']).includes(arg)||values.has(arg))throw new TypeError(`Unknown or repeated ${command} option ${arg}`);
      const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError(`Missing value for ${arg}`);values.set(arg,value);
    }
    if(positional.length!==1)throw new TypeError(`Use telescope ${command} ARTIFACT_JSON`);
    const common={result:resolve(positional[0]),json:flags.has('--json'),verbose:flags.has('--verbose')};
    if(command==='outputs')return {command,...common,...(values.has('--structure')?{structure:values.get('--structure')!}:{})};
    if(command==='project'){const geometry=values.get('--geometry'),directory=values.get('--out');if(!geometry||!directory)throw new TypeError('project requires --geometry FILE and --out DIRECTORY');return {command,...common,geometry:resolve(geometry),directory:resolve(directory)};}
    const kind=values.get('--output');if(kind==='points'||kind==='volume'||kind==='volume-lens-bank'){if([...values.keys()].some(k=>!['--output','--out'].includes(k))||!values.get('--out'))throw new TypeError('Spatial handoff takes only --output points|volume|volume-lens-bank and --out DIRECTORY');return {command:'spatial',kind,...common,directory:resolve(values.get('--out')!)};}if(kind==='sphere'){if([...values.keys()].some(k=>!['--output','--out'].includes(k))||!values.get('--out'))throw new TypeError('Sphere takes only --output sphere and --out DIRECTORY');return {command:'sphere',...common,directory:resolve(values.get('--out')!)};}if(kind==='body-map'){if([...values.keys()].some(k=>!['--output','--geometry','--out'].includes(k))||!values.get('--geometry')||!values.get('--out'))throw new TypeError('Body map export takes --output body-map --geometry FILE and --out DIRECTORY');return {command:'project',...common,geometry:resolve(values.get('--geometry')!),directory:resolve(values.get('--out')!)};}if(kind!=='image'&&kind!=='spectrum'&&kind!=='band-image'&&kind!=='aperture-spectrum'&&kind!=='feature-map')throw new TypeError('--output takes image, spectrum, band-image, aperture-spectrum, feature-map, body-map, sphere, points, volume or volume-lens-bank');
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
      ...(values.has('--continuum')?{continuum:numbers('--continuum')}:{}),...(uncertainty?{uncertainty}:{}),...(values.has('--figure-background')?{figureBackground:values.get('--figure-background') as OutputRequest['figureBackground']}:{})};
    validateOutputRequest(selection);
    return {command,...common,directory:resolve(directory),selection};
  }
  if (command !== 'query' && command !== 'get') throw new TypeError('Unknown telescope command. Use telescope --help to list commands.');
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
const briefDiagnostic=(value:string)=>value.length<=280?value:`${value.slice(0,279).trimEnd()}… (full reason in saved result)`;
export function formatSession(session: Session, directory: string,verbose=false): string {
  const answer=session.answer,lines = [`${session.target} · ${answer.request.kind} · ${answer.request.wavelengthMicrometres.join('–')} µm`, ''];
  const append=(heading:string,rows:readonly string[],total=rows.length)=>{
    if(!rows.length)return;
    lines.push('',`${heading} (${total}):`);
    for(const row of verbose?rows:rows.slice(0,5))lines.push(`  ${verbose?row:briefDiagnostic(row)}`);
    if(!verbose&&rows.length>5)lines.push(`  ${rows.length-5} more in the saved result.`);
  };
  if(answer.endpoint.coverage==='incomplete')lines.push('Search coverage is incomplete; provider or indexed-source results below cannot establish a negative.');
  for (const choice of session.choices) {
    const verdict = choice.product ? assessRequest(answer.request, choice.product.facts) : undefined;
    lines.push(`${choice.pick}. ${choice.telescope} / ${choice.mode} / ${choice.observation}`,
      `   ${choice.state === 'ready' ? 'Data qualified' : 'Qualification required'}${verdict ? `; request ${verdict.status}` : ''}`);
    if (verdict) for (const [name, v] of Object.entries(verdict.constraints)) if (v.answer !== 'yes') lines.push(`   ${name}: ${v.answer}. ${v.reason}`);
  }
  if (!session.choices.length) {
    lines.push(`No retrievable observation. Workflow: ${answer.endpoint.status}.`);
    if (answer.targetResolution.status !== 'resolved') lines.push(formatAnswer(answer).trim());
  }
  const services=[...answer.archiveAccess?.services??[]].sort((a,b)=>(a.state==='unavailable'||a.state==='overflow'?0:1)-(b.state==='unavailable'||b.state==='overflow'?0:1));
  const providerRows=verbose?services.map(service=>`${service.service}: ${service.state}. ${service.reason}`):(()=>{
    const groups=new Map<string,{state:string;reason:string;names:string[]}>();
    for(const service of services){const key=`${service.state}\u0000${service.reason}`,group=groups.get(key);if(group)group.names.push(service.service);else groups.set(key,{state:service.state,reason:service.reason,names:[service.service]});}
    return [...groups.values()].map(group=>group.names.length===1?`${group.names[0]}: ${group.state}. ${group.reason}`:`${group.names.length} providers ${group.state}: ${group.reason} (${group.names.join(', ')})`);
  })();
  append('Provider status',providerRows,services.length);
  append('Indexed coverage',answer.targetCoverage.filter(coverage=>coverage.state!=='observed').map(coverage=>`${coverage.telescope}: ${coverage.state}. ${coverage.reason}`));
  append('Source intake',answer.sourceIntakeIssues?.map(issue=>`${issue.state}: ${issue.path}. ${issue.reason}`)??[]);
  if(!session.choices.length)append('Candidate mode blockers',answer.candidates.map(candidate=>`${candidate.telescope} / ${candidate.mode}: ${candidate.selectionAssessment.blockers.map(blocker=>blocker.reason).join('; ')||'No exact qualified artifact or executable qualification action.'}`));
  append('Unselectable archive records',answer.archiveAccess?.records.filter(record=>!record.products.length).map(record=>`${record.observation.key}: ${record.observation.target.status}. ${record.issues.join('; ')}`)??[]);
  lines.push('', `Saved: ${displayPath(resolve(directory, 'query.json'))}`);
  if (session.choices.length) lines.push(`Next: telescope get ${shellWord(displayPath(directory))} --pick N`);
  else if(answer.endpoint.coverage==='incomplete')lines.push('Resolve the provider or source errors, or narrow the request; then save a new query in a new directory.');
  return `${lines.join('\n')}\n`;
}

const shellWord = (value:string):string => /^[A-Za-z0-9_./,:@+%=-]+$/u.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
const displayPath = (path:string):string => {
  const local=relative(process.cwd(),resolve(path));
  return local&&!isAbsolute(local)&&local!=='..'&&!local.startsWith(`..${sep}`)?local:path;
};
const displayTime = (start:string|null,end:string|null):string => start === null ? 'date unknown' : end && end !== start ? `${start} to ${end}` : start;
function displayWavelengths(value:readonly (number|null)[]|readonly (readonly [number,number])[]):string {
  if(!value.length)return 'wavelength unknown';
  const ranges = Array.isArray(value[0]) ? value as readonly (readonly [number,number])[] : [value as readonly [number|null,number|null]];
  return ranges.map(range=>range[0]===null||range[1]===null?'unknown':`${range[0]}–${range[1]} µm`).join(', ');
}
export function formatExploration(session:ExplorationSession & {readonly directory:string},verbose=false):string {
  const answer=session.answer,resolution=answer.targetResolution;
  const title=resolution.status==='resolved'?resolution.canonical.name:answer.target;
  const lines=[title,''];
  if(answer.outcome.coverage==='target-unresolved')lines.push('Target unresolved; no archive search was run.');
  else if(answer.outcome.selection==='available')lines.push(`${session.choices.length} retrievable choice(s) in this bounded search.${answer.outcome.coverage==='incomplete'?' Search coverage is incomplete.':''}`);
  else if(answer.outcome.coverage==='incomplete')lines.push('Search incomplete; no retrievable observation was confirmed. Check the search limits and unresolved discoveries below.');
  else if(answer.unsupported.length)lines.push(`No retrievable observation in this configured, bounded search; ${answer.unsupported.length} discovery record(s) lack a supported route or do not match the filters.`);
  else lines.push('No retrievable observation in this configured, bounded search. This does not establish that no observation exists.');
  for(const choice of session.choices){
    const d=choice.display,size=d.advertisedKilobytes===null?'size unknown':`${d.advertisedKilobytes} kB advertised`;
    const instrument = d.instrument === choice.telescope || d.instrument.startsWith(`${choice.telescope} / `)
      ? d.instrument : `${choice.telescope} / ${d.instrument}`;
    lines.push(`${choice.pick}. ${instrument} · ${displayTime(d.observationTime.startIso,d.observationTime.endIso)} · ${d.productKind??'product kind unknown'}`,
      `   ${choice.state==='ready'?'Qualified product available':'Retrieval and qualification available'} · ${size} · ${d.metadataBasis} metadata`,
      `   ${displayWavelengths(d.wavelengthsMicrometres)}`,
      `   ${choice.reason}`);
    const limitations=[...new Set(choice.limitations)];
    for(const limitation of verbose?limitations:limitations.slice(0,3))lines.push(`   Limitation: ${limitation}`);
    if(!verbose&&limitations.length>3)lines.push(`   ${limitations.length-3} more distinct limitation(s) in the saved result.`);
  }
  for(const service of answer.services)if('sharpest' in service&&service.sharpest?.length){
    lines.push('',`Spacecraft images in OPUS (${service.images} of ${service.opusTarget}; sharpest per instrument):`);
    for(const [index,image] of service.sharpest.entries())lines.push(`  OPUS ${index+1}. ${image.instrument} · ${image.startTime} · ${image.centreResolutionKmPerPixel??'unknown'} km/px at body centre${image.pixelsAcross===null?'':` · ${image.pixelsAcross} px across`} · ${image.instrumentImages} images · ${image.opusId}`);
    lines.push(`  Fetch native image and label: telescope fetch ${shellWord(displayPath(resolve(session.directory,'explore.json')))} --archive opus --pick N --out DIRECTORY`);
  }
  for(const service of answer.services)if('instruments' in service&&(service.instruments.length||service.sources?.length)){
    lines.push('',`Live archive leads (${service.service}; ${service.scope}):`);
    for(const lead of service.instruments)lines.push(`  ${lead.telescope} / ${lead.instrument} · ${lead.records} record(s) · example ${lead.sample}`);
    if(service.sources?.length){
      const archive='koaid' in service.sources[0]!?'keck':'uri' in service.sources[0]!?'gemini':'obsid' in service.sources[0]!?'chandra':'spitzer';
      const archiveLabel=archive[0]!.toUpperCase()+archive.slice(1);
      lines.push(`  ${service.sources.length} ${archiveLabel} source choice(s) sampled:`);
      for(const [index,source] of (verbose?service.sources:service.sources.slice(0,8)).entries()){
        const identity='koaid' in source?source.koaid:'uri' in source?source.name:'obsid' in source?String(source.obsid):String(source.aorKey);
        lines.push(`  ${archiveLabel} ${index+1}. ${source.instrument} · ${identity} · archive name ${source.targetName}`);
      }
      if(!verbose&&service.sources.length>8)lines.push(`  ${service.sources.length-8} more source lead(s) in the saved result.`);
      lines.push(`  Fetch source: telescope fetch ${shellWord(displayPath(resolve(session.directory,'explore.json')))} --archive ${archive} --pick N --out DIRECTORY`);
      lines.push('  Native source bytes only; target association and calibration remain unresolved.');
    }else lines.push('  Discovery only; no exact acquisition or qualification route is implied.');
  }
  const wwt=answer.curatedImagery;
  if(wwt?.state==='indexed'&&wwt.total){
    lines.push('',`WWT curated imagery (${wwt.total} title/frame match${wwt.total===1?'':'es'}; pinned catalog ${wwt.revision.slice(0,12)}):`);
    const displayed=verbose?wwt.matches:wwt.matches.slice(0,5);
    const catalogText=(value:string)=>value.replace(/[\p{Cc}\p{Cf}]+/gu,' ').replace(/\s+/gu,' ').trim();
    for(const [index,image] of displayed.entries()){
      lines.push(`  WWT ${index+1}. ${briefDiagnostic(catalogText(image.name))} · ${catalogText(image.bandPass)} · ${catalogText(image.projection)} · ${image.matchBasis} match`,
        `    Credit: ${briefDiagnostic(catalogText(image.credits))||'not supplied by WWT'} · ${image.catalogUrl}`);
      if(verbose&&image.dataSetType==='Sky')lines.push(`    WWT projection origin: RA ${image.position.centerXDegrees}°, Dec ${image.position.centerYDegrees}° (not a verified footprint)`);
    }
    if(wwt.matches.length>displayed.length)lines.push(`  ${wwt.matches.length-displayed.length} more match(es) in the saved result.`);
    if(wwt.total>wwt.matches.length)lines.push(`  ${wwt.total-wwt.matches.length} additional match(es) omitted by the ${wwt.limit}-entry cap.`);
    lines.push(`  Static image: telescope wwt-image ${shellWord(displayPath(resolve(session.directory,'explore.json')))} --pick N --level 0..3 --out DIRECTORY`);
    lines.push('  Display imagery only; these are not selectable observations or qualified science products.');
  }else if(wwt?.state==='unavailable')lines.push('',`WWT curated imagery unavailable: ${wwt.reason}`);
  const appendIssues=(heading:string,issues:readonly {readonly identity?:string;readonly scope:string;readonly reason:string}[],total=issues.length)=>{
    if(!issues.length)return;
    lines.push('',`${heading} (${total}):`);
    for(const issue of verbose?issues:issues.slice(0,5)){
      const row=`${issue.identity??issue.scope}: ${issue.reason}`;
      lines.push(`  ${verbose?row:briefDiagnostic(row)}`);
    }
    if(!verbose&&issues.length>5)lines.push(`  ${issues.length-5} more in the saved result.`);
  };
  const statusIssues=verbose?answer.issues:(()=>{
    const groups=new Map<string,{issue:(typeof answer.issues)[number];identities:string[]}>();
    for(const issue of answer.issues){
      const key=issue.scope==='provider'?`${issue.code}\u0000${issue.reason}`:`${issue.code}\u0000${issue.identity??''}\u0000${issue.reason}`;
      const group=groups.get(key);
      if(group)group.identities.push(issue.identity??issue.scope);
      else groups.set(key,{issue,identities:[issue.identity??issue.scope]});
    }
    return [...groups.values()].map(({issue,identities})=>identities.length===1?issue:{...issue,identity:`${identities.length} providers (${identities.join(', ')})`});
  })();
  appendIssues('Search limits and provider status',statusIssues,answer.issues.length);
  appendIssues('Unresolved discoveries',answer.unresolved);
  appendIssues('Unsupported discoveries',answer.unsupported);
  lines.push('',`Saved: ${displayPath(resolve(session.directory,'explore.json'))}`);
  if(session.choices.length)lines.push(`Continue explicitly: telescope get ${shellWord(displayPath(session.directory))} --pick N`);
  if(answer.outcome.coverage==='incomplete'){
    const blocked=answer.issues.some(issue=>issue.code==='provider-unavailable'||issue.code==='provider-overflow'||issue.code==='source-unavailable');
    lines.push(blocked?'Resolve the provider or source errors above, or narrow the search; then start a new exploration.':'Inspect unresolved metadata or adjust the filters; then start a new exploration.');
    lines.push(`Retry in a new directory: ${['telescope','explore',...session.arguments,'--out','NEW_DIRECTORY'].map(shellWord).join(' ')}`);
  }else if(answer.outcome.coverage==='target-unresolved')lines.push('Check the target name or use a suggestion above, then start a new exploration.');
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
const artifactScreen=(result:InspectedArtifact,_path:string):ArtifactInspection=>({artifact:result.artifact,...(typeof result.target==='string'?{target:result.target}:{}),source:resolve(requireString(result.source,'artifact source')),...(result.sourceContext?{sourceContext:result.sourceContext}:{}),outputs:result.outputs,...(result.terminal?{terminal:true}:{}),...(result.profiles?{profiles:result.profiles}:{}),...(result.issues?{issues:result.issues}:{}),...(result.familyOperations?{familyOperations:result.familyOperations}:{})});
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
export function formatArtifact(result:ArtifactInspection,verbose=false):string {
  const lines=[`${result.target??'Artifact'} · ${result.artifact}`,`Source: ${displayPath(result.source)}`];
  const context=contextText(result.sourceContext);if(context)lines.push(context);
  if(result.profiles?.length)lines.push(`Proposed profiles: ${result.profiles.map(profile=>`${profile.handlerId}/${profile.profileId}`).join(', ')}.`);
  for(const issue of result.issues??[])lines.push(`Limitation: ${issue}`);
  if(result.outputs.length){
    lines.push('','Supported next operations:');
    result.outputs.forEach((choice,index)=>{
      const identity=[choice.kind,choice.hdu===undefined?undefined:`HDU ${choice.hdu}`,choice.structure,choice.shape?`shape ${choice.shape.join('×')}`:undefined].filter(Boolean).join(' · ');
      lines.push(`${index+1}. ${identity}: ${choice.available?'available':'unavailable'}.`,`   ${choice.reason}`);
      if(choice.unit)lines.push(`   Unit: ${choice.unit.value} (${choice.unit.source})`);
      if(choice.spectral?.centersMicrometres.length)lines.push(`   Wavelength coordinates: ${choice.spectral.centersMicrometres[0]}–${choice.spectral.centersMicrometres.at(-1)} µm (${choice.spectral.centersMicrometres.length} samples)`);
      for(const limitation of choice.limitations??[])lines.push(`   Limitation: ${limitation}`);
      if(choice.available)lines.push(`   Next: ${outputCommand(displayPath(result.source),choice)}`);
    });
  }
  if(result.familyOperations?.length){
    lines.push('','Family operations:');
    result.familyOperations.forEach((operation,index)=>{
      const required=operation.parameters.filter(parameter=>parameter.id!=='out'&&parameter.required);
      lines.push(`${result.outputs.length+index+1}. ${operation.id} · ${operation.componentId}: ${operation.available?'available':'unavailable'}.`, `   ${operation.reason}`);
      if(required.length)lines.push(`   Required parameters: ${required.map(parameter=>parameter.description).join(' ')}`);
      if(verbose)lines.push(`   Owner: ${operation.owner.module}#${operation.owner.export}`);
      for(const limitation of operation.limitations)lines.push(`   Limitation: ${limitation}`);
      if(operation.available)lines.push(`   Next: ${['telescope','family-run',displayPath(result.source),operation.id,'--component',operation.componentId,...(required.length?['--params','PARAMS.json']:[]),'--out','DIRECTORY'].map(shellWord).join(' ')}`);
    });
  }
  if(!result.outputs.length&&!result.familyOperations?.length)lines.push('No further supported outputs. This artifact is terminal.');
  return `${lines.join('\n')}\n`;
}

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
  readonly exportSphere:typeof exportSphere;
  readonly exportSpatialObject:typeof exportSpatialObject;
  readonly executeFamilyOperation:typeof executeFamilyOperation;
}
const defaultServices:CliServices={importLocalArtifact,familyCoverageLedger,saveExploration,getSession,listArtifactOutputs,exportOutput,projectOutput,exportSphere,exportSpatialObject,executeFamilyOperation};
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

export async function main(args: readonly string[], root = resolve(import.meta.dirname, '../../..'), output: (text: string) => void = text => { process.stdout.write(text); }, injectedIo?:CliIo,api:CliServices=defaultServices): Promise<number> {
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
        const result=await acquireWwtFits(options.catalog,options.setName,options.level,options.x,options.y,options.directory);
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
        const saved=await saveFamilyRequestSession(options.directory,request,descriptor,{path:descriptorPath,bytes:bytes.length,sha256:sha256(bytes)});
        text=options.json?`${JSON.stringify(saved)}\n`:`Descriptor compatibility: ${saved.status}\nDescriptor: ${displayPath(descriptorPath)}\nSaved: ${resolve(options.directory,'family-request.json')}\n`;
        code=saved.status==='matched'?0:saved.status==='refused'?4:3;
      }else if(options.command==='papers'){
        const result=await searchPapers(root,{target:options.target,...(options.instrument?{instrument:options.instrument}:{}),...(options.host?{host:options.host}:{}),...(options.directory?{directory:options.directory}:{}),progress:line=>io.error(`${line}\n`)});
        text=options.json?`${JSON.stringify(result)}\n`:formatPapers(result,options.directory);code=result.works.length?0:3;
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
