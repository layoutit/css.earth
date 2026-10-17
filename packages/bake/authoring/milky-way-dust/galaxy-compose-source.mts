/** Composed-object kernel adapted from compose3d.py, using the v8 physical field owner. */
import { PRECOMPUTE } from './galaxy-physics.mts';

export const fieldSetup = PRECOMPUTE.slice(0, PRECOMPUTE.indexOf('def dirs_of('))
  .replace('PHYSICS=options()', "record=json.load(open([a for a in sys.argv[1:] if not a.startswith('--')][2]))\nfrom physics8 import record_physics,flag_args\nPHYSICS=options(flag_args(record_physics(record))+sys.argv[1:])")
  .replace('W, O = args[0], args[1]', "W,O,FIT,VJ=args[:4]\nMETA=json.load(open(VJ))\nfor key in ('discHeights','dustField','localSampling'):\n    prepared=META.get('physics',{}).get(key, 'grid' if key=='localSampling' else 'sech2old' if key=='discHeights' else 'legacy')\n    if prepared!=PHYSICS[key]:raise ValueError('composed physics must match prepared '+key)\nif PHYSICS['localSharpen']=='on' and record['params'].get('localSharpen',0)!=0:raise ValueError('projected sharpening has no physical 3D owner')")
  .replace("opt = {a.split('=')[0][2:]: a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--')}", "saved_structure=json.load(open(os.path.join(os.path.dirname(VJ),'structure.json')))\nopt={**saved_structure,**{a.split('=')[0][2:]: a.split('=',1)[1] for a in sys.argv[1:] if a.startswith('--')}}\nfor key in ('youngHz','youngHR','zSun','gradIn','gradOut','hole','hR','hRthick','fadeIn','fadeOut','vergelyFade','nativeStepPc','farContrast'):\n    if key in saved_structure and key in opt and float(opt[key])!=float(saved_structure[key]):raise ValueError('composed structure differs from fitted '+key)\nfor key in ('arms','smooth','textured','local','vergely'):\n    if key in opt and opt[key] is not None and not os.path.isabs(str(opt[key])):opt[key]=os.path.join(W,str(opt[key]))")
  .replace("CONTRAST=float(next((a.split(\"=\",1)[1] for a in sys.argv if a.startswith(\"--farContrast=\")),1))", "CONTRAST=float(json.load(open([a for a in sys.argv[1:] if not a.startswith('--')][3])).get('farContrast',1))")
  .replace("dev = torch.device('cuda')", "dev = torch.device(os.environ.get('COMPOSE_DEVICE','cuda'))");

export const COMPOSE = fieldSetup + String.raw`# ---- compose: the same per-slab arithmetic as fit6_gpu._slab, per voxel, in kpc^-1 ----
q = record['params'].copy();q.update({a:k*q[b] for a,b,k in record.get('ties',[])})
vp = META['views']['face']['p99']; T0, A0 = vp['thin'], vp['arms']
from physics8 import REF, ccm
mix = lambda a, b, t: a + (b - a) * t
rv = 2.5 + 1.5 * q['reddening']; ext = [ccm(0.92, rv) / ccm(0.64, rv), 1.0, ccm(0.48, rv) / ccm(0.64, rv)]
oldC = (1.649, 1, .516); barC = (1.750, 1, .472); thickC = (1.546, 1, .521); gradC = (q['thinGradient']*(1.380-1.649), 0, q['thinGradient']*(.749-.516))
yb = q['youngBlue']; youngC = tuple(a*(1-yb)+b*yb for a, b in zip((1.240, 1, .852), (.947, 1, 1.098))); pinkC = (.6, 1, .75)
extra={}
if PHYSICS['scatter']=='on':
    from scatter8_prepare import prepare_sources
    illumination=META['illumination']
    cp=os.path.join(os.path.dirname(__file__),'compose-calibration.json')
    ip=os.path.join(os.path.dirname(__file__),'compose-illumination.json')
    json.dump(illumination['calibration'],open(cp,'w'));json.dump({'params':illumination['params']},open(ip,'w'))
    opt.update(scatterCalibration=cp,illuminationFit=ip)
    extra,rebuilt=prepare_sources(fields,n,gs,go,opt,dev,{'face':vp},PHYSICS,nativeLocal)

# Retain source banks in host memory; materialize one brick chunk at a time.
# A native local brick is too large to retain every stellar/dust field on the GPU.
f={k:fields[k]().detach().cpu() for k in ('bar','thin','oldArms','armsMajor','armsMinor','dustSmooth','dustTextured','dustArms','dustVergely')}
for name,stat in far_stats.items():
    expected=META.get('farDensity',{}).get(name,{}).get('overlapMedianGain')
    if expected is not None and not np.isclose(expected,stat['overlapMedianGain'],rtol=1e-5,atol=0):raise ValueError('composed far anchor differs from fitted '+name)
oldRatio=torch.where(f['thin']>0,f['oldArms']/f['thin'].clamp_min(1e-30),torch.zeros_like(f['thin']));del f['thin'],f['oldArms']
texture=T.detach().cpu();local_volume=locz.detach().cpu();local_grid=locG.detach().cpu()
SF={k:m().detach().cpu() for k,m in extra.items() if not k.startswith('scatterLocal') or nativeLocal is None}
fields.clear();extra.clear()
del bar,thin,thick,arms,R,ZZ,ZP,vz,T,locG,locM,dustV,wVg,replacement,locz,S
if dev.type=='cuda':torch.cuda.empty_cache()
BR=float(opt.get('boxR',25));BZ=float(opt.get('boxZ',3));DXY=float(opt.get('dxy',.1));DZ=float(opt.get('dz',.03))
BOX=[float(v) for v in opt['box'].split(',')] if 'box' in opt else [8.277-BR,8.277+BR,-BR,BR,-BZ,BZ]
bx=torch.arange(BOX[0],BOX[1]+1e-6,DXY,device=dev);by=torch.arange(BOX[2],BOX[3]+1e-6,DXY,device=dev);bz=torch.arange(BOX[4],BOX[5]+1e-6,DZ,device=dev)
nx,ny,nz=len(bx),len(by),len(bz)
if min(nx,ny,nz)<2:raise ValueError('a composed brick needs at least two nodes per axis')
scales={name:ccm(.64,rv)/(ccm(ref,rv) if ref is not None else 1) if PHYSICS['dustRef']=='a0' else 1 for name,ref in REF.items()}
if PHYSICS['scatter']=='on':
    r=META['illumination'];p=r['params'];totals=r['rTotals']
    lum=lambda p:totals['thin']+p['oldArmContrast']*totals['oldArms']+p['barRatio']*totals['bar']+p['thickRatio']*totals['thick']+p['youngGain']*(totals['armsMajor']+p['minorArmGain']*totals['armsMinor'])
    t=np.clip((rv-3.1)/2.4,0,1);omega=np.array([.63,.67,.67])*(1-t)+np.array([.74,.77,.74])*t
    scatter_gain=(lum(q)/lum(p))*omega/np.array([.74,.77,.74])
def discAt(hR,hz,norm,hole,X,Y,Z):
    Rr=torch.hypot(X-8.277,Y)
    vertical=torch.exp(-(Z+ZSUN).abs()/hz) if PHYSICS['discHeights']=='exp' else 1/torch.cosh((Z+ZSUN)/hz)**2
    d=norm*torch.exp(-(Rr-8.277)/hR)*vertical
    if hole>0:d=d*(1-torch.exp(-Rr/hole+Rr/hR))/(1-np.exp(-8.277/hole+8.277/hR))
    return d
emission_file=np.memmap(f'{O}/emission.f32',dtype='<f4',mode='w+',shape=(nz,ny,nx,3))
split=opt.get('splitEmission','off')=='on'
if split:
    smooth_file=np.memmap(f'{O}/smooth.f32',dtype='<f4',mode='w+',shape=(nz,ny,nx,3))
    sharp_file=np.memmap(f'{O}/sharp.f32',dtype='<f4',mode='w+',shape=(nz,ny,nx,3))
dust_file=np.memmap(f'{O}/dust.f32',dtype='<f4',mode='w+',shape=(nz,ny,nx))
scatter_file=np.memmap(f'{O}/scatter.f32',dtype='<f4',mode='w+',shape=(nz,ny,nx,3))
emission_sample=[];dust_sample=[];stride=max(1,int(np.ceil(nx*ny*nz/4_000_000)))
for i in range(0,nx,8):
    X,Y,Z=torch.meshgrid(bx[i:i+8],by,bz,indexing='ij');points=torch.stack([X,Y,Z],-1)
    def onGrid(value):return sample(value.to(dev)[None,None],points,go,gs)
    D={k:onGrid(value) for k,value in f.items() if k not in ('thin','oldArms')}
    thinB=discAt(HR,.3,33/600,HOLE,X,Y,Z);thickB=discAt(HRT,.9,.12*33/1800,0,X,Y,Z)
    thinOB=thinB*((torch.hypot(X-8.277,Y)-GIN)/(GOUT-GIN)).clamp(0,1)
    oldArmsB=onGrid(oldRatio)*thinB
    TB=onGrid(texture)
    D['dustLocal']=sample(local_volume.to(dev),points,lo,lsp) if PHYSICS['localSampling']=='native' else onGrid(local_grid)
    armsB=D['armsMajor']+q['minorArmGain']*D['armsMinor']
    young=armsB/A0*torch.maximum(torch.tensor(q['texFloor'],device=dev),TB)**q['texPower']
    hii=armsB/A0*(TB-2).clamp_min(0)**1.5
    oThin=(thinB+q['oldArmContrast']*oldArmsB)/T0;oBar=q['barRatio']*D['bar']/T0;oThick=q['thickRatio']*thickB/T0;oG=thinOB/T0
    E=torch.stack([oThin*oldC[c]+oG*gradC[c]+oBar*barC[c]+oThick*thickC[c]+q['youngGain']*young*youngC[c]+q['youngGain']*q['hiiRatio']*hii*pinkC[c] for c in range(3)])
    if split:
        smooth=torch.stack([oThin*oldC[c]+oG*gradC[c]+oBar*barC[c]+oThick*thickC[c] for c in range(3)])
        sharp=torch.stack([q['youngGain']*young*youngC[c]+q['youngGain']*q['hiiRatio']*hii*pinkC[c] for c in range(3)])
        smooth_file[:,:,i:i+8,:]=smooth.permute(3,2,1,0).contiguous().cpu().numpy()
        sharp_file[:,:,i:i+8,:]=sharp.permute(3,2,1,0).contiguous().cpu().numpy()
        del smooth,sharp
    d0=mix(D['dustSmooth'],D['dustTextured'],q['dustTexture']).clamp_min(0)
    far=d0 if PHYSICS['dustField']=='physical' else d0**q['dustContrast']
    dust=q['dustStrength']*far*scales['dustSmooth']+q['localDustGain']*D['dustLocal']*scales['dustLocal']+q['armsDustGain']*D['dustArms']*scales['dustArms']+q['vergelyGain']*D['dustVergely']*scales['dustVergely']
    scatter=torch.zeros_like(E)
    for c,b in enumerate('zrg') if PHYSICS['scatter']=='on' else []:
        def source(name):
            key='scatter'+name+b
            if name=='Local' and nativeLocal is not None:
                vol=torch.from_numpy(nativeLocal.products[b]).to(dev)[None,None]
                return sample(vol,points,lo,lsp)
            return onGrid(SF[key])
        sc=q['dustStrength']*mix(source('Smooth'),source('Textured'),q['dustTexture'])*scales['dustSmooth']
        sc+=q['localDustGain']*source('Local')*scales['dustLocal']+q['vergelyGain']*source('Vergely')*scales['dustVergely']+q['armsDustGain']*source('Arms')*scales['dustArms']
        scatter[c]=sc*ext[c]*scatter_gain[c]
    if not torch.isfinite(E).all() or not torch.isfinite(dust).all() or not torch.isfinite(scatter).all():raise ValueError('nonfinite composed fields')
    emission_file[:,:,i:i+8,:]=E.permute(3,2,1,0).contiguous().cpu().numpy()
    dust_file[:,:,i:i+8]=dust.permute(2,1,0).contiguous().cpu().numpy()
    scatter_file[:,:,i:i+8,:]=scatter.permute(3,2,1,0).contiguous().cpu().numpy()
    emission_sample.append(E.max(0).values.flatten()[::stride].cpu().numpy());dust_sample.append(dust.flatten()[::stride].cpu().numpy())
    del D,E,dust,scatter,X,Y,Z,points,thinB,thickB,thinOB,oldArmsB,TB,armsB,young,hii,oThin,oBar,oThick,oG,d0,far
    print('composed x',min(i+8,nx),'/',nx,flush=True)
emission_file.flush();dust_file.flush();scatter_file.flush()
if split:smooth_file.flush();sharp_file.flush()
eMax=float(np.quantile(np.concatenate(emission_sample),.9999));dMax=float(np.quantile(np.concatenate(dust_sample),.9999));K=float(opt.get('logK',1e6))
preview=np.memmap(f'{O}/volume.rgba8',dtype='u1',mode='w+',shape=(nz,ny,nx,4))
enc=lambda a,m:np.rint(np.log1p(K*np.clip(a/max(m,1e-30),0,1))/np.log1p(K)*255).astype('u1')
for i in range(0,nx,8):
    preview[:,:,i:i+8,:3]=enc(emission_file[:,:,i:i+8,:],eMax)
    preview[:,:,i:i+8,3]=enc(dust_file[:,:,i:i+8],dMax)
preview.flush()
json.dump({'schema':'cssearth-composed-galaxy-brick@1','physics':PHYSICS,'record':FIT,'dims':[nx,ny,nz],
           'originKpc':[float(bx[0]),float(by[0]),float(bz[0])],'spacingKpc':[DXY,DXY,DZ],
           'frame':'Sun at origin; x toward the Galactic centre (at x=8.277), y toward l=90, z toward the NGP',
           'encoding':{'log1pK':K,'emissionMax':eMax,'dustMax':dMax,'channels':'RGB intrinsic z,r,g emission per kpc; A dust A_r per kpc; preview approximation only'},
           'extinctionPerChannel':[e/1.086 for e in ext],
           'physicalFields':{'emission':'emission.f32','dust':'dust.f32','scatter':'scatter.f32',**({'smooth':'smooth.f32','sharp':'sharp.f32'} if split else {}),'order':'z,y,x,channel; x fastest; little-endian float32'},
           'camera':{k:q[k] for k in ('camRG','camRB','camGR','camGB','camBR','camBG','wbSkyR','wbSkyB','camSaturation')},
           'scatterPolicy':'Add the source only in observables allowed by physics.scatterViews; total extinction always remains',
           'skyPicture':{'nearLight':q['nearLight'],'nearCutKpc':q['nearCutKpc'],'why':'NASA catalog selection nuisance, not applied to the object'},
           'box':BOX,'notes':'Integrate intrinsic bands with saved slabTransfer, then apply the camera once. Native local dust unsharpened. Discs analytic throughout; gridded fields zero outside support.'},open(f'{O}/meta.json','w'),indent=1)
print('COMPOSE BRICK COMPLETE',nx,ny,nz,round(time.time()-t0,1),flush=True)
`;
