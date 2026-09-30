/** The telescope command line: every command's arguments, parsed and checked before anything runs. */
import { resolve } from 'node:path';
import { parseExplorationArguments, type ExplorationRequest } from './exploration.mts';
import { validateOutputRequest, type OutputRequest } from './outputs.mts';
import { WWT_IMAGE_MAX_LEVEL } from './wwt/wwt-image.mts';

const queryValues = new Set(['--target', '--wavelength', '--kind', '--from', '--to', '--min-arcsec', '--min-km', '--min-elements', '--range-km', '--radius-km', '--continuum', '--accept-assumptions', '--icrs-circle', '--spectral-frame', '--max-science-bytes', '--max-metadata-bytes', '--max-link-depth', '--max-link-requests', '--max-expanded-bytes', '--max-package-members']);
export type CliOptions = {readonly command:'ascl';readonly query?:string;readonly product?:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'fetch';readonly archive:'keck'|'gemini'|'opus'|'chandra'|'spitzer';readonly exploration:string;readonly pick:number;readonly fileName?:string;readonly directory:string;readonly resume?:boolean;readonly json:boolean;readonly verbose:boolean}|{readonly command:'wwt-fits';readonly catalog?:string;readonly exploration?:string;readonly setName?:string;readonly pick?:number;readonly level:number;readonly x:number;readonly y:number;readonly directory:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'wwt-image';readonly exploration:string;readonly pick:number;readonly level:number;readonly directory:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'candidates';readonly system:string;readonly epoch:string;readonly directory:string;readonly figureBackground?:'transparent'|'opaque';readonly orbitDraws?:number;readonly fitAstrometry:boolean;readonly fitOrbits:boolean;readonly json:boolean;readonly verbose:boolean}|{readonly command:'associate';readonly measurements:string;readonly system:string;readonly directory:string;readonly figureBackground?:'transparent'|'opaque';readonly orbitDraws?:number;readonly fitAstrometry:boolean;readonly fitOrbits:boolean;readonly json:boolean;readonly verbose:boolean}|{readonly command:'new-object';readonly spec?:string;readonly ids?:readonly string[];readonly from?:string;readonly names?:readonly string[];readonly out?:string;readonly check:boolean;readonly bake:boolean;readonly refresh:boolean;readonly skipExisting:boolean;readonly json:boolean;readonly verbose:boolean}|{readonly command:'papers';readonly target:string;readonly instrument?:string;readonly host?:string;readonly directory?:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'family-run';readonly descriptor:string;readonly operationId:string;readonly componentId?:string;readonly parameters?:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'family-assess';readonly request:string;readonly descriptor:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean}|{readonly command:'families';readonly json:boolean;readonly verbose:boolean}|{readonly command:'import';readonly specification:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'spatial';readonly kind:'points'|'volume'|'volume-dataset-bank';readonly result:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'project';readonly result:string;readonly geometry:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'sphere';readonly result:string;readonly directory:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'outputs';readonly result:string;readonly structure?:string;readonly json:boolean;readonly verbose:boolean} | {readonly command:'export';readonly result:string;readonly directory:string;readonly selection:OutputRequest;readonly json:boolean;readonly verbose:boolean} | { readonly command: 'help'; readonly short?: boolean } | { readonly command: 'version' } | { readonly command: 'explore'; readonly directory?: string; readonly request: ExplorationRequest; readonly requestArgs: readonly string[]; readonly json: boolean; readonly verbose: boolean } | { readonly command: 'query'; readonly directory: string; readonly requestArgs: string[]; readonly json: boolean; readonly verbose: boolean } | { readonly command: 'get'; readonly offline?: boolean; readonly directory: string; readonly pick: number; readonly json: boolean; readonly verbose: boolean };
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
      if(!['--set','--pick','--level','--x','--y','--out'].includes(arg)||values.has(arg))throw new TypeError(`Unknown or repeated wwt-fits option ${arg}.`);
      const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError(`Missing value for ${arg}.`);values.set(arg,value);
    }
    if(positional.length!==1||['--level','--x','--y','--out'].some(key=>!values.has(key))||values.has('--set')===values.has('--pick'))
      throw new TypeError('Use telescope wwt-fits CATALOG.json --set NAME or EXPLORE.json --pick N, then --level N --x X --y Y --out DIRECTORY.');
    const number=(key:string)=>{const raw=values.get(key)!;if(!/^\d+$/u.test(raw)||!Number.isSafeInteger(Number(raw)))throw new TypeError(`${key} must be a nonnegative whole number.`);return Number(raw);};
    const pick=values.has('--pick')?number('--pick'):undefined;if(pick===0)throw new TypeError('WWT FITS --pick must be positive.');
    return {command,...(pick?{exploration:resolve(positional[0]!),pick}:{catalog:resolve(positional[0]!),setName:values.get('--set')!}),level:number('--level'),x:number('--x'),y:number('--y'),directory:resolve(values.get('--out')!),json:flags.has('--json'),verbose:flags.has('--verbose')};
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
  if(command==='ascl'){
    const positional:string[]=[],flags=new Set<string>();let product:string|undefined;
    for(let i=1;i<args.length;i++){
      const arg=args[i]!;
      if(arg==='--json'||arg==='--verbose'){if(flags.has(arg))throw new TypeError(`Repeated option ${arg}.`);flags.add(arg);continue;}
      if(arg==='--product'&&!product){const value=args[++i];if(!value||value.startsWith('--'))throw new TypeError('Missing value for --product.');product=resolve(value);continue;}
      if(arg.startsWith('-'))throw new TypeError(`Unknown ASCL option ${arg}.`);
      positional.push(arg);
    }
    if(product?positional.length!==0:positional.length!==1)throw new TypeError('Use telescope ascl QUERY or telescope ascl --product PRODUCT.json [--json].');
    return {command,...(product?{product}:{query:positional[0]!}),json:flags.has('--json'),verbose:flags.has('--verbose')};
  }
  if(command==='new-object'){
    // `--from-<route> NAME...` drafts a spec from an archive or catalogue; the workspace's drafts.mts names the routes.
    const rest=args.slice(1),fromAt=rest.findIndex(arg=>/^--from-[a-z0-9]+$/u.test(arg)),outAt=rest.indexOf('--out'),out=outAt>=0?rest[outAt+1]:undefined;
    const flags=rest.filter((arg,i)=>arg.startsWith('-')&&i!==fromAt&&arg!=='--out'),unknown=flags.filter(flag=>!['--json','--verbose','--check','--skip-existing','--bake','--refresh'].includes(flag));
    if(unknown.length)throw new TypeError(`Unknown new-object option ${unknown[0]}.`);
    const common={check:flags.includes('--check'),bake:flags.includes('--bake'),refresh:flags.includes('--refresh'),skipExisting:flags.includes('--skip-existing'),json:flags.includes('--json'),verbose:flags.includes('--verbose')};
    if(fromAt>=0){
      const from=rest[fromAt]!.slice('--from-'.length),names=rest.slice(fromAt+1).filter((arg,i,list)=>!arg.startsWith('-')&&list[i-1]!=='--out');
      if(!names.length||!out)throw new TypeError(`Use telescope new-object --from-${from} NAME... --out SPEC.json [--json].`);
      return {command,from,names,out:resolve(out),...common};
    }
    const positional=rest.filter((arg,i,list)=>!arg.startsWith('-')&&list[i-1]!=='--out');
    // `--bake ID...` bakes objects already in the tree; `SPEC.json --bake` generates, then bakes.
    if(common.refresh){if(!positional.length||positional.some(arg=>arg.endsWith('.json')))throw new TypeError('Use telescope new-object --refresh ID... [--check | --bake].');return {command,ids:positional,...common};}
    if(common.bake&&positional.length&&!positional.every(arg=>arg.endsWith('.json')))return {command,ids:positional,...common};
    if(positional.length!==1)throw new TypeError('Use telescope new-object SPEC.json [--check | --bake] [--skip-existing] [--json], --bake ID..., or --from-<route> NAME... --out SPEC.json.');
    return {command,spec:resolve(positional[0]!),...common};
  }
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
    const kind=values.get('--output');if(kind==='points'||kind==='volume'||kind==='volume-dataset-bank'){if([...values.keys()].some(k=>!['--output','--out'].includes(k))||!values.get('--out'))throw new TypeError('Spatial handoff takes only --output points|volume|volume-dataset-bank and --out DIRECTORY');return {command:'spatial',kind,...common,directory:resolve(values.get('--out')!)};}if(kind==='sphere'){if([...values.keys()].some(k=>!['--output','--out'].includes(k))||!values.get('--out'))throw new TypeError('Sphere takes only --output sphere and --out DIRECTORY');return {command:'sphere',...common,directory:resolve(values.get('--out')!)};}if(kind==='body-map'){if([...values.keys()].some(k=>!['--output','--geometry','--out'].includes(k))||!values.get('--geometry')||!values.get('--out'))throw new TypeError('Body map export takes --output body-map --geometry FILE and --out DIRECTORY');return {command:'project',...common,geometry:resolve(values.get('--geometry')!),directory:resolve(values.get('--out')!)};}if(kind!=='image'&&kind!=='spectrum'&&kind!=='band-image'&&kind!=='aperture-spectrum'&&kind!=='feature-map')throw new TypeError('--output takes image, spectrum, band-image, aperture-spectrum, feature-map, body-map, sphere, points, volume or volume-dataset-bank');
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
