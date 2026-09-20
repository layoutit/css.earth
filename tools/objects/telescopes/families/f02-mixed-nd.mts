/** F02 mixed FITS arrays: Astropy owns FITS/WCS axis inspection and extraction. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { astroqueryToolchain } from '../../astronomy-packages/toolchain.mts';
import type { FamilyHandler, FamilyOperation } from '../family-handlers.mts';
import type { DescriptorMember, ProductDescriptor } from '../product-descriptor.mts';
import { descriptor, stable } from './common.mts';

export interface PinnedFile { readonly path:string; readonly bytes:number; readonly sha256:string }
export interface NdAxis { readonly id:string; readonly fitsAxis:number; readonly numpyIndex:number; readonly length:number; readonly role:'x'|'y'|'spectral'|'time'|'polarization'|'other'; readonly ctype?:string; readonly unit?:string }
export interface NdInspection { readonly shape:readonly number[]; readonly axes:readonly NdAxis[]; readonly astropy:string }
export interface NdSelection { readonly operation:'nd-inspect'|'nd-image'|'nd-spectrum'|'nd-time-series'; readonly slice?:Readonly<Record<string,number>>; readonly x?:number; readonly y?:number }

const python=String.raw`import json,re,sys,numpy as np
from astropy.io import fits
import astropy
r=json.load(sys.stdin); h=fits.open(r['path'],memmap=False)[0]; data=np.asarray(h.data); header=h.header
if data.ndim < 3: raise ValueError('F02 mixed profile requires a native array with at least three axes')
roles=[]; axes=[]
for fits_axis in range(1, data.ndim+1):
 ctype=str(header.get('CTYPE'+str(fits_axis),'')).upper(); unit=str(header.get('CUNIT'+str(fits_axis),''))
 role='spectral' if any(x in ctype for x in ('FREQ','WAVE','VRAD','VOPT','VELO')) else 'time' if 'TIME' in ctype else 'polarization' if any(x in ctype for x in ('STOKES','POL')) else 'x' if any(x in ctype for x in ('RA','GLON','LON')) else 'y' if any(x in ctype for x in ('DEC','GLAT','LAT')) else 'other'
 index=data.ndim-fits_axis; axes.append({'id':'axis-'+str(index),'fitsAxis':fits_axis,'numpyIndex':index,'length':int(data.shape[index]),'role':role,'ctype':ctype or None,'unit':unit or None})
axes.sort(key=lambda axis: axis['numpyIndex'])

# Preserve the source coordinate context with the extracted values.  This is
# deliberately header-level: FITS WCS can couple axes or use lookup/distortion
# conventions, so this export must not pretend every axis has a separable
# linear world coordinate.
def scalar(value):
 if isinstance(value,np.generic): return value.item()
 if isinstance(value,(str,int,float,bool)) or value is None: return value
 return str(value)
def coordinate_card(key):
 return key in {'BUNIT','WCSAXES','RADESYS','EQUINOX','LONPOLE','LATPOLE','SPECSYS','SSYSOBS','VELOSYS','TIMESYS','TIMEUNIT','TREFPOS','MJDREF','MJDREFI','MJDREFF','JDREF','JDREFI','JDREFF','DATEREF','DATE-OBS','DATE-AVG','OBSGEO-X','OBSGEO-Y','OBSGEO-Z'} or re.match(r'^(CTYPE|CUNIT|CRPIX|CRVAL|CDELT|CROTA|CNAME|PC|CD|PV|PS)[0-9_]+$',key) is not None
cards=[{'keyword':card.keyword,'value':scalar(card.value),'comment':card.comment} for card in header.cards if coordinate_card(card.keyword)]
matrix=[]; coupled=False
for i in range(1,data.ndim+1):
 for j in range(1,data.ndim+1):
  for prefix in ('PC','CD'):
   key=prefix+str(i)+'_'+str(j)
   if key in header:
    value=scalar(header[key]); matrix.append({'keyword':key,'value':value})
    if i!=j and float(value)!=0: coupled=True
unsupported=[]
if any('-TAB' in str(a['ctype']).upper() for a in axes): unsupported.append('FITS -TAB lookup coordinates require their auxiliary table HDUs; this JSON preserves the header reference but does not inline them.')
if any(key in header for key in ('A_ORDER','B_ORDER','AP_ORDER','BP_ORDER','CPDIS1','CPDIS2','DET2IM1','DET2IM2')): unsupported.append('FITS distortion metadata is preserved in the native product but is not expanded into this JSON export.')
def context(kept, selected):
 return {
  'dataUnit':str(header['BUNIT']) if 'BUNIT' in header else None,
  'sourceWcsCards':cards,
  'timeReference':{key:scalar(header[key]) for key in ('TIMESYS','TIMEUNIT','TREFPOS','MJDREF','MJDREFI','MJDREFF','JDREF','JDREFI','JDREFF','DATEREF','DATE-OBS','DATE-AVG') if key in header},
  'coordinateModel':{'kind':'native-fits-wcs','separable':not coupled and not unsupported,'coupled':coupled,'matrix':matrix,'unsupportedFeatures':unsupported,'pixelIndexConvention':'sourceNumpyIndex is zero-based; FITS WCS pixel coordinates are sourceNumpyIndex + 1.'},
  'outputAxisMapping':[{'outputNumpyAxis':output_index,'sourceAxisId':axis['id'],'sourceNumpyAxis':axis['numpyIndex'],'sourceFitsAxis':axis['fitsAxis'],'sourceIndices':{'start':0,'step':1,'length':axis['length']}} for output_index,axis in enumerate(kept)],
  'fixedAxisSelection':[{'sourceAxisId':axis['id'],'sourceNumpyAxis':axis['numpyIndex'],'sourceFitsAxis':axis['fitsAxis'],'sourceIndex':selected[axis['id']]} for axis in axes if selected and axis['role'] not in want]
 }
if len([x for x in axes if x['role']=='x'])!=1 or len([x for x in axes if x['role']=='y'])!=1: raise ValueError('F02 mixed profile requires exactly one native spatial X and Y axis')
want={'nd-image':{'x','y'},'nd-spectrum':{'spectral'},'nd-time-series':{'time'}}.get(r['operation'],set())
if r['operation']=='nd-inspect': json.dump({'shape':[int(x) for x in data.shape],'axes':axes,'coordinateContext':context(axes,{}),'astropy':astropy.__version__},sys.stdout); raise SystemExit
if want and not all(any(a['role']==role for a in axes) for role in want): raise ValueError('Requested extraction axis is absent')
sl=r.get('slice') or {}; known={a['id'] for a in axes}
if set(sl)-known: raise ValueError('Slice names an unknown axis')
if r['operation']=='nd-spectrum':
 if not isinstance(r.get('x'),int) or not isinstance(r.get('y'),int): raise ValueError('Spectrum requires explicit x and y')
 sl={**sl, next(a['id'] for a in axes if a['role']=='x'):r['x'], next(a['id'] for a in axes if a['role']=='y'):r['y']}
for a in axes:
 if a['role'] not in want and a['id'] not in sl: raise ValueError('Every axis outside the requested extraction must be explicitly sliced: '+a['id'])
 if a['id'] in sl and (not isinstance(sl[a['id']],int) or sl[a['id']]<0 or sl[a['id']]>=a['length']): raise ValueError('Slice index is out of bounds: '+a['id'])
index=tuple(slice(None) if a['role'] in want else sl[a['id']] for a in axes)
out=data[index]
if out.ndim != len(want): raise ValueError('Selected meaningful axes were unexpectedly squeezed')
kept=[a for a in axes if a['role'] in want]
json.dump({'operation':r['operation'],'shape':[int(x) for x in out.shape],'axes':kept,'selection':sl,'coordinateContext':context(kept,sl),'values':np.asarray(out,dtype=float).tolist(),'astropy':astropy.__version__},sys.stdout,allow_nan=False)`;

async function run(pin:PinnedFile, selection:NdSelection):Promise<any>{
 const bytes=await readFile(pin.path),sha256=createHash('sha256').update(bytes).digest('hex'); if(bytes.byteLength!==pin.bytes||sha256!==pin.sha256)throw new Error('Mixed FITS fixture pin changed.');
 const toolchain=await astroqueryToolchain(); return await new Promise((resolve,reject)=>{const child=spawn(toolchain.python,['-c',python],{env:{...process.env,...toolchain.env},stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.setEncoding('utf8').on('data',x=>out+=x);child.stderr.setEncoding('utf8').on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>{if(code!==0)return reject(new Error(`Astropy mixed-array owner failed: ${err.slice(-1000)}`));try{resolve(JSON.parse(out));}catch(error){reject(error);}});child.stdin.end(JSON.stringify({path:pin.path,...selection}));});
}
export async function inspectMixedNd(pin:PinnedFile):Promise<NdInspection>{return run(pin,{operation:'nd-inspect'});}
export async function extractMixedNd(pin:PinnedFile,selection:NdSelection):Promise<any>{if(selection.operation==='nd-inspect')throw new TypeError('Use inspectMixedNd for inspection.');return run(pin,selection);}

export function describeMixedNd(input:{readonly id:string;readonly member:DescriptorMember;readonly inspection:NdInspection;readonly producingRecord:string;readonly acquisition?:ProductDescriptor['dataset']['acquisition'];readonly calibration?:ProductDescriptor['components'][number]['calibration']}):ProductDescriptor{
 const axes=input.inspection.axes; if(!axes.some(a=>a.role==='time')||!axes.some(a=>a.role==='spectral')||!axes.some(a=>a.role==='polarization'))throw new TypeError('F02 baseline requires time, spectral and polarization axes.');
 return descriptor({schema:'cssearth-telescope-product-descriptor@1',dataset:{id:stable(input.id,'mixed N-D id'),acquisition:input.acquisition??{kind:'local-import',identity:input.member.path},producingRecord:input.producingRecord,sourceClassifications:[{term:'mixed N-D FITS array',vocabulary:'FITS/WCS',version:'4.0',status:'source'}],families:['F02'],profiles:[{handlerId:'f02-mixed-nd',profileId:'astropy-mixed-nd-fits@1'}]},members:[input.member],components:[{id:'mixed-array',name:'native mixed N-D measurement',families:['F02'],locations:[{memberId:input.member.id,hdu:0}],representation:{kind:'array',shape:input.inspection.shape,storageOrder:'native'},axes:axes.map(a=>({id:a.id,index:a.numpyIndex,length:a.length,role:a.role==='x'||a.role==='y'?'unknown':a.role, ...(a.unit?{unit:a.unit}:{}),coordinates:{kind:'native' as const,convention:a.ctype??'unnamed native axis',binBounds:false}})),columns:[],quantity:{name:'native mixed-axis measurement',semantics:'Astropy reads FITS/WCS axes; every unselected axis is explicitly sliced and selected axes retain their native dimensionality.'},calibration:input.calibration??{state:'unknown',basis:['Pinned FITS bytes establish identity, not calibration.']},flags:[],dependencyIds:[]}],dependencies:[],issues:[]});
}
const operation=(id:NdSelection['operation'],label:string,parameters:any[]):FamilyOperation=>({id,label,handlerId:'f02-mixed-nd',componentId:'mixed-array',owner:{module:'tools/objects/telescopes/families/f02-mixed-nd.mts',export:id==='nd-inspect'?'inspectMixedNd':'extractMixedNd'},available:true,reason:'Astropy inspects all FITS/WCS axes; remaining axes must be explicitly sliced.',fixedArguments:{},parameters:[...parameters,{id:'out',option:'--out',kind:'output-directory',required:true,description:'New output directory.'}],limitations:['Only the declared mixed time/spectral/polarization FITS profile is covered.']});
function recognizesMixedNd(prefix:Uint8Array):boolean{
 const header=Buffer.from(prefix).toString('latin1');if(!header.startsWith('SIMPLE  ='))return false;
 const match=/(?:^|.{0,71})NAXIS\s*=\s*(\d+)/u.exec(header);return match!==null&&Number(match[1])>=3;
}
export const F02_MIXED_ND_HANDLER:FamilyHandler={id:'f02-mixed-nd',families:['F02'],profiles:[{id:'astropy-mixed-nd-fits@1',format:'Astropy FITS/WCS mixed time, spectral and polarization array',version:'Astropy pinned toolchain',families:['F02'],publicBaseline:true,evidence:[{path:'tools/objects/telescopes/families/f02-mixed-nd.test.mts',establishes:'A pinned public full-Stokes FITS/WCS fixture and an adverse coordinate fixture are sliced by axis role through the public dispatcher with product-record readback.',status:'complete'}]}],recognizes:members=>members.some(m=>recognizesMixedNd(m.prefix))?['astropy-mixed-nd-fits@1']:[],operations:()=>[operation('nd-inspect','Inspect all native axes',[]),operation('nd-image','Extract native image axes',[{id:'slice',option:'--slice',kind:'input-path',required:true,description:'JSON object with every non-image axis index.'}]),operation('nd-spectrum','Extract native spectrum',[{id:'x',option:'--x',kind:'integer',required:true,minimum:0,description:'Native X index.'},{id:'y',option:'--y',kind:'integer',required:true,minimum:0,description:'Native Y index.'},{id:'slice',option:'--slice',kind:'input-path',required:true,description:'JSON object with every remaining non-spectrum axis index.'}]),operation('nd-time-series','Extract native time series',[{id:'slice',option:'--slice',kind:'input-path',required:true,description:'JSON object with every non-time axis index.'}])]};
