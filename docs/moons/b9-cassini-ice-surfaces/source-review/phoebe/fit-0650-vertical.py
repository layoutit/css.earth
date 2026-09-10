"""Separate IR0650 two-offset fit, frozen top/bottom training and holdouts.

Static mean-ET projection initializes the fit only. The final training objective
and untouched holdouts use the full archived pose varying with fractional line.
Fractional lines parameterize an image boundary, never detector coverage.
"""
from pathlib import Path
import hashlib,importlib.util,json,math,os,resource,time
assert os.environ.get('OPENBLAS_NUM_THREADS')=='1' and os.environ.get('OMP_NUM_THREADS')=='1'
import numpy as np
from scipy.optimize import least_squares
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[5];OUT=Path(__file__).resolve().parent;NATIVE=ROOT/'output/b9-source-intake/phoebe/native'
IDENT='1465670650_1';terrain_path=ROOT/'src/planets/phoebe/prepared/terrain.json';terrain_raw=terrain_path.read_bytes()
TERRAIN_SHA='a6eb3c92075986288ddfc6e59d85391891ca0d96dc0f2c427ea7fbab2e576178'
assert hashlib.sha256(terrain_raw).hexdigest()==TERRAIN_SHA
terrain=json.loads(terrain_raw);tri=np.array([f['vertices'] for f in terrain['faces']])*(106.5/230);flat=tri.reshape(-1,3)
edge1,edge2=tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]
pins={p['file']:p for p in json.loads((NATIVE/'download-receipts.json').read_text())}
for prefix in ('C','N'):
    path=NATIVE/f'{prefix}{IDENT}_ir.cub';assert hashlib.sha256(path.read_bytes()).hexdigest()==pins[path.name]['sha256']
camera_path=ROOT/'tools/objects/acquisition/cassini-vims-navigation.py';spec=importlib.util.spec_from_file_location('native_camera',camera_path)
nav=importlib.util.module_from_spec(spec);spec.loader.exec_module(nav)
camera=nav.Camera.from_pair(NATIVE/f'C{IDENT}_ir.cub',NATIVE/f'N{IDENT}_ir.cub',expected_target='PHOEBE',expected_radii_km=(115.,110.,105.),expected_frame_id=10047,ray_only=True)
model=json.loads((OUT/'source-model-comparison.json').read_text());translation=np.array(model['surfaceRefinement']['translationKm'])
source=json.loads((OUT/'0650-vertical-candidates.json').read_text())
families={f['name']:{p['sampleZeroBased']:p['linePosition'] for p in f['candidates']} for f in source['families']}
TRAIN=(('top-rising',0),('top-rising',1),('top-rising',2),('bottom-falling',12),('bottom-falling',13),('bottom-falling',14))
HOLDOUT=tuple(('top-rising',x) for x in (5,6,7,8,9,10,12,13,14))+tuple(('bottom-falling',x) for x in (6,9,10))


def rz(t):
    c,s=math.cos(t),math.sin(t);return np.array(((c,s,0),(-s,c,0),(0,0,1)))


def rx(t):
    c,s=math.cos(t),math.sin(t);return np.array(((1,0,0),(0,c,s),(0,-s,c)))


def pck(et):
    return rz(math.radians((178.58+931.639*et/86400)%360))@rx(math.radians(90-77.88))@rz(math.radians(90+356.9))


def fractional_time(x,y):
    # This continuous parameter is only for locating a boundary between actual
    # native line measurements, never for filling their unsampled time gap.
    if not 0<=y<=camera.height-1:raise ValueError('Image-boundary parameter leaves native line-center interval')
    lo=min(int(math.floor(y)),camera.height-2)
    return camera.pixel_time(x,lo)+(y-lo)*(camera.pixel_time(x,lo+1)-camera.pixel_time(x,lo))


def item(key):
    family,x=key;y=families[family][x];et=fractional_time(x,y)
    body,pointing,observer=camera.state(et);fixed=pck(et)
    observer=fixed@np.asarray(body).T@observer+translation
    instrument=(flat-observer)@(np.asarray(camera.constant)@np.asarray(pointing)@fixed.T).T
    unit=instrument/np.linalg.norm(instrument,axis=1)[:,None]
    px,py,bx,by,ox,oy=camera.model
    u=(np.arctan2(-unit[:,2],unit[:,0])+math.pi/2)/px-ox+bx
    v=(math.pi/2-np.arccos(unit[:,1]))/py-oy+by
    uv=np.stack((u,v),axis=-1).reshape(-1,3,2)
    return {'family':family,'x':x,'y':y,'et':et,'edgeA':uv.reshape(-1,2),'edgeB':uv[:,[1,2,0],:].reshape(-1,2)}


def projected_boundary(p,offset):
    x=p['x']+offset[0];a,b=p['edgeA'],p['edgeB'];dx=b[:,0]-a[:,0]
    valid=(np.minimum(a[:,0],b[:,0])<=x)&(np.maximum(a[:,0],b[:,0])>=x)&(np.abs(dx)>1e-12)
    if not np.any(valid):raise ValueError('Candidate offsets leave the observed column without a terrain silhouette')
    t=(x-a[valid,0])/dx[valid];ys=a[valid,1]+t*(b[valid,1]-a[valid,1])
    return float((min(ys) if p['family']=='top-rising' else max(ys))-offset[1])


def hit(observer,ray):
    p=np.cross(np.broadcast_to(ray,edge2.shape),edge2);det=np.einsum('ij,ij->i',edge1,p);good=np.abs(det)>1e-12
    inv=np.divide(1.,det,out=np.zeros_like(det),where=good);tvec=observer-tri[:,0];u=np.einsum('ij,ij->i',tvec,p)*inv
    q=np.cross(tvec,edge1);v=(q@ray)*inv;distance=np.einsum('ij,ij->i',edge2,q)*inv
    return bool(np.any(good&(u>=0)&(v>=0)&(u+v<=1)&(distance>1e-7)))


def exact_boundary(p,offset,full_timing=True):
    def inside(y):
        et=fractional_time(p['x'],y) if full_timing else p['et'];base=min(max(int(math.floor(y)),0),camera.height-1)
        body,pointing,observer=camera.state(et)
        angular=(offset[0]*camera.model[0],(y-base+offset[1])*camera.model[1])
        observer,ray=camera.ray(p['x'],base,et,angular,state=(body,pointing,observer));transfer=pck(et)@np.asarray(body).T
        return hit(transfer@observer+translation,transfer@ray)
    expected=projected_boundary(p,offset);top=p['family']=='top-rising'
    for width in (.25,.5,1.,2.,4.):
        lo,hi=max(0.,expected-width),min(camera.height-1.,expected+width)
        if lo>=hi:continue
        if inside(lo)==(not top) and inside(hi)==top:break
    else:raise ValueError('No independent exact-ray silhouette crossing bracket for '+str((p['family'],p['x'],offset.tolist())))
    for _ in range(24):
        mid=(lo+hi)/2
        if inside(mid)==top:hi=mid
        else:lo=mid
    return (lo+hi)/2


def residual(offset,points,full):
    return np.array([(exact_boundary(p,offset) if full else projected_boundary(p,offset))-p['y'] for p in points])


def fit(points,initial,full,bounds=(-np.inf,np.inf)):
    solution=least_squares(residual,initial,args=(points,full),bounds=bounds,max_nfev=75,ftol=1e-9,xtol=1e-9,gtol=1e-8,diff_step=1e-3)
    if not solution.success:raise ValueError('Bounded independent0650fit did not converge')
    singular=np.linalg.svd(solution.jac,compute_uv=False);inverse=np.linalg.pinv(solution.jac)
    return solution,{'offsetsNativeSamplingPixels':solution.x.tolist(),'offsetsRadians':(solution.x*np.array(camera.model[:2])).tolist(),
                     'trainingResidualsSlowPixels':solution.fun.tolist(),'trainingRmsSlowPixels':float(np.sqrt(np.mean(solution.fun**2))),
                     'jacobianSingularValues':singular.tolist(),'jacobianCondition':float(singular[0]/singular[-1]),'evaluations':solution.nfev,
                     'halfSlowSampleLinearizedParameterEnvelopePixels':(.5*np.sum(np.abs(inverse),axis=1)).tolist(),
                     'envelopeLimit':'Worst-case linearized response to independent+/-0.5slow-sample training-edge perturbations. Sampling sensitivity only; not absolute pointing, confidence interval, continuous exposure or PSF precision.'}


start=time.monotonic();train=[item(k) for k in TRAIN];holdout=[item(k) for k in HOLDOUT]
# Zero offset need not put every observed column through the predicted body.
# Derive a feasible interval from TRAINING projected body extents, not another
# observation's correction. Its midpoint initializes only the mean-ET solve.
lower=max(float(np.min(p['edgeA'][:,0]))-p['x'] for p in train)+1e-6
upper=min(float(np.max(p['edgeA'][:,0]))-p['x'] for p in train)-1e-6
if lower>=upper:raise ValueError('Training source columns have no common constant-offset silhouette interval')
initial,initial_receipt=fit(train,((lower+upper)/2,0.),False,([lower,-np.inf],[upper,np.inf]))
initial_receipt['trainingDerivedFeasibleFastOffsetIntervalPixels']=[lower,upper]
solution,fit_receipt=fit(train,initial.x,True)
checks=[]
for partition,points in (('train',train),('holdout',holdout)):
    for p in points:
        exact=exact_boundary(p,solution.x);mean=exact_boundary(p,solution.x,False)
        checks.append({'partition':partition,'family':p['family'],'sampleZeroBased':p['x'],'sourceLinePosition':p['y'],
                       'meanEtExactRayBoundaryLine':mean,'fullTimingExactRayBoundaryLine':exact,'meanEtVersusFullTimingSlowPixels':mean-exact,
                       'sourceMinusFullTimingSlowPixels':p['y']-exact,'sourceGradientMeanET':p['et']})
record=json.loads((OUT/f'native-prediction-{IDENT}-ir.json').read_text());w,h=record['width'],record['height'];v=record['nativeBandIf'];lo,hi=min(v),max(v)
im=Image.new('RGB',(w,h));im.putdata([(g,g,g) for g in [round(255*(x-lo)/(hi-lo)) for x in v]])
im=im.resize((w*16,h*16),Image.Resampling.NEAREST);d=ImageDraw.Draw(im)
for c in checks:
    x=c['sampleZeroBased'];y=c['sourceLinePosition'];col='#f29652' if c['partition']=='train' else '#f04bd5'
    d.line(((x+.1)*16,(y+.5)*16,(x+.9)*16,(y+.5)*16),fill=col,width=3)
    y=c['fullTimingExactRayBoundaryLine'];d.line(((x+.1)*16,(y+.5)*16,(x+.9)*16,(y+.5)*16),fill='#19e4e8',width=2)
panel=Image.new('RGB',(1120,550),'#171b22');draw=ImageDraw.Draw(panel);font,small=ImageFont.load_default(size=17),ImageFont.load_default(size=13)
draw.text((20,15),'IR0650: separate top/bottom fit with full native scan timing',font=font,fill='white')
draw.text((20,42),'Orange=training, magenta=untouched holdout, cyan=full-timing exact-ray boundary. No copied1822offset.',font=small,fill='#bec8d2')
draw.text((20,64),'Interpolated line boundary is for registration only; unsampled line gaps stay missing in any mapper.',font=small,fill='#bec8d2')
panel.paste(im,(20,105));panel.save(OUT/'0650-registration-fit.png')
result={'schema':'cssearth-phoebe-0650-native-vertical-offset-fit@1','observationId':IDENT,'scope':'Candidate separate two-offset source-acquisition registration; no mapping acceptance from fit alone.',
        'trainingFamiliesAndColumns':TRAIN,'holdoutFamiliesAndColumns':HOLDOUT,'constantMeanEtInitialization':initial_receipt,'fullTimingTwoOffsetFit':fit_receipt,
        'independentChecks':checks,'method':'Fixed3500-face terrain. Two constant IR phi/negative-theta look offsets; six continuum boundary points train. Initial mean-ET projection is replaced by full archived time/pose along the image-boundary crossing. No pole, origin, scale, tracking, albedo or ice fit.',
        'fractionalLineLimit':'Between-line boundary interpolation locates an image edge; it is not an exposure or source surface support. Only actual detector apertures/times can map source values.',
        'sourceEdgeReceiptSha256':hashlib.sha256((OUT/'0650-vertical-candidates.json').read_bytes()).hexdigest(),
        'terrainSha256':TERRAIN_SHA,'cameraModuleSha256':hashlib.sha256(camera_path.read_bytes()).hexdigest(),
        'sourcePins':[pins[f'{p}{IDENT}_ir.cub'] for p in ('C','N')],
        'nativeSameColumnLineMidpointSeparationSeconds':camera.pixel_time(0,1)-camera.pixel_time(0,0),
        'wallSeconds':time.monotonic()-start,'peakRssBytesMacOS':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
assert hashlib.sha256(terrain_path.read_bytes()).hexdigest()==TERRAIN_SHA;result['terrainUnchanged']=True
(OUT/'0650-registration-fit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'fit':fit_receipt,'checks':checks,'wallSeconds':result['wallSeconds'],'peakRssBytesMacOS':result['peakRssBytesMacOS']},indent=2))
