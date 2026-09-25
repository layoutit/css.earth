/** F14 HEALPix: Astropy reads FITS metadata; astropy-healpix owns native pixel indexing. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { astroqueryToolchain } from '@cssearth/telescope/node';
import type { FamilyHandler, FamilyOperation } from '../family-handlers.mts';
import type { DescriptorMember, ProductDescriptor } from '../product-descriptor.mts';
import { descriptor, stable } from './common.mts';
export interface HealpixPin {readonly path:string}
export interface HealpixMap {readonly nside:number;readonly ordering:'RING'|'NESTED';readonly frame:string;readonly quantity:string;readonly unit?:string;readonly semantics:'probability-mass'|'density';readonly pixelAreaSteradians:number;readonly pixels:number;readonly astropy:string;readonly astropyHealpix:string}
export interface HealpixSelect {readonly pixels:readonly number[]; readonly components?:readonly string[]}
const python=String.raw`import astropy,astropy_healpix,json,sys,numpy as np
from astropy.io import fits
r=json.load(sys.stdin); h=fits.open(r['path'],memmap=False); x=next((v for v in h if v.header.get('PIXTYPE')=='HEALPIX'),None)
if x is None: raise ValueError('Missing HEALPIX binary-table extension')
d=x.data; hd=x.header; ordering=str(hd.get('ORDERING','')).upper()
if ordering not in ('RING','NESTED'): raise ValueError('HEALPix ORDERING must be RING or NESTED')
nside=int(hd.get('NSIDE',0)); hp=astropy_healpix.HEALPix(nside=nside,order='nested' if ordering=='NESTED' else 'ring')
cols=list(d.names or []); wanted=r.get('components') or cols
if any(c not in cols for c in wanted): raise ValueError('Unknown HEALPix component')
quantity=str(hd.get('OBJECT',cols[0] if cols else 'HEALPix map')); unit=str(hd.get('TUNIT1','')) or None
column=str(hd.get('TTYPE1','')).upper(); scheme=str(hd.get('INDXSCHM','')).upper(); normalized_unit=(unit or '').replace(' ','').lower()
if scheme=='IMPLICIT' and column in ('PROB','PROBABILITY'): semantics='probability-mass'
elif 'sr' in normalized_unit and any(token in normalized_unit for token in ('/sr','sr-1','sr**-1')): semantics='density'
else: raise ValueError('Unsupported HEALPix quantity semantics; expected implicit PROB mass or explicit per-steradian density units')
if scheme!='IMPLICIT': raise ValueError('This HEALPix profile supports complete IMPLICIT indexing only')
first=int(hd.get('FIRSTPIX',0)); last=int(hd.get('LASTPIX',hp.npix-1))
if first!=0 or last!=hp.npix-1: raise ValueError('Implicit HEALPix coverage must contain every native pixel exactly once')
components={}
for c in wanted:
 values=np.asarray(d[c])
 if values.dtype.kind not in 'fiu': raise ValueError('HEALPix sky components must be numeric scalars')
 flat=values.reshape(-1)
 if flat.size!=hp.npix: raise ValueError('Packed HEALPix component length disagrees with NSIDE')
 components[c]=flat
base={'nside':nside,'ordering':ordering,'frame':str(hd.get('COORDSYS','C')),'quantity':quantity,'unit':unit,'semantics':semantics,'pixelAreaSteradians':float(hp.pixel_area.to_value('sr')),'pixels':int(hp.npix),'astropy':astropy.__version__,'astropyHealpix':astropy_healpix.__version__}
if r['operation']=='healpix-inspect': json.dump(base,sys.stdout); raise SystemExit
pix=r.get('pixels');
if not isinstance(pix,list) or not pix or any(not isinstance(v,int) or v<0 or v>=hp.npix for v in pix): raise ValueError('Region selection needs non-empty in-bounds native HEALPix pixel indices')
values={c:[float(components[c][i]) for i in pix] for c in wanted}
json.dump({**base,'selection':{'pixels':pix,'components':wanted},'values':values},sys.stdout,allow_nan=False)`;
async function run(pin:HealpixPin, payload:any):Promise<any>{const tc=await astroqueryToolchain();return await new Promise((resolve,reject)=>{const p=spawn(tc.python,['-c',python],{env:{...process.env,...tc.env},stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.setEncoding('utf8').on('data',x=>out+=x);p.stderr.setEncoding('utf8').on('data',x=>err+=x);p.on('error',reject);p.on('close',code=>{if(code!==0)return reject(new Error(`Astropy HEALPix owner failed: ${err.slice(-1000)}`));try{resolve(JSON.parse(out));}catch(e){reject(e);}});p.stdin.end(JSON.stringify({path:pin.path,...payload}));});}
export async function inspectHealpix(pin:HealpixPin):Promise<HealpixMap>{return run(pin,{operation:'healpix-inspect'});}
export async function selectHealpix(pin:HealpixPin,selection:HealpixSelect):Promise<any>{return run(pin,{operation:'healpix-select',...selection});}
export function validateHealpixMap(map:HealpixMap):HealpixMap{if(!Number.isInteger(map.nside)||map.nside<1||map.pixels!==12*map.nside*map.nside)throw new TypeError('HEALPix NSIDE/pixel count is invalid.');if(map.ordering!=='RING'&&map.ordering!=='NESTED')throw new TypeError('HEALPix ordering must be RING or NESTED.');if(!map.frame||!map.quantity)throw new TypeError('HEALPix frame and quantity are required.');if(map.semantics!=='probability-mass'&&map.semantics!=='density')throw new TypeError('HEALPix quantity semantics must distinguish probability mass from density.');if(map.semantics==='density'&&!/sr(?:\*\*-?1|-1)|\/\s*sr/iu.test(map.unit??''))throw new TypeError('HEALPix density requires explicit per-steradian units.');if(Math.abs(map.pixelAreaSteradians-4*Math.PI/map.pixels)>1e-14)throw new TypeError('HEALPix pixel area disagrees with NSIDE.');return map;}
export function describeHealpix(input:{readonly id:string;readonly member:DescriptorMember;readonly map:HealpixMap;readonly producingRecord:string;readonly acquisition?:ProductDescriptor['dataset']['acquisition'];readonly calibration?:ProductDescriptor['components'][number]['calibration']}):ProductDescriptor{validateHealpixMap(input.map);return descriptor({schema:'cssearth-telescope-product-descriptor@1',dataset:{id:stable(input.id,'HEALPix id'),acquisition:input.acquisition??{kind:'local-import',identity:input.member.path},producingRecord:input.producingRecord,sourceClassifications:[{term:'HEALPix map',vocabulary:'HEALPix FITS',version:'1.0',status:'source'}],families:['F14'],profiles:[{handlerId:'f14-healpix',profileId:'astropy-healpix-fits@1'}]},members:[input.member],components:[{id:'healpix-map',name:input.map.quantity,families:['F14'],locations:[{memberId:input.member.id,structure:'HEALPIX'}],representation:{kind:'physical-field',topology:'points',samples:input.map.pixels},axes:[{id:'pixel',index:0,length:input.map.pixels,role:'healpix-pixel',coordinates:{kind:'native',convention:`${input.map.ordering}; NSIDE=${input.map.nside}; area=${input.map.pixelAreaSteradians} sr`,binBounds:true},frame:input.map.frame}],columns:[],quantity:{name:input.map.quantity,semantics:`${input.map.semantics}; native HEALPix ${input.map.ordering} indexing is retained.`,...(input.map.unit?{unit:input.map.unit}:{})},calibration:input.calibration??{state:'unknown',basis:['Pinned HEALPix bytes establish identity, not calibration.']},flags:[],frame:{kind:'celestial',name:input.map.frame,referencePosition:'HEALPix COORDSYS'},dependencyIds:[]}],dependencies:[],issues:[]});}
const op=(id:string,label:string,parameters:any[]):FamilyOperation=>({id,label,handlerId:'f14-healpix',componentId:'healpix-map',owner:{module:'tools/objects/telescopes/families/f14-healpix.mts',export:id==='healpix-inspect'?'inspectHealpix':'selectHealpix'},available:true,reason:'Astropy reads HEALPix FITS and astropy-healpix defines native RING/NESTED indexing and equal pixel area.',fixedArguments:{},parameters:[...parameters,{id:'out',option:'--out',kind:'output-directory',required:true,description:'New output directory.'}],limitations:['Only selected native pixels/components are exported; no reprojection or density-to-mass conversion is implicit.']});
export const F14_HEALPIX_HANDLER:FamilyHandler={id:'f14-healpix',families:['F14'],profiles:[{id:'astropy-healpix-fits@1',format:'HEALPix FITS binary table',version:'Astropy + astropy-healpix pinned toolchain',families:['F14'],publicBaseline:true,evidence:[{path:'tools/objects/telescopes/families/f14-healpix.test.mts',establishes:'Pinned upstream Bayestar HEALPix FITS is inspected, selected in native NESTED order, exported through the public dispatcher and reopened from its product record.',status:'complete'}]}],recognizes:members=>members.some(m=>/healpix|bayestar/iu.test(m.path))?['astropy-healpix-fits@1']:[],operations:()=>[op('healpix-inspect','Inspect native HEALPix map',[]),op('healpix-select','Export native HEALPix region/components',[{id:'pixels',option:'--pixels',kind:'number-list',required:true,description:'Explicit native HEALPix pixel indices.'},{id:'components',option:'--components',kind:'input-path',required:false,description:'JSON list of component names.'}])]};
