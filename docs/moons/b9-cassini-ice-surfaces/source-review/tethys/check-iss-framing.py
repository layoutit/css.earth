#!/usr/bin/env python3
"""Small original Tethys VIMS versus pinned USGS ISS gross-framing check.

Run with the existing numerical Python environment in a reserved serial slot.
No fits, source warps, photometric corrections or image-wide raster arrays.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import resource
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]


def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(65536),b''):
            h.update(block)
    return h.hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recipe',type=Path,default=ROOT/'output/b9-source-intake/tethys/prepare-trial.json')
    parser.add_argument('--output',type=Path,default=HERE/'iss-framing.json')
    args=parser.parse_args()
    import numpy as np
    import rasterio
    from PIL import Image, ImageDraw, ImageFont
    from scipy.stats import rankdata
    start=time.monotonic()
    native=load('independent_native_planes',HERE/'inspect-spectral-planes.py')
    quality=load('frozen_quality',ROOT/'tools/objects/acquisition/cassini-vims-detector-quality.py')
    manifest_path=ROOT/'src/planets/tethys/source/manifest.json'
    manifest=json.loads(manifest_path.read_text())
    entry=next(x for x in manifest['inputs'] if x['id']=='cassini-iss-2012-tethys')
    iss=manifest_path.parent/entry['path']
    if iss.stat().st_size!=entry['expectedBytes'] or digest(iss)!=entry['expectedSha256']:
        raise ValueError('Pinned original ISS reference differs')
    plan=json.loads(args.recipe.read_text())
    if plan['target']!='TETHYS' or len(plan['observations'])!=9:
        raise ValueError('Unqualified source cohort')
    radius=entry['projection']['referenceRadiusMeters']
    alternatives=[('released-east-north',1,0,1),('longitude-reversed',-1,0,1),
                  ('longitude-shifted-180',1,180,1),('latitude-reversed',1,0,-1),
                  ('longitude-and-latitude-reversed',-1,0,-1),('longitude-reversed-plus-180',-1,180,1)]
    rows=[]
    row_pitch=246
    panel=Image.new('RGB',(920,110+row_pitch*len(plan['observations'])),'#14191f')
    draw=ImageDraw.Draw(panel)
    font=ImageFont.load_default(size=16)
    draw.text((15,10),'Tethys: native VIMS and exact USGS normal-map reference',fill='white',font=font)
    draw.text((15,35),'Independent gross-framing diagnostic. No pointing or photometric fit.',fill='#bbc6d2',font=font)
    draw.text((15,60),'Fixed I/F display 0-0.65; missing/withheld gray. Native array aspect preserved.',fill='#bbc6d2',font=font)
    policy=plan['policy']
    with rasterio.Env(GDAL_CACHEMAX=16*1024*1024,GDAL_NUM_THREADS='1'):
        with rasterio.open(iss) as src:
            transform=src.transform
            crs=src.crs.to_dict()
            if (src.width,src.height,src.count)!=(11520,5760,1) or src.dtypes[0]!='uint8':
                raise ValueError('Unexpected ISS pixel format')
            if crs.get('proj')!='eqc' or crs.get('lon_0')!=0 or transform.b!=0 or transform.d!=0:
                raise ValueError('Unexpected ISS coordinate system')
            def sample(lon,lat):
                x=np.radians((lon+180)%360-180)*radius
                y=np.radians(lat)*radius
                columns=np.floor((x-transform.c)/transform.a).astype(int)
                lines=np.floor((y-transform.f)/transform.e).astype(int)
                inside=(lines>=0)&(lines<src.height)&(columns>=0)&(columns<src.width)
                values=np.zeros(lon.size,dtype=np.uint8)
                indices=np.flatnonzero(inside)
                # rasterio.sample reads only indexed source cells; the bounded
                # GDAL block cache replaces any full source-image allocation.
                values[indices]=[int(v[0]) for v in src.sample(zip(x[indices],y[indices]),indexes=1)]
                return values,inside&(values!=0)
            def corr(a,b):
                if len(a)<3 or np.ptp(a)==0 or np.ptp(b)==0:
                    return None
                return float(np.corrcoef(a,b)[0,1])
            for number,obs in enumerate(plan['observations']):
                cp,npth=args.recipe.parent/obs['calibrated'],args.recipe.parent/obs['navigation']
                for key,path in [('calibrated',cp),('navigation',npth)]:
                    if digest(path)!=plan['pins'][obs[key]]:
                        raise ValueError('VIMS source pin differs')
                c,w,h,planes=native.read(cp,[25,44])
                n,nw,nh,nav=native.read(npth,range(1,7))
                if (w,h)!=(nw,nh) or native.field(c,'ProductId')!=native.field(n,'ProductId'):
                    raise ValueError('C/N identity differs')
                raw=args.recipe.parent/obs['rawOriginal']
                if digest(raw)!=plan['pins'][obs['rawOriginal']]:
                    raise ValueError('Raw original pin differs')
                q=quality.quality_for_pair(raw,cp,[25,44])
                valid=np.array([all(native.valid(nav[b][i]) for b in nav) for i in range(w*h)])
                nav={k:np.asarray(v) for k,v in nav.items()}
                valid&=((nav[1]>=policy['minimumPhaseDegrees'])&(nav[1]<=policy['maximumPhaseDegrees'])
                        &(nav[2]>=0)&(nav[2]<policy['maximumIncidenceEmissionDegrees'])
                        &(nav[3]>=0)&(nav[3]<policy['maximumIncidenceEmissionDegrees'])
                        &(abs(nav[4])<=90)&(nav[5]>=0)&(nav[5]<=360)
                        &(nav[6]>0)&(nav[6]<policy['maximumResolutionMeters']))
                lat,lon=np.where(valid,nav[4],0),np.where(valid,nav[5],0)
                mapped=[sample(a*lon+shift,b*lat) for _,a,shift,b in alternatives]
                # Every alternative for one source band uses exactly the same
                # native samples; missing reference coverage cannot pick a winner.
                common=np.logical_and.reduce([ok for _,ok in mapped])
                observations=[]
                for bi,band in enumerate([25,44]):
                    vals=np.asarray(planes[band])
                    ok=valid & np.asarray(q['validByBand'][band]) & np.array([native.valid(v) for v in vals])
                    take=ok&common
                    comparisons=[]
                    for (name,*_), (reference,_) in zip(alternatives,mapped):
                        a,b=vals[take],reference[take].astype(float)
                        comparisons.append(dict(frame=name,comparedNativeSamples=int(take.sum()),
                            pearson=corr(a,b),spearman=corr(rankdata(a),rankdata(b))))
                    observations.append(dict(band=band,wavelengthMicrometers=native.values(c,'Center')[band-1],
                        detectorQuality=q['report']['bands'][str(band)],comparisons=comparisons,
                        sourceSamplesBeforeIssMask=int(ok.sum())))
                    for side,gray in enumerate([np.clip(np.rint(np.where(ok,vals,0)/.65*255),0,255).astype('uint8'),mapped[0][0]]):
                        rgb=np.repeat(gray.reshape(h,w)[:,:,None],3,axis=2)
                        rgb[~(ok&mapped[0][1]).reshape(h,w)]=[63,70,78]
                        im=Image.fromarray(rgb)
                        factor=min(200/w,150/h)
                        im=im.resize((round(w*factor),round(h*factor)),Image.Resampling.NEAREST)
                        x=15+(bi*2+side)*230
                        y=155+number*row_pitch
                        panel.paste(im,(x+(200-im.width)//2,y+(150-im.height)//2))
                        draw.text((x,130+number*row_pitch),f'IR{band} I/F' if side==0 else f'ISS at IR{band} coords',font=font,fill='white')
                draw.text((15,100+number*row_pitch),obs['id']+f' - native {w}x{h}',font=font,fill='#e1e6ec')
                text='; '.join(f"IR{x['band']} rho={x['comparisons'][0]['spearman']:.3f}, n={x['comparisons'][0]['comparedNativeSamples']}"
                               if x['comparisons'][0]['spearman'] is not None else f"IR{x['band']}: insufficient valid samples"
                               for x in observations)
                draw.text((15,310+number*row_pitch),text,font=font,fill='#bdc7d2')
                rows.append(dict(id=obs['id'],dimensions=[w,h],bands=observations))
    image_path=args.output.with_suffix('.png')
    panel.save(image_path)
    report=dict(schema='tethys-independent-iss-framing@1',sourceIssSha256=entry['expectedSha256'],
        sourceIssOrigin=entry['origin'],sourceIssTransform=tuple(transform),sourceIssCrs=crs,
        sourceRadiusMeters=radius,recipeSha256=digest(args.recipe),scriptSha256=digest(__file__),
        qualityHelperSha256=digest(ROOT/'tools/objects/acquisition/cassini-vims-detector-quality.py'),
        scope='Independent gross-framing diagnostic only: no fit, correction or source warp',
        limits=['Different wavelengths, illumination and image resolution can dominate correlation.',
                'ISS uses a single source cell at each native N center; this does not model VIMS footprint integration.',
                'Native samples are spatially correlated; this is not a calibrated significance test.',
                'All alternatives per band use identical common nonmissing reference samples.',
                'No precise registration or absolute-pointing bound follows from this diagnostic.'],
        observations=rows,panel=image_path.name,panelSha256=digest(image_path),
        wallSeconds=time.monotonic()-start,peakRssBytesMacOS=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ('sourceIssSha256','wallSeconds','peakRssBytesMacOS')},indent=2))
    for row in rows:
        for band in row['bands']:
            print(row['id'],band['band'],[(v['frame'],v['comparedNativeSamples'],v['spearman']) for v in band['comparisons']])


if __name__=='__main__':
    main()
