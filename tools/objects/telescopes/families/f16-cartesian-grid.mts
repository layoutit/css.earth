/** Bounded physical Cartesian FITS grids. Astropy owns FITS/WCS interpretation. */
import {spawn} from 'node:child_process';
import {astroqueryToolchain} from '../../astronomy-packages/toolchain.mts';
import {pinFile} from '../../product-record.mts';
import type {FamilyHandler,FamilyOperation} from '../family-handlers.mts';
import type {DescriptorMember,ProductDescriptor} from '../product-descriptor.mts';
import {descriptor,stable} from './common.mts';

export interface PinnedGridFile {readonly path:string;readonly bytes:number;readonly sha256:string}
/** This declaration is deliberately required: XYZ labels alone do not establish physical meaning. */
export interface PhysicalGridContext {readonly frame:string;readonly quantity:string;readonly unit:string;readonly meanHdu:number;readonly uncertaintyHdu:number;readonly uncertaintyForm:'standard-deviation'}
export interface CartesianGridInspection {readonly shape:readonly number[];readonly axes:readonly {readonly id:string;readonly length:number;readonly unit:string;readonly ctype:string}[];readonly affine:{readonly worldAtPixelZero:readonly number[];readonly matrix:readonly (readonly number[])[];readonly determinant:number;readonly voxelEdgeBounds:{readonly min:readonly number[];readonly max:readonly number[]};readonly rightHanded:boolean;readonly reversedCanonicalAxes:readonly number[]};readonly validSamples:number;readonly astropy:string}
export interface GridCrop {readonly start:readonly [number,number,number];readonly shape:readonly [number,number,number]}

function validateContext(context:PhysicalGridContext):PhysicalGridContext{for(const [name,value] of Object.entries({frame:context.frame,quantity:context.quantity,unit:context.unit}))if(typeof value!=='string'||!value.trim())throw new TypeError(`Physical grid ${name} must be explicit.`);for(const [name,value] of Object.entries({meanHdu:context.meanHdu,uncertaintyHdu:context.uncertaintyHdu}))if(!Number.isSafeInteger(value)||value<=0)throw new TypeError(`Physical grid ${name} must be a positive extension index.`);if(context.meanHdu===context.uncertaintyHdu)throw new TypeError('Physical grid mean and uncertainty extensions must differ.');if(context.uncertaintyForm!=='standard-deviation')throw new TypeError('Physical grid uncertainty must be standard deviation.');return context;}

const python=String.raw`import json,sys,numpy as np
from astropy.io import fits
import astropy.units as u, astropy
r=json.load(sys.stdin); ctx=r['context']
def hdu(hdus,key,label):
 try:return hdus[key]
 except Exception:raise ValueError('Missing '+label+' HDU '+str(key))
def grid(path):
 hdus=fits.open(path,memmap=True); mean=hdu(hdus,ctx['meanHdu'],'mean'); std=hdu(hdus,ctx['uncertaintyHdu'],'uncertainty')
 a=np.asarray(mean.data); b=np.asarray(std.data)
 if a.ndim!=3 or b.ndim!=3:raise ValueError('Physical Cartesian profile requires exactly 3-D mean and uncertainty HDUs')
 if a.shape!=b.shape:raise ValueError('Mean and uncertainty arrays must have identical shape')
 hdr=mean.header; ctype=[str(hdr.get('CTYPE'+str(i),'')).strip().upper() for i in range(1,4)]; cunit=[str(hdr.get('CUNIT'+str(i),'')).strip() for i in range(1,4)]
 labels=[x.split('-')[0] for x in ctype]
 if set(labels)!={'X','Y','Z'}:raise ValueError('Physical Cartesian profile requires exactly CTYPE X, Y and Z axes')
 if any(not x for x in cunit):raise ValueError('Physical Cartesian profile requires explicit CUNIT pc on every axis')
 try:
  if any(not u.Unit(x).is_equivalent(u.pc) for x in cunit):raise ValueError('Physical Cartesian profile requires parsec CUNIT on every axis')
 except ValueError:raise
 except Exception:raise ValueError('Physical Cartesian profile has invalid CUNIT')
 crpix=np.array([float(hdr.get('CRPIX'+str(i),1.0)) for i in range(1,4)]); crval=np.array([float(hdr.get('CRVAL'+str(i),0.0)) for i in range(1,4)])
 cd=np.empty((3,3),float)
 use_cd=any(('CD%d_%d'%(i,j)) in hdr for i in range(1,4) for j in range(1,4))
 for i in range(3):
  for j in range(3): cd[i,j]=float(hdr.get(('CD' if use_cd else 'PC')+str(i+1)+'_'+str(j+1), (1.0 if i==j else 0.0)))*(1.0 if use_cd else float(hdr.get('CDELT'+str(i+1),1.0)))
 # The uncertainty HDU must share exactly the coordinates, not merely the array shape.
 for i in range(1,4):
  for key in ('CTYPE','CUNIT','CRPIX','CRVAL','CDELT'):
   akey=key+str(i)
   if str(std.header.get(akey,''))!=str(hdr.get(akey,'')):raise ValueError('Mean and uncertainty WCS headers differ at '+akey)
  for j in range(1,4):
   for key in ('CD','PC'):
    akey=key+str(i)+'_'+str(j)
    if str(std.header.get(akey,''))!=str(hdr.get(akey,'')):raise ValueError('Mean and uncertainty WCS headers differ at '+akey)
 det=float(np.linalg.det(cd))
 if not np.isfinite(det) or abs(det)<1e-12:raise ValueError('Physical Cartesian WCS affine matrix is singular')
 lengths=np.linalg.norm(cd,axis=0)
 if np.any(lengths<=0) or np.max(np.abs((cd/lengths).T@(cd/lengths)-np.eye(3)))>1e-8:raise ValueError('Physical Cartesian WCS must be a rotation/reflection with axis spacing; shear is unsupported')
 # Reorder physical world rows and pixel columns to canonical X,Y,Z.  This retains rotations and arbitrary FITS-axis permutations.
 order=[labels.index(k) for k in ('X','Y','Z')]; canon=cd[np.ix_(order,order)]; origin=(crval+cd@(np.ones(3)-crpix))[order]
 rev=[]
 if np.linalg.det(canon)<0:
  # Reverse canonical X values and its coordinate vector; this is an exact reindexing, not a scientific reflection.
  canon[:,0]*=-1; origin+=cd[np.ix_(order,[order[0]])].reshape(3)*(a.shape[2-order[0]]-1); rev=[0]
 # Bounds include voxel edges, not merely centres.
 shape_xyz=np.array([a.shape[2-i] for i in order],float); corners=np.array(np.meshgrid(*[[-.5,n-.5] for n in shape_xyz],indexing='ij')).reshape(3,-1)
 world=origin[:,None]+canon@corners; valid=np.isfinite(a)&np.isfinite(b)
 return hdus,mean,std,a,b,{'shape':[int(x) for x in shape_xyz],'axes':[{'id':k.lower(),'length':int(shape_xyz[n]),'unit':'pc','ctype':k} for n,k in enumerate(('X','Y','Z'))],'affine':{'worldAtPixelZero':origin.tolist(),'matrix':canon.tolist(),'determinant':float(np.linalg.det(canon)),'voxelEdgeBounds':{'min':world.min(axis=1).tolist(),'max':world.max(axis=1).tolist()},'rightHanded':True,'reversedCanonicalAxes':rev},'validSamples':int(valid.sum()),'astropy':astropy.__version__},order,rev
hdus,mean,std,a,b,answer,order,rev=grid(r['path'])
if r['operation']=='inspect':json.dump(answer,sys.stdout);raise SystemExit
crop=r['crop']; start=np.array(crop['start'],int); shape=np.array(crop['shape'],int); native_shape=np.array(answer['shape'],int)
if np.any(start<0) or np.any(shape<=0) or np.any(start+shape>native_shape):raise ValueError('Crop is outside the canonical physical grid')
# FITS ndarray order is Z,Y,X. Convert selected data into canonical XYZ, crop, then write canonical FITS storage Z,Y,X.
to_xyz=[2-order.index(i) for i in range(3)]; ma=np.transpose(a,to_xyz); sb=np.transpose(b,to_xyz)
for axis in rev:ma=np.flip(ma,axis=axis);sb=np.flip(sb,axis=axis)
sl=tuple(slice(int(start[i]),int(start[i]+shape[i])) for i in range(3)); ma=ma[sl];sb=sb[sl]
valid=np.isfinite(ma)&np.isfinite(sb); base=fits.Header(); base['CTYPE1']='X';base['CTYPE2']='Y';base['CTYPE3']='Z';base['CUNIT1']='pc';base['CUNIT2']='pc';base['CUNIT3']='pc';base['CRPIX1']=1.;base['CRPIX2']=1.;base['CRPIX3']=1.
origin=np.array(answer['affine']['worldAtPixelZero'])+np.array(answer['affine']['matrix'])@start
for i in range(3):
 base['CRVAL'+str(i+1)]=float(origin[i])
 for j in range(3):base['CD%d_%d'%(i+1,j+1)]=float(answer['affine']['matrix'][i][j])
primary=fits.PrimaryHDU(); mh=fits.ImageHDU(np.transpose(ma,(2,1,0)).astype(np.float32),header=base,name='MEAN'); sh=fits.ImageHDU(np.transpose(sb,(2,1,0)).astype(np.float32),header=base,name='STDDEV'); fits.HDUList([primary,mh,sh]).writeto(r['output'],overwrite=False)
answer['crop']={'start':start.tolist(),'shape':shape.tolist(),'validSamples':int(valid.sum()),'invalidSamples':int(valid.size-valid.sum())};json.dump(answer,sys.stdout)`;

async function run(pin:PinnedGridFile,context:PhysicalGridContext,operation:'inspect'|'crop',crop?:GridCrop,output?:string):Promise<any>{
 context=validateContext(context);const actual=await pinFile(pin.path);if(actual.bytes!==pin.bytes||actual.sha256!==pin.sha256)throw new Error('Physical Cartesian FITS pin changed.');
 const toolchain=await astroqueryToolchain();return await new Promise((resolve,reject)=>{const child=spawn(toolchain.python,['-c',python],{env:{...process.env,...toolchain.env},stdio:['pipe','pipe','pipe']});let text='',error='';child.stdout.setEncoding('utf8').on('data',x=>text+=x);child.stderr.setEncoding('utf8').on('data',x=>error+=x);child.on('error',reject);child.on('close',code=>{if(code!==0)return reject(new Error(`Astropy physical-grid owner failed: ${error.slice(-1000)}`));try{resolve(JSON.parse(text));}catch(e){reject(e);}});child.stdin.end(JSON.stringify({path:pin.path,context,operation,...(crop?{crop}:{}),...(output?{output}:{})}));});
}
export async function inspectPhysicalCartesianGrid(pin:PinnedGridFile,context:PhysicalGridContext):Promise<CartesianGridInspection>{return run(pin,context,'inspect');}
export async function cropPhysicalCartesianGrid(pin:PinnedGridFile,context:PhysicalGridContext,crop:GridCrop,output:string):Promise<CartesianGridInspection&{readonly crop:any}>{return run(pin,context,'crop',crop,output);}

export function describePhysicalCartesianGrid(input:{readonly id:string;readonly member:DescriptorMember;readonly context:PhysicalGridContext;readonly inspection:CartesianGridInspection;readonly producingRecord:string;readonly target?:string;readonly acquisition?:ProductDescriptor['dataset']['acquisition']}):ProductDescriptor{
 const sampleCount=input.inspection.shape.reduce((a,b)=>a*b,1),axes=input.inspection.axes.map((axis,index)=>({id:axis.id,index,length:axis.length,role:'physical-'+axis.id,unit:'pc',coordinates:{kind:'native' as const,convention:`FITS Cartesian ${axis.ctype}; affine retained by Astropy crop receipt`,binBounds:true},frame:input.context.frame}));return descriptor({schema:'cssearth-telescope-product-descriptor@1',dataset:{id:stable(input.id,'physical Cartesian grid id'),...(input.target?{target:input.target}:{}),acquisition:input.acquisition??{kind:'local-import',identity:input.member.path},producingRecord:input.producingRecord,sourceClassifications:[{term:'physical Cartesian scalar grid',vocabulary:'FITS/WCS',version:'4.0',status:'mapped'}],families:['F16'],profiles:[{handlerId:'f16-cartesian-grid',profileId:'astropy-physical-cartesian-grid@1'}]},members:[input.member],components:[{id:'mean',name:'physical scalar posterior mean',families:['F16'],locations:[{memberId:input.member.id,hdu:input.context.meanHdu}],representation:{kind:'physical-field',topology:'grid',samples:sampleCount},axes,columns:[],quantity:{name:input.context.quantity,unit:input.context.unit,semantics:'Source-declared physical Cartesian scalar. Valid zero is retained; only non-finite mean or uncertainty is masked.'},calibration:{state:'unknown',basis:['Local FITS bytes and Astropy WCS inspection establish structure; scientific calibration remains source-specific.']},uncertainty:{form:'standard-deviation',componentId:'uncertainty',basis:'Paired source HDU with identical shape and coordinates.'},flags:[{id:'finite-mean-and-stddev',meaning:'Usable only where both posterior mean and standard deviation are finite.'}],frame:{kind:'physical',name:input.context.frame},dependencyIds:['paired-uncertainty']},{id:'uncertainty',name:'physical scalar posterior standard deviation',families:['F16'],locations:[{memberId:input.member.id,hdu:input.context.uncertaintyHdu}],representation:{kind:'physical-field',topology:'grid',samples:sampleCount},axes,columns:[],quantity:{name:`${input.context.quantity} uncertainty`,unit:input.context.unit,semantics:'Source-declared standard deviation aligned cell-for-cell with the posterior mean.'},calibration:{state:'unknown',basis:['Paired source HDU is structurally validated.']},flags:[],frame:{kind:'physical',name:input.context.frame},dependencyIds:['paired-uncertainty']}],dependencies:[{id:'paired-uncertainty',role:'mean/standard-deviation closure',memberIds:[input.member.id],componentIds:['mean','uncertainty'],requiredFor:['physical-grid-inspect','physical-grid-crop'],evidence:'Astropy required equal 3-D shapes and coordinates and one explicit source context.'}],issues:[]});
}
const operation=(id:'physical-grid-inspect'|'physical-grid-crop',label:string,parameters:any[]):FamilyOperation=>({id,label,handlerId:'f16-cartesian-grid',componentId:'mean',owner:{module:'tools/objects/telescopes/families/f16-cartesian-grid.mts',export:id==='physical-grid-inspect'?'inspectPhysicalCartesianGrid':'cropPhysicalCartesianGrid'},available:true,reason:'Astropy validates a source-declared 3-D parsec Cartesian mean/stddev grid before use.',fixedArguments:{},parameters:[...parameters,{id:'out',option:'--out',kind:'output-directory',required:true,description:'New output directory.'}],limitations:['XYZ FITS axes are refused unless the importer supplies explicit physical source context; no angular or spectral cube is treated as depth.']});
export const F16_CARTESIAN_GRID_HANDLER:FamilyHandler={id:'f16-cartesian-grid',families:['F16'],profiles:[{id:'astropy-physical-cartesian-grid@1',format:'Astropy FITS Cartesian mean plus standard-deviation HDU',version:'Astropy pinned toolchain',families:['F16'],publicBaseline:true,evidence:[{path:'tools/objects/telescopes/families/f16-cartesian-grid.test.mts',establishes:'Asymmetric FITS fixture validates axis permutation, reflection repair, rotation, finite mask and public crop.',status:'complete'}]}],recognizes:()=>[],operations:()=>[operation('physical-grid-inspect','Inspect physical Cartesian grid',[]),operation('physical-grid-crop','Crop physical Cartesian grid',[{id:'crop',option:'--crop',kind:'input-path',required:true,description:'JSON {start:[x,y,z],shape:[x,y,z]} in canonical physical coordinates.'}])]};
