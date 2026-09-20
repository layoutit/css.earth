#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import { formatAnswer } from './query.mts';
import { assessRequest } from './request-satisfaction.mts';
import { getSession, saveSession, type Session } from './session.mts';

import { exportSpatialObject } from './spatial-handoff.mts';
import { exportOutput, validateOutputRequest, type OutputRequest } from './outputs.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';
import { projectOutput } from './projection.mts';
import { exportSphere } from './sphere.mts';
import { HELP } from '../../../packages/telescope/src/help.mts';
export { HELP };

const queryValues = new Set(['--target', '--wavelength', '--kind', '--from', '--to', '--min-arcsec', '--min-km', '--min-elements', '--range-km', '--radius-km', '--continuum', '--accept-assumptions', '--icrs-circle', '--spectral-frame', '--max-science-bytes', '--max-metadata-bytes', '--max-link-depth', '--max-link-requests', '--max-expanded-bytes', '--max-package-members']);
export type CliOptions = {readonly command:'spatial';readonly kind:'points'|'volume';readonly result:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'project';readonly result:string;readonly geometry:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'sphere';readonly result:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'outputs';readonly result:string;readonly structure?:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'export';readonly result:string;readonly directory:string;readonly selection:OutputRequest;readonly json:boolean;readonly verbose:boolean} | { readonly command: 'help' } | { readonly command: 'query'; readonly directory: string; readonly requestArgs: string[]; readonly json: boolean; readonly verbose: boolean } | { readonly command: 'get'; readonly offline?: boolean; readonly directory: string; readonly pick: number; readonly json: boolean; readonly verbose: boolean };
export function parseCli(args: readonly string[]): CliOptions {
  const command = args[0];
  if (!args.length || args.includes('--help') || args.includes('-h')) return { command: 'help' as const };
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
    const integer=(value:string|undefined)=>{if(value===undefined||!/^\d+$/u.test(value)||!Number.isSafeInteger(Number(value)))throw new TypeError('Selectors must be nonnegative whole numbers');return Number(value);};
    const hdu=integer(values.get('--hdu')),plane=values.has('--plane')?integer(values.get('--plane')):undefined;
    const parts=values.get('--pixel')?.split(',');if(parts&&parts.length!==2)throw new TypeError('--pixel takes X,Y');
    const pixel=parts?[integer(parts[0]),integer(parts[1])] as const:undefined;
    const directory=values.get('--out');if(!directory)throw new TypeError('export requires --out DIRECTORY');
    const numbers=(key:string)=>{const parts=values.get(key)!.split(',');if(parts.some(p=>!p.trim()||!Number.isFinite(Number(p))))throw new TypeError(`${key} requires comma-separated numbers`);return parts.map(Number);};
    const uncertainty=values.get('--uncertainty');if(uncertainty!==undefined&&uncertainty!=='omit'&&uncertainty!=='independent')throw new TypeError('--uncertainty takes omit or independent');
    const selection:OutputRequest={kind,hdu,...(values.has('--structure')?{structure:values.get('--structure')!}:{}),...(plane===undefined?{}:{plane}),...(pixel?{pixel}:{}),
      ...(values.has('--band')?{band:numbers('--band')}:{}),...(values.has('--aperture')?{aperture:numbers('--aperture')}:{}),
      ...(values.has('--background')?{background:values.get('--background')==='none'?'none':numbers('--background')}:{}),
      ...(values.has('--continuum')?{continuum:numbers('--continuum')}:{}),...(uncertainty?{uncertainty}:{})};
    validateOutputRequest(selection);
    return {command,...common,directory:resolve(directory),selection};
  }
  if (command !== 'query' && command !== 'get') throw new TypeError('Expected query, get, outputs, export or project. Use telescope --help.');
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

export async function main(args: readonly string[], root = resolve(import.meta.dirname, '../../..'), output: (text: string) => void = text => { process.stdout.write(text); }): Promise<number> {
  try {
    const options = parseCli(args);
    if (options.command === 'help') { output(HELP); return 0; }
    // Instrument tools own their logging. Keep every such message off machine-readable stdout.
    const stdout = process.stdout.write;
    let text: string, code: number;
    process.stdout.write = process.stderr.write.bind(process.stderr);
    try {
      if(options.command==='project'){
        const result=await projectOutput(options.result,options.geometry,options.directory);text=options.json?JSON.stringify(result)+'\n':`Map: ${result.map}\nFigure: ${result.figure}\nEvidence: ${result.receipt}\n`;code=0;
      }else if(options.command==='spatial'){
        const result=await exportSpatialObject(options.result,options.kind,options.directory);text=options.json?JSON.stringify(result)+'\n':`Object: ${result.object}\nEvidence: ${result.receipt}\n`;code=0;
      }else if(options.command==='sphere'){
        const result=await exportSphere(options.result,options.directory);text=options.json?JSON.stringify(result)+'\n':`Sphere: ${result.html}\nEvidence: ${result.receipt}\n`;code=0;
      }else if(options.command==='outputs'){
        const result=await listArtifactOutputs(options.result,options.structure);
        text=options.json?`${JSON.stringify(result)}\n`:result.outputs.length?result.outputs.map(o=>`${o.kind}${'hdu' in o?` HDU ${o.hdu}`:''}: ${o.available?'available':'unavailable'}. ${o.reason}`).join('\n')+'\n':`No further outputs. ${result.artifact} is terminal.\n`;code=0;
      }else if(options.command==='export'){
        const result=await exportOutput(options.result,options.selection,options.directory);
        text=options.json?`${JSON.stringify(result)}\n`:`Data: ${result.data}\nFigure: ${result.figure}\nValues: ${result.values}\nEvidence: ${result.receipt}\n`;code=0;
      }else if (options.command === 'query') {
        process.stderr.write('Querying observations…\n');
        const session = await saveSession(root, options.requestArgs, options.directory);
        text = options.json ? `${JSON.stringify(session)}\n` : formatSession(session, options.directory) + (options.verbose ? `\n${formatAnswer(session.answer)}` : '');
        code = session.choices.length ? 0 : 3;
      } else {
        const result = await getSession(root, options.directory, options.pick, line => process.stderr.write(`${line}\n`), undefined, { offline: options.offline });
        text = options.json ? `${JSON.stringify(result)}\n` : [`Product: ${result.product}`, `Evidence: ${result.resultPath}`, `Request: ${result.satisfaction.status}`,
          ...(result.reused ? ['Reused: verified existing delivery'] : []),
          ...Object.entries(result.satisfaction.constraints).filter(([, v]) => v.answer !== 'yes').map(([name, v]) => `Remaining ${name}: ${v.answer}. ${v.reason}`)].join('\n') + '\n';
        code = result.satisfaction.status === 'fulfilled' ? 0 : result.satisfaction.status === 'refused' ? 4 : 3;
      }
    } finally { process.stdout.write = stdout; }
    output(text); return code;
  } catch (error) {
    const code = error instanceof TypeError || error instanceof RangeError ? 2 : 1, message = error instanceof Error ? error.message : String(error);
    if (args.includes('--json')) output(`${JSON.stringify({ error: message, exitCode: code })}\n`);
    process.stderr.write(`${args.includes('--verbose') && error instanceof Error ? error.stack : message}\n`);
    return code;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.send) process.exitCode = await main(process.argv.slice(2), undefined, text => { process.send!({ text }); });
  else {
    // Give reducers and every inherited Python/native subprocess stderr at the descriptor level.
    // The single final response crosses IPC, so stdout remains parseable even for noisy tools.
    const worker = fork(fileURLToPath(import.meta.url), process.argv.slice(2), { stdio: ['inherit', 2, 2, 'ipc'] });
    worker.on('message', (message: unknown) => {
      if (message && typeof message === 'object' && 'text' in message && typeof message.text === 'string') process.stdout.write(message.text);
    });
    const forward = (signal: NodeJS.Signals) => worker.kill(signal);
    process.on('SIGINT', forward); process.on('SIGTERM', forward);
    process.exitCode = await new Promise<number>((accept, reject) => { worker.once('error', reject); worker.once('exit', (code, signal) => accept(code ?? (signal === 'SIGINT' ? 130 : 143))); });
    process.off('SIGINT', forward); process.off('SIGTERM', forward);
  }
}
