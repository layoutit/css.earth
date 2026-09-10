"""Small numerical source-area scale estimate; not mapped or union coverage."""
from pathlib import Path
import hashlib,json,math,statistics
OUT=Path(__file__).resolve().parent
r=json.loads((OUT/'regional-mask.json').read_text())
areas=[]
for p in r['acceptedPixels']:
    n=p['nominal'];range_km=math.dist(n['observerKm'],n['pointKm'])
    areas.append(range_km**2*.00025*.0005/math.cos(math.radians(n['emissionDegrees'])))
secondary=json.loads((OUT/'secondary-image-candidates.json').read_text())
checks=[]
for o in secondary['observations']:
    if o['observationId']!='1465671822_1':continue
    p=json.loads((OUT/('candidate-prediction-1465671822_1-ir.json' if o['channel']=='ir' else 'native-prediction-1465671822_1-vis.json')).read_text());w=p['width']
    candidates=[]
    for c in o['candidates']:
        y=c['lineZeroBased'];xs=[x for x in range(w) if (p['predictedLambert'][y*w+x]>0 if o['channel']=='ir' else p['predictedHit'][y*w+x])]
        expected=(max(xs)+.5 if o['channel']=='ir' else min(xs)-.5) if xs else None
        candidates.append({**c,'predictedCenterCellBoundarySample':expected,'sourceMinusPredictionPixels':c['samplePosition']-expected if expected is not None else None})
    checks.append({'channel':o['channel'],'prediction':'fitted IR candidate' if o['channel']=='ir' else 'unmodified VIS native camera','candidates':candidates,
                   'interpretation':'Gradient extrema can be interior terrain/photometric features; no candidates influenced the two-offset fit. A nonmatching falling gradient does not by itself prove a pointing error.'})
result={'regionReceiptSha256':hashlib.sha256((OUT/'regional-mask.json').read_bytes()).hexdigest(),
        'nativeFramePixelCount':r['width']*r['height'],
        'nominalFullExposureSafe':{'pixels':r['nominalFullExposurePhysicalPixelCount'],'fractionOfNativeFrame':r['nominalFullExposurePhysicalPixelCount']/(r['width']*r['height'])},
        'sensitivitySafe':{'pixels':r['retainedPixelCount'],'fractionOfNativeFrame':r['retainedPixelCount']/(r['width']*r['height'])},
        'nativePhysicalAreaScale':{'method':'Nominal instantaneous0.25x0.5mrad rectangular detector projected onto each accepted center tangent plane: slantRangeKm^2*0.00025*0.0005/cos(emission).',
                                 'count':len(areas),'minimumKm2':min(areas),'medianKm2':statistics.median(areas),'maximumKm2':max(areas),'sumKm2':sum(areas),
                                 'limits':'Scale estimate only, not unique covered surface area. Does not subtract overlap or account for finite triangle edges, curvature, obstruction, PSF, exposure motion or pointing uncertainty. Global map coverage must come from the qualified mapper.',
                                 'apertureSource':'https://pds-rings.seti.org/pds4/bundles/cassini_vims/cassini_vims_cruise/document/vims-wavelength-and-radiometric-calibration-report.pdf'},
        'untouchedSecondaryFeatureComparison':checks}
(OUT/'regional-summary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='untouchedSecondaryFeatureComparison'},indent=2))
