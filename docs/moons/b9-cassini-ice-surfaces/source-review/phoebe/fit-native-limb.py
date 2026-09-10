"""Bounded source-only constant-look-offset fit; fixed Phoebe mesh is read-only.

Six predeclared continuum-limb rows train two angular offsets. Seven separated
rows remain untouched. No tracking, scale, pole, origin, albedo or ice fit.
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import math
import os
import resource
import time

assert os.environ.get('OPENBLAS_NUM_THREADS') == '1'
assert os.environ.get('OMP_NUM_THREADS') == '1'
import numpy as np
from scipy.optimize import least_squares
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[5]
OUT=Path(__file__).resolve().parent
NATIVE=ROOT/'output/b9-source-intake/phoebe/native'
IDENT='1465671822_1'
TRAIN_ROWS=(0,1,2,10,11,12)
HOLDOUT_ROWS=(4,5,6,7,8,14,15)
TERRAIN_SHA='a6eb3c92075986288ddfc6e59d85391891ca0d96dc0f2c427ea7fbab2e576178'
terrain_path=ROOT/'src/planets/phoebe/prepared/terrain.json'
terrain_raw=terrain_path.read_bytes()
assert hashlib.sha256(terrain_raw).hexdigest()==TERRAIN_SHA
terrain=json.loads(terrain_raw)
assert len(terrain['faces'])==3500
tri=np.array([f['vertices'] for f in terrain['faces']],dtype=np.float64)*(106.5/230)
flat=tri.reshape(-1,3)
pins={p['file']:p for p in json.loads((NATIVE/'download-receipts.json').read_text())}
for prefix in ('C','N'):
    p=NATIVE/f'{prefix}{IDENT}_ir.cub'
    assert hashlib.sha256(p.read_bytes()).hexdigest()==pins[p.name]['sha256']
camera_path=ROOT/'tools/objects/acquisition/cassini-vims-navigation.py'
spec=importlib.util.spec_from_file_location('native_camera',camera_path)
nav=importlib.util.module_from_spec(spec);spec.loader.exec_module(nav)
camera=nav.Camera.from_pair(NATIVE/f'C{IDENT}_ir.cub',NATIVE/f'N{IDENT}_ir.cub',expected_target='PHOEBE',expected_radii_km=(115.,110.,105.),expected_frame_id=10047,ray_only=True)
edges=json.loads((OUT/'native-gradient-holdouts.json').read_text())
observation=next(o for o in edges['observations'] if o['observationId']==IDENT and o['channel']=='ir')
sources={p['lineZeroBased']:p for p in observation['candidates']}
assert all(y in sources for y in TRAIN_ROWS+HOLDOUT_ROWS)
model=json.loads((OUT/'source-model-comparison.json').read_text())
translation=np.array(model['surfaceRefinement']['translationKm'])


def rz(t):
    c,s=math.cos(t),math.sin(t)
    return np.array(((c,s,0),(-s,c,0),(0,0,1)))


def rx(t):
    c,s=math.cos(t),math.sin(t)
    return np.array(((1,0,0),(0,c,s),(0,-s,c)))


def pck(et):
    return rz(math.radians((178.58+931.639*et/86400)%360)) @ rx(math.radians(90-77.88)) @ rz(math.radians(90+356.9))


def projected_edges(y, displacement):
    # A native first difference is between two exposure-center measurements.
    # Use their mean time; the source location is the half-sample between them.
    x=sources[y]['sourceGradientSample']
    left=int(math.floor(x))
    et=(camera.pixel_time(left,y)+camera.pixel_time(left+1,y))/2
    body,pointing,observer=camera.state(et)
    fixed=pck(et)
    observer=fixed @ np.asarray(body).T @ observer+displacement
    frame=np.asarray(camera.constant) @ np.asarray(pointing) @ fixed.T
    instrument=(flat-observer) @ frame.T
    unit=instrument/np.linalg.norm(instrument,axis=1)[:,None]
    px,py,bx,by,ox,oy=camera.model
    u=(np.arctan2(-unit[:,2],unit[:,0])+math.pi/2)/px-ox+bx
    v=(math.pi/2-np.arccos(unit[:,1]))/py-oy+by
    uv=np.stack((u,v),axis=-1).reshape(-1,3,2)
    a=uv.reshape(-1,2)
    b=uv[:,[1,2,0],:].reshape(-1,2)
    return {'line':y,'sourceSample':x,'et':et,'edgeA':a,'edgeB':b,
            'observer':observer,'fixedRotation':fixed,'state':(body,pointing,camera.state(et)[2])}


def boundary(item, offsets):
    # Constant angular look offsets shift projected native coordinates exactly.
    # Straight projected edges approximate the tiny spherical-angle curvature;
    # the fitted boundary is independently checked by exact 3D ray crossings.
    target_y=item['line']+offsets[1]
    a,b=item['edgeA'],item['edgeB']
    dy=b[:,1]-a[:,1]
    spans=(np.minimum(a[:,1],b[:,1])<=target_y)&(np.maximum(a[:,1],b[:,1])>=target_y)&(np.abs(dy)>1e-12)
    if not np.any(spans):
        raise ValueError('Proposed offset has no fixed-surface silhouette on this native row')
    fraction=(target_y-a[spans,1])/dy[spans]
    u=a[spans,0]+fraction*(b[spans,0]-a[spans,0])
    return float(np.min(u)-offsets[0])


def residual(offsets,items):
    return np.array([boundary(p,offsets)-p['sourceSample'] for p in items])


def fit(items,initial):
    solution=least_squares(residual,initial,args=(items,),max_nfev=100,ftol=1e-10,xtol=1e-10,gtol=1e-10,diff_step=1e-4)
    if not solution.success:
        raise ValueError('Bounded offset fit did not converge')
    singular=np.linalg.svd(solution.jac,compute_uv=False)
    inverse=np.linalg.pinv(solution.jac)
    return solution,{'offsetsNativeSamplingPixels':solution.x.tolist(),
                     'offsetsRadians':(solution.x*np.array(camera.model[:2])).tolist(),
                     'trainingResidualsPixels':solution.fun.tolist(),
                     'trainingRmsPixels':float(np.sqrt(np.mean(solution.fun**2))),
                     'evaluations':solution.nfev,'jacobianSingularValues':singular.tolist(),
                     'jacobianCondition':float(singular[0]/singular[-1]),
                     'halfFastSampleLinearizedParameterEnvelopePixels':(.5*np.sum(np.abs(inverse),axis=1)).tolist(),
                     'envelopeLimit':'Worst-case linearized parameter response to independent +/-0.5 fast-axis sample perturbations of training edge positions. Sampling sensitivity only; no statistical confidence or PSF/absolute-pointing bound.'}


edge1,edge2=tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]


def exact_hit(observer,ray):
    p=np.cross(np.broadcast_to(ray,edge2.shape),edge2)
    determinant=np.einsum('ij,ij->i',edge1,p)
    good=np.abs(determinant)>1e-12
    inv=np.divide(1.,determinant,out=np.zeros_like(determinant),where=good)
    tvec=observer-tri[:,0]
    u=np.einsum('ij,ij->i',tvec,p)*inv
    q=np.cross(tvec,edge1)
    v=(q@ray)*inv
    distance=np.einsum('ij,ij->i',edge2,q)*inv
    return bool(np.any(good&(u>=0)&(v>=0)&(u+v<=1)&(distance>1e-7)))


def exact_boundary(item,offsets):
    x=item['sourceSample'];left=int(math.floor(x));y=item['line'];et=item['et']
    def inside(sample):
        angular=((sample-left+offsets[0])*camera.model[0],offsets[1]*camera.model[1])
        observer,ray=camera.ray(left,y,et,angular)
        body=item['state'][0]
        transfer=item['fixedRotation'] @ np.asarray(body).T
        return exact_hit(transfer@observer+translation,transfer@ray)
    expected=boundary(item,offsets)
    lo,hi=expected-.1,expected+.1
    if inside(lo) or not inside(hi):
        raise ValueError('Projected edge failed the independent +/-0.1sample exact-ray bracket')
    for _ in range(25):
        mid=(lo+hi)/2
        if inside(mid):hi=mid
        else:lo=mid
    return (lo+hi)/2


start=time.monotonic()
items={y:projected_edges(y,translation) for y in TRAIN_ROWS+HOLDOUT_ROWS}
train=[items[y] for y in TRAIN_ROWS]
holdout=[items[y] for y in HOLDOUT_ROWS]
one_axis=float(np.mean([boundary(p,(0,0))-p['sourceSample'] for p in train]))
solution,fit_receipt=fit(train,(one_axis,0))
leave_one=[]
for omitted in TRAIN_ROWS:
    _,trial=fit([items[y] for y in TRAIN_ROWS if y!=omitted],solution.x)
    leave_one.append({'omittedLineZeroBased':omitted,**trial})
groups=[]
for rows in (TRAIN_ROWS[:3],TRAIN_ROWS[3:]):
    _,trial=fit([items[y] for y in rows],solution.x)
    groups.append({'trainingLinesZeroBased':rows,**trial})
alternative_translation=np.array(model['estimatedOldTo2023TranslationKm'])
alternative_items={y:projected_edges(y,alternative_translation) for y in TRAIN_ROWS+HOLDOUT_ROWS}
alternative_solution,alternative_fit=fit([alternative_items[y] for y in TRAIN_ROWS],solution.x)
alternative_fit.update(translationKm=alternative_translation.tolist(),
                       differenceFromPrimaryTranslationKm=float(np.linalg.norm(alternative_translation-translation)),
                       differenceFromPrimaryOffsetsPixels=(alternative_solution.x-solution.x).tolist(),
                       holdoutResidualsPixels=residual(alternative_solution.x,[alternative_items[y] for y in HOLDOUT_ROWS]).tolist(),
                       qualification='Sensitivity to the previously measured alternate origin estimator; no new source-model fit and no absolute origin uncertainty bound.')
exact=[]
for y,p in items.items():
    predicted=boundary(p,solution.x)
    actual=exact_boundary(p,solution.x)
    exact.append({'lineZeroBased':y,'partition':'train' if y in TRAIN_ROWS else 'holdout',
                  'sourceSample':p['sourceSample'],'unfittedPredictedBoundarySample':boundary(p,(0,0)),
                  'fittedProjectedBoundarySample':predicted,'fittedExactRayBoundarySample':actual,
                  'projectionApproximationPixels':predicted-actual,'sourceMinusExactPredictionPixels':p['sourceSample']-actual})
record=json.loads((OUT/f'native-prediction-{IDENT}-ir.json').read_text())
w,h=record['width'],record['height'];measured=record['nativeBandIf'];low,high=min(measured),max(measured)
im=Image.new('RGB',(w,h));im.putdata([(g,g,g) for g in [round(255*(v-low)/(high-low)) for v in measured]])
im=im.resize((w*16,h*16),Image.Resampling.NEAREST)
d=ImageDraw.Draw(im)
for p in exact:
    y=p['lineZeroBased'];col='#f29652' if p['partition']=='train' else '#f04bd5'
    x=p['sourceSample'];d.line(((x+.5)*16,(y+.1)*16,(x+.5)*16,(y+.9)*16),fill=col,width=3)
    x=p['fittedExactRayBoundarySample'];d.line(((x+.5)*16,(y+.1)*16,(x+.5)*16,(y+.9)*16),fill='#19e4e8',width=2)
panel=Image.new('RGB',(900,560),'#171b22');draw=ImageDraw.Draw(panel)
font,small=ImageFont.load_default(size=17),ImageFont.load_default(size=13)
draw.text((20,15),'1465671822 IR: fit two constant native look offsets',font=font,fill='white')
draw.text((20,42),'Orange = training source gradient; magenta = untouched source holdout; cyan = exact fitted ray boundary.',font=small,fill='#bec8d2')
draw.text((20,64),'Fixed3500-face terrain. No ice-value, scale, pole, origin, photometry or tracking fit.',font=small,fill='#bec8d2')
panel.paste(im,(20,108));panel.save(OUT/'native-registration-fit.png')
result={'schema':'cssearth-phoebe-native-limb-offset-fit@1','observationId':IDENT,
        'scope':'Candidate source-acquisition registration. Two constant IR look offsets fitted only to predeclared original continuum limb gradients; not a mapped-surface acceptance or physical spacecraft correction.',
        'trainingRowsZeroBased':TRAIN_ROWS,'holdoutRowsZeroBased':HOLDOUT_ROWS,
        'sourceEdgeReceiptSha256':hashlib.sha256((OUT/'native-gradient-holdouts.json').read_bytes()).hexdigest(),
        'terrainSha256':TERRAIN_SHA,'cameraModuleSha256':hashlib.sha256(camera_path.read_bytes()).hexdigest(),
        'fullSourcePins':[pins[f'{p}{IDENT}_ir.cub'] for p in ('C','N')],
        'method':{'timing':'Mean of the two adjacent native exposure midpoint times for each measured gradient position.',
                  'offsets':'Constant angular offsets added to IR look phi and negative theta, in native fast/slow sampling-pitch units. Image-plane calibration fit, not new SPICE pointing.',
                  'boundary':'Leftmost angular projection of existing terrain triangles at each source acquisition time, independently checked by exact original-camera rays and fixed triangle intersections.',
                  'selection':'Source-only dual-continuum candidates; two separated training patches and two intervening/separated holdout patches; no post-fit rejection.',
                  'sourceLimits':'Native limb gradients and center-cell locations have finite aperture, sampling, spectral reflectance and PSF dependence. Constant offsets do not model tracking errors, rotation, distortion or temporal response.'},
        'oneAxisFastOffsetPixels':one_axis,
        'oneAxisTrainingResidualsPixels':residual((one_axis,0),train).tolist(),
        'oneAxisHoldoutResidualsPixels':residual((one_axis,0),holdout).tolist(),
        'twoAxisFit':fit_receipt,'leaveOneTrainingRowOut':leave_one,'trainingPatchFits':groups,
        'alternatePreviouslyEstimatedOrigin':alternative_fit,
        'independentExactRayResults':exact,
        'sourceShapeScaleComparisons':{'displayEstimatedSimplificationErrorMeters':terrain['simplification']['estimatedErrorMeters'],
                                     'observerCenterRangesKm':[float(np.linalg.norm(p['observer'])) for p in items.values()],
                                     'minimumCenterRangeSamplingPitchKm':(min(np.linalg.norm(p['observer']) for p in items.values())*np.array(camera.model[:2])).tolist(),
                                     'estimatedDisplayErrorOverMinimumFastSamplingPitch':float(terrain['simplification']['estimatedErrorMeters']/1000/(min(np.linalg.norm(p['observer']) for p in items.values())*camera.model[0])),
                                     'limitation':'Preparation estimate and old/new source residuals do not establish an absolute pointing uncertainty. No shape changes or new model fit performed.'},
        'wallSeconds':time.monotonic()-start,'peakRssBytesMacOS':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
assert hashlib.sha256(terrain_path.read_bytes()).hexdigest()==TERRAIN_SHA
result['terrainUnchanged']=True
(OUT/'native-registration-fit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'fit':fit_receipt,'exactRayResults':exact,'wallSeconds':result['wallSeconds'],'peakRssBytesMacOS':result['peakRssBytesMacOS']},indent=2))
