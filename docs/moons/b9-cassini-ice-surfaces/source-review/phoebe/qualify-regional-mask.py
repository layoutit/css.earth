"""Source-only coarse Phoebe region, fixed terrain, no spectral brightness cuts.

Rows4..15 bound the independently tested image interval. Corrected incidence and
emission must both stay <=60deg, without terrain shadow, at sampled native poses
and fitted-offset sensitivity corners. This is regional placement qualification,
not invariant exact pixel identity or a global absolute pointing bound.
"""
from pathlib import Path
import hashlib,importlib.util,json,math,os,re,resource,struct,time
assert os.environ.get('OPENBLAS_NUM_THREADS')=='1' and os.environ.get('OMP_NUM_THREADS')=='1'
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[5]
OUT=Path(__file__).resolve().parent
NATIVE=ROOT/'output/b9-source-intake/phoebe/native'
IDENT='1465671822_1'
FIT=json.loads((OUT/'native-registration-fit.json').read_text())
PINS={p['file']:p for p in json.loads((NATIVE/'download-receipts.json').read_text())}
for prefix in ('C','N'):
    path=NATIVE/f'{prefix}{IDENT}_ir.cub'
    assert hashlib.sha256(path.read_bytes()).hexdigest()==PINS[path.name]['sha256']
terrain_path=ROOT/'src/planets/phoebe/prepared/terrain.json';terrain_raw=terrain_path.read_bytes()
assert hashlib.sha256(terrain_raw).hexdigest()==FIT['terrainSha256']
terrain=json.loads(terrain_raw)
tri=np.array([f['vertices'] for f in terrain['faces']],dtype=np.float64)*(106.5/230)
a=tri[:,0];edge1,edge2=tri[:,1]-a,tri[:,2]-a
normals=np.cross(edge1,edge2);normals/=np.linalg.norm(normals,axis=1)[:,None]
camera_path=ROOT/'tools/objects/acquisition/cassini-vims-navigation.py'
spec=importlib.util.spec_from_file_location('native_camera',camera_path);nav=importlib.util.module_from_spec(spec);spec.loader.exec_module(nav)
camera=nav.Camera.from_pair(NATIVE/f'C{IDENT}_ir.cub',NATIVE/f'N{IDENT}_ir.cub',expected_target='PHOEBE',expected_radii_km=(115.,110.,105.),expected_frame_id=10047,ray_only=True)
model=json.loads((OUT/'source-model-comparison.json').read_text())
translation=np.array(model['surfaceRefinement']['translationKm'])
offsets=np.array(FIT['twoAxisFit']['offsetsRadians'])
sensitivity=np.array(FIT['twoAxisFit']['halfFastSampleLinearizedParameterEnvelopePixels'])*np.array(camera.model[:2])
cases=[(0.,0.)]+[(sx*sensitivity[0],sy*sensitivity[1]) for sx,sy in ((-1,-1),(-1,1),(1,-1),(1,1))]
nraw=(NATIVE/f'N{IDENT}_ir.cub').read_bytes();label=nraw[:65536].decode('ascii').rstrip('\0')
sun_text=next(t for t in re.findall(r'Object\s*=\s*Table\s*\n(.*?)End_Object',label,re.S) if nav._field(t,'Name')=='SunPosition')
assert nav._field(sun_text,'Records')=='2' and nav._field(sun_text,'CacheType')=='Linear'
sun_start=int(nav._field(sun_text,'StartByte'))-1;sun_raw=nraw[sun_start:sun_start+112]
sun=np.array(list(struct.iter_unpack('<7d',sun_raw)))


def rz(t):
    c,s=math.cos(t),math.sin(t);return np.array(((c,s,0),(-s,c,0),(0,0,1)))


def rx(t):
    c,s=math.cos(t),math.sin(t);return np.array(((1,0,0),(0,c,s),(0,-s,c)))


def pck(et):
    return rz(math.radians((178.58+931.639*et/86400)%360))@rx(math.radians(90-77.88))@rz(math.radians(90+356.9))


def intersect(observer,ray):
    p=np.cross(np.broadcast_to(ray,edge2.shape),edge2);det=np.einsum('ij,ij->i',edge1,p)
    good=np.abs(det)>1e-12;inv=np.divide(1.,det,out=np.zeros_like(det),where=good)
    tvec=observer-a;u=np.einsum('ij,ij->i',tvec,p)*inv;q=np.cross(tvec,edge1);v=(q@ray)*inv
    distance=np.einsum('ij,ij->i',edge2,q)*inv
    ids=np.flatnonzero(good&(u>=0)&(v>=0)&(u+v<=1)&(distance>1e-7))
    if not len(ids):return None
    index=int(ids[np.argmin(distance[ids])]);return index,observer+distance[index]*ray


def state(x,y,fraction,perturb):
    et=camera.pixel_time(x,y,fraction);body,pointing,observer=camera.state(et);target=pck(et)
    observer,ray=camera.ray(x,y,et,offset_radians=offsets+perturb,state=(body,pointing,observer))
    transfer=target@np.asarray(body).T;observer=transfer@observer+translation;ray=transfer@ray
    hit=intersect(observer,ray)
    if hit is None:return {'supported':False,'reason':'no fixed-terrain hit'}
    face,point=hit
    assert sun[0,-1]<=et<=sun[1,-1]
    weight=(et-sun[0,-1])/(sun[1,-1]-sun[0,-1]);solar=target@((1-weight)*sun[0,:3]+weight*sun[1,:3])+translation
    to_sun=solar-point;to_sun/=np.linalg.norm(to_sun)
    to_sc=observer-point;to_sc/=np.linalg.norm(to_sc)
    incidence=math.degrees(math.acos(np.clip(normals[face]@to_sun,-1,1)))
    emission=math.degrees(math.acos(np.clip(normals[face]@to_sc,-1,1)))
    shadow=intersect(point+normals[face]*1e-6,to_sun) is not None if incidence<=60 and emission<=60 else None
    return {'supported':incidence<=60 and emission<=60 and not shadow,'et':et,'faceIndex':face,
            'pointKm':point.tolist(),'unitRayFixedFrame':ray.tolist(),'observerKm':observer.tolist(),
            'incidenceDegrees':incidence,'emissionDegrees':emission,'shadow':shadow,
            'exposureFraction':fraction,'angularOffsetPerturbation':list(perturb)}


start=time.monotonic();mask=[False]*(camera.width*camera.height);nominal_mask=mask.copy();motion_mask=mask.copy()
accepted=[];rejected=[];nominal_max=[];sampled_max=[]
for y in range(4,16):
    for x in range(camera.width):
        index=y*camera.width+x;mid=state(x,y,.5,(0.,0.))
        if not mid['supported']:continue
        nominal_mask[index]=True
        poses=[state(x,y,f,(0.,0.)) for f in (0.,.25,.5,.75,1.)]
        if not all(p['supported'] for p in poses):
            rejected.append({'lineZeroBased':y,'sampleZeroBased':x,'reason':'nominal exposure poses leave physical region'});continue
        motion_mask[index]=True
        sampled=[state(x,y,f,delta) for delta in cases[1:] for f in (0.,.25,.5,.75,1.)]
        if not all(p['supported'] for p in sampled):
            rejected.append({'lineZeroBased':y,'sampleZeroBased':x,'reason':'sampled fitted-offset sensitivity leaves physical region'});continue
        mask[index]=True;all_poses=poses+sampled
        motion_ground=max(math.dist(p['pointKm'],q['pointKm']) for j,p in enumerate(poses) for q in poses[j+1:])
        motion_ray=max(nav.angular_distance(p['unitRayFixedFrame'],q['unitRayFixedFrame']) for j,p in enumerate(poses) for q in poses[j+1:])
        sensitivity_ground=max(math.dist(mid['pointKm'],p['pointKm']) for p in sampled)
        longitude,latitude=nav.longitude_latitude(mid['pointKm'])
        accepted.append({'lineZeroBased':y,'sampleZeroBased':x,'nativeFlatIndex':index,
                         'nominal':mid,'longitudeLatitudeDegrees':[longitude,latitude],
                         'sampledMaximumIncidenceDegrees':max(p['incidenceDegrees'] for p in all_poses),
                         'sampledMaximumEmissionDegrees':max(p['emissionDegrees'] for p in all_poses),
                         'sampledFullExposureGroundMotionKm':motion_ground,
                         'sampledFullExposureCenterRayMotionRadians':motion_ray,
                         'sampledSensitivityMaximumCenterGroundDisplacementKm':sensitivity_ground,
                         'nativePhocubeResolutionMeters':camera.navigation[6][index]})
rows={str(y):[x for x in range(camera.width) if mask[y*camera.width+x]] for y in range(camera.height)}
record=json.loads((OUT/f'candidate-prediction-{IDENT}-ir.json').read_text());values=record['nativeBandIf'];lo,hi=min(values),max(values)
im=Image.new('RGB',(camera.width,camera.height));pixels=[]
for i,v in enumerate(values):
    g=round(255*(v-lo)/(hi-lo));pixels.append((g,g,g) if mask[i] else (int(g*.35),int(g*.18),int(g*.18)))
im.putdata(pixels);im=im.resize((camera.width*16,camera.height*16),Image.Resampling.NEAREST)
panel=Image.new('RGB',(1020,550),'#171b22');draw=ImageDraw.Draw(panel);font,small=ImageFont.load_default(size=17),ImageFont.load_default(size=13)
draw.text((20,15),'Phoebe IR1822: coarse registered interior',font=font,fill='white')
draw.text((20,42),'Native1.80374um for context only. Full grayscale = retained; dark red = outside the geometric policy.',font=small,fill='#bec8d2')
draw.text((20,64),f'Rows4-15; i/e <=60deg, visible and unshadowed at25 pose/offset scenarios. {sum(mask)} of864 source pixels.',font=small,fill='#bec8d2')
panel.paste(im,(20,105));panel.save(OUT/'regional-mask.png')
result={'schema':'cssearth-phoebe-coarse-registered-region@1','observationId':IDENT,'channel':'IR','width':camera.width,'height':camera.height,
        'scope':'Coarse regional placement under the fitted nominal mapping. Source pixel owners identify original measurements, not exact absolute surface position. No source brightness or index value controls this mask.',
        'policy':{'sourceRowsInclusive':[4,15],'maximumIncidenceDegrees':60,'maximumEmissionDegrees':60,
                  'surface':'Unchanged3500-face prepared2023Phoebe terrain; closest positive hit; source Sun vector and terrain self-shadow test.',
                  'exposureFractions':[0.,.25,.5,.75,1.],
                  'sensitivityOffsetsRadians':cases,
                  'sensitivityMeaning':FIT['twoAxisFit']['envelopeLimit'],
                  'acceptance':'Retain only original pixels whose centers satisfy the regional cuts in all25 sampled exposure/offset combinations. This is not a detector-footprint coverage mask or a continuous-motion bound.',
                  'mappingLimit':'Evaluate actual detector apertures and acquisition times against fixed terrain separately. Do not connect native scan lines or interpolate across unavailable source pixels.'},
        'fitOffsetsRadians':offsets.tolist(),'fitOffsetsNativeSamplingPixels':FIT['twoAxisFit']['offsetsNativeSamplingPixels'],
        'nominalPhysicalPixelCount':sum(nominal_mask),'nominalFullExposurePhysicalPixelCount':sum(motion_mask),'retainedPixelCount':sum(mask),
        'allowedColumnsBySourceRowZeroBased':rows,'nativePixelMask':mask,'acceptedPixels':accepted,'nominallyPassingButWithheld':rejected,
        'fitReceiptSha256':hashlib.sha256((OUT/'native-registration-fit.json').read_bytes()).hexdigest(),
        'terrainSha256':FIT['terrainSha256'],'cameraModuleSha256':hashlib.sha256(camera_path.read_bytes()).hexdigest(),
        'sunTableSha256':hashlib.sha256(sun_raw).hexdigest(),
        'sourcePins':[PINS[f'{p}{IDENT}_ir.cub'] for p in ('C','N')],
        'maximumSampledFullExposureGroundMotionKm':max(p['sampledFullExposureGroundMotionKm'] for p in accepted) if accepted else None,
        'maximumSampledFullExposureRayMotionFastSamples':max(p['sampledFullExposureCenterRayMotionRadians'] for p in accepted)/camera.model[0] if accepted else None,
        'maximumSampledSensitivityCenterDisplacementKm':max(p['sampledSensitivityMaximumCenterGroundDisplacementKm'] for p in accepted) if accepted else None,
        'wallSeconds':time.monotonic()-start,'peakRssBytesMacOS':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
assert hashlib.sha256(terrain_path.read_bytes()).hexdigest()==FIT['terrainSha256'];result['terrainUnchanged']=True
(OUT/'regional-mask.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ('nativePixelMask','acceptedPixels','nominallyPassingButWithheld','sourcePins','policy')},indent=2))
