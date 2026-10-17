/** Offline b30 slab-local spectral transfer; display encoding never reads another slab. */
import { GALAXY_SLICE_EXTENT_SETUP } from './galaxy-slice-extent.mts';

export const GALAXY_SLICES = String.raw`
import os,json,sys,numpy as np
from PIL import Image
B,O,F=sys.argv[1:4]
opts=json.loads(sys.argv[4]) if len(sys.argv)>4 else {}
mode=opts.get('mode','outside-display');counts=opts.get('counts',[26,26,26]);axes=opts.get('axes',[0,1,2])
scale=float(opts.get('displayScale',1));dust_gain=float(opts.get('dustAlpha',1))
completed_image_opacity=1
if mode!='outside-display' or scale<=0 or dust_gain!=1:raise ValueError('Only the accepted fixed-exposure slab-local transfer is supported')
if len(counts)!=3 or any(type(n)!=int or n<=0 for n in counts) or 3*sum(counts)+16>500:raise ValueError('Slab bank exceeds 500 elements including copies and wrappers')
os.makedirs(O,exist_ok=True)
m=json.load(open(B+'/meta.json'));nx,ny,nz=m['dims'];box=m['box'];origin=m['originKpc'];spacing=m['spacingKpc']
E=np.memmap(B+'/emission.f32',dtype='<f4',mode='r',shape=(nz,ny,nx,3))
D=np.memmap(B+'/dust.f32',dtype='<f4',mode='r',shape=(nz,ny,nx))
S=np.memmap(B+'/scatter.f32',dtype='<f4',mode='r',shape=(nz,ny,nx,3))
${GALAXY_SLICE_EXTENT_SETUP}
q=m['camera'];gain=float(np.exp(json.load(open(F))['params']['logExposure']))
Mx=np.array([[1,q['camRG'],q['camRB']],[q['camGR'],1,q['camGB']],[q['camBR'],q['camBG'],1]])
def camera(x):
 x=np.maximum(x@Mx.T,0)*[q['wbSkyR'],1,q['wbSkyB']];grey=x.mean(-1,keepdims=True)
 return np.maximum(grey+q['camSaturation']*(x-grey),0)
def display(light):
 return (np.arcsinh(np.maximum(camera(light),0)*scale*6)/np.arcsinh(6)).clip(0,1)**.9
def plane(vol,axis,d):
 c=(d-origin[axis])/spacing[axis];n=m['dims'][axis];i=int(np.floor(c));f=c-i
 # Finite nodal support; slab samples are strictly inside its box.
 i=max(0,min(n-2,i));f=max(0,min(1,f));a=2-axis
 core=np.take(vol,i,axis=a).astype('float64')*(1-f)+np.take(vol,i+1,axis=a).astype('float64')*f
 return extend_plane(vol,axis,i,f,core)
rows=[];leaves=[]
for axis,count in enumerate(counts):
 if axis not in axes:continue
 name='xyz'[axis];lo,hi=box[2*axis:2*axis+2];pitch=(hi-lo)/count
 os.makedirs(O+'/'+name,exist_ok=True)
 ref=np.zeros((image_dims[2 if axis<2 else 1],image_dims[1 if axis==0 else 0],3))
 tref=np.ones_like(ref);rgba_out=np.zeros_like(ref);rgba_t=np.ones(ref.shape[:-1])
 reverse_delta=[]
 # +axis eye looks toward -axis. The renderer sorts leaf depth, not this file order.
 for index in reversed(range(count)):
  # Preserve the accepted uniform recipe's arithmetic, including its metadata.
  near=lo+(index+1)*pitch;width=pitch;center=lo+(index+.5)*pitch
  steps=max(1,int(np.ceil(width/spacing[axis])));ds=width/steps
  lp=np.zeros_like(ref);tp=np.ones_like(ref);lm=np.zeros_like(ref);tm=np.ones_like(ref);tau=np.zeros_like(ref)
  for step in range(steps):
   for forward in (True,False):
    depth=near-(step+.5)*ds if forward else near-width+(step+.5)*ds
    dt=plane(D,axis,depth)[...,None]*np.array(m['extinctionPerChannel'])*ds
    escape=np.divide(-np.expm1(-dt),dt,out=np.ones_like(dt),where=dt>1e-12)
    light=(plane(E,axis,depth)+plane(S,axis,depth))*ds
    if forward:lp+=tp*light*escape;tp*=np.exp(-dt);tau+=dt
    else:lm+=tm*light*escape;tm*=np.exp(-dt)
  ref+=tref*lp;tref*=tp
  # Only this interval's source and dust enter its texture. Display is necessarily
  # approximate: source-over cannot carry b30's three transmittances or post-sum tone.
  premult=display(lp);alpha=np.maximum(-np.expm1(-tau.min(-1))*dust_gain,premult.max(-1)).clip(0,1)
  straight=np.divide(premult,alpha[...,None],out=np.zeros_like(premult),where=alpha[...,None]>0).clip(0,1)
  rgba=np.rint(np.concatenate((straight,alpha[...,None]),-1)*255).astype('u1')
  # Texture top is +vertical; x/y stacks are z rows, z stack is y rows.
  rgba=rgba[::-1].copy();texture,extent=extended_texture(rgba,axis)
  Image.fromarray(texture).save(O+'/'+name+'/'+str(index).zfill(3)+'.png')
  decoded=rgba[::-1].astype('float64')/255;a=decoded[...,3];c=decoded[...,:3]
  rgba_out+=rgba_t[...,None]*c*a[...,None];rgba_t*=1-a
  reverse_delta.append(float(np.abs(lp-lm).sum()))
  leaves.append({'axis':name,'index':index,'center':center,'texturePath':name+'/'+str(index).zfill(3)+'.png','width':texture.shape[1],'height':texture.shape[0],**extent})
 expected=display(ref)
 delta=rgba_out-expected
 row={'axis':name,'slices':count,'width':ref.shape[1],'height':ref.shape[0],'samplesPerSlab':steps,
 'relativeL1':float(np.abs(delta).sum()/np.abs(expected).sum()),'normalizedRms':float(np.sqrt((delta*delta).sum()/(expected*expected).sum())),
 'repeatIdentical':None,'forwardBackwardSlabLightDifference':sum(reverse_delta),'status':'Slab-local scalar approximation vs spectral integration with post-integration display; not exact b30 transfer'}
 rows.append(row)
 for label,img in [('reference',expected),('rgba8',rgba_out)]:
  Image.fromarray(np.rint(img[::-1].clip(0,1)*255).astype('u1')).save(O+'/'+name+'-'+label+'.png')
 print('BAKED AXIS',row,flush=True)
files=[{'path':os.path.relpath(os.path.join(dp,f),O),'bytes':os.stat(os.path.join(dp,f)).st_size} for dp,dn,fs in os.walk(O) for f in fs if f.endswith('.png')]
json.dump({'status':'Slab-local candidate; post-integration b30 tone and spectral inter-slab transfer are not representable by scalar RGBA','field':m,'gain':gain,'counts':counts,'bakeControls':opts,'slabLocalTransfer':True,'completedImageOpacity':completed_image_opacity,'rows':rows,'leaves':leaves,'files':files},open(O+'/prototype.json','w'),indent=2)
print('GALAXY SLABS COMPLETE',sum(f['bytes'] for f in files),flush=True)
`;
